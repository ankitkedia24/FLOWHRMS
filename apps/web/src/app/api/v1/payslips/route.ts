import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function isUuid(val?: string | null): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
}

/**
 * Resolves the authenticated caller's TenantMembership from headers / DB.
 */
async function resolveMembership(req: NextRequest) {
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

/**
 * Mobile & Web Payslips API (GET /api/v1/payslips)
 *
 * Implements Constitution §6 & Security Boundaries:
 * - Employees only see their own payslips.
 * - Drafts are NEVER shown to employees — payslips appear only once approved.
 * - Complete mathematical breakdown of attendance and salary components.
 */
export async function GET(req: NextRequest) {
  try {
    const membership = await resolveMembership(req);
    if (!membership) {
      return NextResponse.json({ ok: false, error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const db = getDb();
    const { searchParams } = new URL(req.url);
    const slipId = searchParams.get("id");
    const requestedMemberId = searchParams.get("membershipId");
    const fy = searchParams.get("fy") || "FY 2026-27";

    const isPrivileged =
      membership.role?.key === "OWNER" ||
      membership.role?.key === "ADMIN" ||
      membership.role?.key === "HR";

    // Regular employees can only query their own payslips
    const targetMembershipId = isPrivileged && requestedMemberId ? requestedMemberId : membership.id;

    // 1. Single payslip detail request
    if (slipId && isUuid(slipId)) {
      const line = await db.payrollLine.findFirst({
        where: {
          id: slipId,
          tenantId: membership.tenantId,
          ...(isPrivileged ? {} : { membershipId: membership.id }),
        },
        include: {
          run: true,
          adjustments: { orderBy: { createdAt: "asc" } },
          membership: {
            include: {
              user: { select: { displayName: true, email: true } },
              tenant: { select: { name: true, slug: true } },
            },
          },
        },
      });

      if (!line) {
        return NextResponse.json({ ok: false, error: "Payslip not found." }, { status: 404 });
      }

      // Employees never see unapproved runs
      if (!isPrivileged && line.run.status !== "APPROVED") {
        return NextResponse.json({ ok: false, error: "Payslip has not been approved yet." }, { status: 403 });
      }

      const periodDate = new Date(line.run.periodMonth);
      const monthName = periodDate.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
      const lastDay = line.calendarDays || 30;

      return NextResponse.json({
        ok: true,
        data: {
          id: line.id,
          runId: line.runId,
          month: monthName,
          period: `01 ${monthName.slice(0, 3)} ${periodDate.getUTCFullYear()} - ${lastDay} ${monthName.slice(0, 3)} ${periodDate.getUTCFullYear()}`,
          employeeName: line.membership.user.displayName,
          employeeCode: line.membership.employeeCode,
          companyName: line.membership.tenant.name,
          grossEarnings: Number(line.gross),
          totalDeductions: Number(line.deductionTotal),
          adjustmentTotal: Number(line.adjustmentTotal),
          netPayable: Number(line.net),
          status: line.run.status === "APPROVED" ? "DISBURSED" : "CALCULATED",
          disbursedOn: line.run.approvedAt
            ? new Date(line.run.approvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : "Pending Approval",
          paymentMode: "Direct Bank Transfer",
          pdfUrl: `/api/v1/payslips/download?id=${line.id}`,
          attendance: {
            calendarDays: line.calendarDays,
            workingDays: line.workingDays,
            weeklyOffDays: line.weeklyOffDays,
            holidayDays: line.holidayDays,
            presentDays: Number(line.presentDays),
            paidLeaveDays: Number(line.paidLeaveDays),
            unpaidDays: Number(line.unpaidDays),
            payableDays: Number(line.payableDays),
            lateMinutes: line.lateMinutes,
            lateDeductionDays: Number(line.lateDeductionDays),
          },
          earnings: (line.earnings as any[]) ?? [],
          deductions: (line.deductions as any[]) ?? [],
          adjustments: line.adjustments.map((a) => ({
            label: a.label,
            amount: Number(a.amount),
            reason: a.reason,
          })),
        },
      });
    }

    // 2. List of payslips for employee
    const lines = await db.payrollLine.findMany({
      where: {
        tenantId: membership.tenantId,
        membershipId: targetMembershipId,
        status: "READY",
        run: { status: "APPROVED" }, // Constitution §6: Never show drafts to employees
      },
      include: {
        run: true,
        adjustments: { orderBy: { createdAt: "asc" } },
        membership: {
          include: {
            user: { select: { displayName: true, email: true } },
            tenant: { select: { name: true } },
          },
        },
      },
      orderBy: { run: { periodMonth: "desc" } },
      take: 24,
    });

    const payslips = lines.map((line) => {
      const periodDate = new Date(line.run.periodMonth);
      const monthName = periodDate.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
      const lastDay = line.calendarDays || 30;

      return {
        id: line.id,
        runId: line.runId,
        month: monthName,
        period: `01 ${monthName.slice(0, 3)} ${periodDate.getUTCFullYear()} - ${lastDay} ${monthName.slice(0, 3)} ${periodDate.getUTCFullYear()}`,
        employeeName: line.membership.user.displayName,
        employeeCode: line.membership.employeeCode,
        companyName: line.membership.tenant.name,
        grossEarnings: Number(line.gross),
        totalDeductions: Number(line.deductionTotal),
        adjustmentTotal: Number(line.adjustmentTotal),
        netPayable: Number(line.net),
        status: "DISBURSED",
        disbursedOn: line.run.approvedAt
          ? new Date(line.run.approvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : "—",
        paymentMode: "Direct Bank Transfer",
        pdfUrl: `/api/v1/payslips/download?id=${line.id}`,
        attendance: {
          calendarDays: line.calendarDays,
          workingDays: line.workingDays,
          weeklyOffDays: line.weeklyOffDays,
          holidayDays: line.holidayDays,
          presentDays: Number(line.presentDays),
          paidLeaveDays: Number(line.paidLeaveDays),
          unpaidDays: Number(line.unpaidDays),
          payableDays: Number(line.payableDays),
          lateMinutes: line.lateMinutes,
          lateDeductionDays: Number(line.lateDeductionDays),
        },
        earnings: (line.earnings as any[]) ?? [],
        deductions: (line.deductions as any[]) ?? [],
        adjustments: line.adjustments.map((a) => ({
          label: a.label,
          amount: Number(a.amount),
          reason: a.reason,
        })),
      };
    });

    return NextResponse.json({
      ok: true,
      financialYear: fy,
      data: payslips,
    });
  } catch (error: any) {
    console.error("Error in /api/v1/payslips:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load payslips" },
      { status: 500 }
    );
  }
}
