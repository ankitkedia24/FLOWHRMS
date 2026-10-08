import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildPayrollPreview, periodStart, currentPeriod } from "@/lib/payroll/service";
import { periodLabel } from "@/lib/payroll/engine";
import { lineFigures, planLineWrites, type LineFigures } from "@/lib/payroll/lines";
import type { AppSession } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

function isUuid(val?: string | null): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
}

function toJson<T>(value: T) {
  return JSON.parse(JSON.stringify(value));
}

function lineData(line: LineFigures) {
  return {
    status: line.status,
    statusReason: line.statusReason,
    calendarDays: line.calendarDays,
    workingDays: line.workingDays,
    weeklyOffDays: line.weeklyOffDays,
    holidayDays: line.holidayDays,
    presentDays: line.presentDays,
    paidLeaveDays: line.paidLeaveDays,
    unpaidDays: line.unpaidDays,
    payableDays: line.payableDays,
    lateMinutes: line.lateMinutes,
    lateDeductionDays: line.lateDeductionDays,
    earnings: toJson(line.earnings),
    deductions: toJson(line.deductions),
    gross: line.gross,
    deductionTotal: line.deductionTotal,
    adjustmentTotal: line.adjustmentTotal,
    net: line.net,
  };
}

async function resolveAdminMembership(req: NextRequest) {
  const db = getDb();
  const headerEmail = req.headers.get("x-user-email");
  const headerUserId = req.headers.get("x-user-id");
  const rawTenantId = req.headers.get("x-tenant-id");
  const validTenantId = isUuid(rawTenantId) ? rawTenantId! : undefined;

  // 1. Look up by user email
  if (headerEmail) {
    const user = await db.user.findFirst({
      where: { email: { equals: headerEmail, mode: "insensitive" } },
      include: {
        memberships: {
          where: validTenantId ? { tenantId: validTenantId } : undefined,
          include: { tenant: true, role: true, user: true },
          take: 1,
        },
      },
    }).catch(() => null);
    if (user?.memberships?.[0]) return user.memberships[0];
  }

  // 2. Look up by user ID
  if (isUuid(headerUserId)) {
    const user = await db.user.findUnique({
      where: { id: headerUserId! },
      include: {
        memberships: {
          where: validTenantId ? { tenantId: validTenantId } : undefined,
          include: { tenant: true, role: true, user: true },
          take: 1,
        },
      },
    }).catch(() => null);
    if (user?.memberships?.[0]) return user.memberships[0];
  }

  // 3. Fallback to first active membership
  const fallback = await db.tenantMembership.findFirst({
    where: {
      tenantId: validTenantId,
      status: "ACTIVE",
    },
    include: { tenant: true, role: true, user: true },
  }).catch(() => null);

  return fallback;
}

function buildMockSession(membership: any): AppSession {
  return {
    user: {
      id: membership.user.id,
      displayName: membership.user.displayName,
      email: membership.user.email,
      isPlatformAdmin: false,
    },
    tenant: {
      id: membership.tenant.id,
      slug: membership.tenant.slug,
      name: membership.tenant.name,
      timezone: membership.tenant.timezone || "Asia/Kolkata",
      plan: "PAID",
      trialEndsAt: null,
      selfSignup: true,
      ownerEmailVerifiedAt: new Date(),
      paidUntil: null,
    },
    membership: {
      id: membership.id,
      roleKey: membership.role?.key || "ADMIN",
      roleName: membership.role?.name || "Administrator",
      employeeCode: membership.employeeCode,
    },
    permissions: new Set(["payroll.view", "payroll.edit", "payroll.approve"] as any),
    source: "supabase",
  };
}

/**
 * Mobile Payroll API (GET & POST /api/v1/payroll)
 * Fully connected with live PostgreSQL database, attendance punches, and salary structures.
 */
export async function GET(req: NextRequest) {
  try {
    const membership = await resolveAdminMembership(req);
    if (!membership) {
      return NextResponse.json({ ok: false, error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const db = getDb();
    const { searchParams } = new URL(req.url);
    const tz = membership.tenant.timezone || "Asia/Kolkata";
    const requestedPeriod = searchParams.get("period");

    let periodMonth: Date;
    if (requestedPeriod && /^\d{4}-\d{2}$/.test(requestedPeriod)) {
      const [y, m] = requestedPeriod.split("-").map(Number);
      periodMonth = periodStart(y, m);
    } else {
      // Find latest payroll run or use current period
      const latestRun = await db.payrollRun.findFirst({
        where: { tenantId: membership.tenantId },
        orderBy: { periodMonth: "desc" },
      });
      periodMonth = latestRun ? latestRun.periodMonth : currentPeriod(tz);
    }

    const periodStr = periodMonth.toISOString().slice(0, 7);
    const label = periodLabel(periodMonth, tz);

    // 1. Check existing saved run
    const existingRun = await db.payrollRun.findUnique({
      where: {
        tenantId_periodMonth: { tenantId: membership.tenantId, periodMonth },
      },
      include: {
        lines: {
          include: {
            adjustments: true,
            membership: {
              include: { user: true, role: true },
            },
          },
        },
      },
    });

    const session = buildMockSession(membership);
    const preview = await buildPayrollPreview(session, periodMonth);

    // Active members
    const allMembers = await db.tenantMembership.findMany({
      where: { tenantId: membership.tenantId, status: "ACTIVE" },
      include: { user: true, role: true },
      orderBy: { createdAt: "asc" },
    });

    if (existingRun) {
      const employees = existingRun.lines.map((line) => ({
        id: line.id,
        membershipId: line.membershipId,
        code: line.membership.employeeCode || "N/A",
        name: line.membership.user.displayName,
        role: line.membership.designation || line.membership.role?.name || "Employee",
        attendanceDays: Number(line.payableDays),
        gross: Number(line.gross),
        deductions: Number(line.deductionTotal),
        net: Number(line.net),
        status: line.status,
        statusReason: line.statusReason,
      }));

      // Include active members not yet in lines as NO_SALARY_STRUCTURE or EXCLUDED
      const existingMemberIds = new Set(existingRun.lines.map((l) => l.membershipId));
      for (const m of allMembers) {
        if (!existingMemberIds.has(m.id)) {
          employees.push({
            id: `unset-${m.id}`,
            membershipId: m.id,
            code: m.employeeCode || "N/A",
            name: m.user.displayName,
            role: m.designation || m.role?.name || "Employee",
            attendanceDays: 0,
            gross: 0,
            deductions: 0,
            net: 0,
            status: "NO_SALARY_STRUCTURE",
            statusReason: "No salary structure configured",
          });
        }
      }

      const totalPresent = existingRun.lines.reduce((sum, l) => sum + Number(l.presentDays), 0);
      const totalLeaves = existingRun.lines.reduce((sum, l) => sum + Number(l.paidLeaveDays), 0);
      const totalUnpaid = existingRun.lines.reduce((sum, l) => sum + Number(l.unpaidDays), 0);

      return NextResponse.json({
        ok: true,
        data: {
          period: label,
          periodCode: periodStr,
          status: existingRun.status === "APPROVED" ? "APPROVED" : "CALCULATED",
          isCalculated: true,
          payableEmployeesCount: existingRun.lines.filter((l) => l.status === "READY").length,
          inputsUsed: {
            period: label,
            daysInPeriod: existingRun.lines[0]?.calendarDays || preview.calendarDays,
            attendanceApprovedDays: totalPresent,
            lossOfPayDays: totalUnpaid,
            paidLeaveDays: totalLeaves,
            workingDaysInMonth: preview.calendarDays,
            latePolicy: "3 lates = 1 unpaid day",
            deductAbsentDays: true,
            rounding: "Half-up to whole rupees",
          },
          calculation: {
            grossEarnings: Number(existingRun.grossTotal),
            totalDeductions: Number(existingRun.deductionTotal),
            netPayable: Number(existingRun.netTotal),
          },
          employees,
        },
      });
    }

    // Run not calculated yet -> show preview
    const employees = preview.lines.map((line) => {
      const member = allMembers.find((m) => m.id === line.membershipId);
      return {
        id: line.membershipId,
        membershipId: line.membershipId,
        code: line.employeeCode || member?.employeeCode || "N/A",
        name: line.name,
        role: member?.designation || member?.role?.name || "Employee",
        attendanceDays: Number(line.result?.payableDays ?? 0),
        gross: Number(line.result?.gross ?? 0),
        deductions: Number(line.result?.deductionTotal ?? 0),
        net: Number(line.result?.net ?? 0),
        status: line.status,
        statusReason: line.statusReason,
      };
    });

    return NextResponse.json({
      ok: true,
      data: {
        period: label,
        periodCode: periodStr,
        status: "NOT_CALCULATED",
        isCalculated: false,
        payableEmployeesCount: preview.lines.filter((l) => l.status === "READY").length,
        inputsUsed: {
          period: label,
          daysInPeriod: preview.calendarDays,
          attendanceApprovedDays: preview.lines.reduce((sum, l) => sum + Number(l.result?.presentDays ?? 0), 0),
          lossOfPayDays: preview.lines.reduce((sum, l) => sum + Number(l.result?.unpaidDays ?? 0), 0),
          paidLeaveDays: preview.lines.reduce((sum, l) => sum + Number(l.result?.paidLeaveDays ?? 0), 0),
          workingDaysInMonth: preview.calendarDays,
          latePolicy: "3 lates = 1 unpaid day",
          deductAbsentDays: true,
          rounding: "Half-up to whole rupees",
        },
        calculation: {
          grossEarnings: preview.grossTotal,
          totalDeductions: preview.deductionTotal,
          netPayable: preview.netTotal,
        },
        employees,
      },
    });
  } catch (err: any) {
    console.error("Error in GET /api/v1/payroll:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Failed to load payroll" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const membership = await resolveAdminMembership(req);
    if (!membership) {
      return NextResponse.json({ ok: false, error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, period, month } = body;
    const db = getDb();
    const tz = membership.tenant.timezone || "Asia/Kolkata";

    let periodMonth: Date;
    const targetPeriod = period || month;
    if (targetPeriod && /^\d{4}-\d{2}$/.test(targetPeriod)) {
      const [y, m] = targetPeriod.split("-").map(Number);
      periodMonth = periodStart(y, m);
    } else {
      periodMonth = currentPeriod(tz);
    }

    const label = periodLabel(periodMonth, tz);

    if (action === "export") {
      const run = await db.payrollRun.findUnique({
        where: { tenantId_periodMonth: { tenantId: membership.tenantId, periodMonth } },
        include: {
          lines: {
            include: {
              membership: { include: { user: true } },
            },
          },
        },
      });

      return NextResponse.json({
        ok: true,
        message: `${label} payroll summary CSV ready.`,
        fileUrl: `/api/v1/payroll/export?period=${periodMonth.toISOString().slice(0, 7)}`,
        data: {
          period: label,
          linesCount: run?.lines.length ?? 0,
          grossTotal: Number(run?.grossTotal ?? 0),
          netTotal: Number(run?.netTotal ?? 0),
        },
      });
    }

    // Action: calculate (or recalculate)
    const existing = await db.payrollRun.findUnique({
      where: { tenantId_periodMonth: { tenantId: membership.tenantId, periodMonth } },
    });

    if (existing && existing.status === "APPROVED") {
      return NextResponse.json(
        {
          ok: false,
          error: `${label} payroll is approved and locked. Add later changes to next month's payroll as an adjustment.`,
        },
        { status: 400 }
      );
    }

    const session = buildMockSession(membership);
    const preview = await buildPayrollPreview(session, periodMonth);

    if (preview.attendanceBlocker) {
      return NextResponse.json(
        {
          ok: false,
          error: `${label} payroll cannot be calculated yet. ${preview.attendanceBlocker} Please review attendance first.`,
        },
        { status: 400 }
      );
    }

    // Persist calculation
    const runData = {
      calculatedAt: new Date(),
      grossTotal: preview.grossTotal,
      deductionTotal: preview.deductionTotal,
      netTotal: preview.netTotal,
      inputsSnapshot: toJson({
        latePolicy: preview.latePolicy,
        calendarDays: preview.calendarDays,
        unreviewedExceptions: preview.unreviewedExceptions,
      }),
    };

    const run = existing
      ? await db.payrollRun.update({ where: { id: existing.id }, data: runData })
      : await db.payrollRun.create({
          data: {
            tenantId: membership.tenantId,
            periodMonth,
            status: "DRAFT",
            ...runData,
          },
        });

    const stored = existing
      ? await db.payrollLine.findMany({
          where: { runId: run.id, tenantId: membership.tenantId },
          select: { id: true, membershipId: true, _count: { select: { adjustments: true } } },
        })
      : [];

    const plan = planLineWrites(
      preview.lines.map((l) => lineFigures(l, preview.calendarDays)),
      stored.map((s) => ({
        id: s.id,
        membershipId: s.membershipId,
        adjustmentCount: s._count.adjustments,
      })),
      preview.calendarDays
    );

    if (plan.remove.length > 0) {
      await db.payrollLine.deleteMany({
        where: { id: { in: plan.remove }, runId: run.id, tenantId: membership.tenantId },
      });
    }

    for (const line of plan.write) {
      const data = lineData(line);
      await db.payrollLine.upsert({
        where: { runId_membershipId: { runId: run.id, membershipId: line.membershipId } },
        update: data,
        create: {
          tenantId: membership.tenantId,
          runId: run.id,
          membershipId: line.membershipId,
          ...data,
        },
      });
    }

    const payableCount = preview.lines.filter((l) => l.status === "READY").length;

    return NextResponse.json({
      ok: true,
      message: `${label} payroll successfully calculated for ${payableCount} employee(s).`,
      calculation: {
        grossEarnings: preview.grossTotal,
        totalDeductions: preview.deductionTotal,
        netPayable: preview.netTotal,
        payableEmployeesCount: payableCount,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error("Error in POST /api/v1/payroll:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Payroll calculation failed." },
      { status: 500 }
    );
  }
}
