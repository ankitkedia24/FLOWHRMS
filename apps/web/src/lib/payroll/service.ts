import "server-only";

import { getDb } from "@/lib/db";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AppSession } from "@/lib/auth/types";
import { getPolicy } from "@/lib/policies";
import { personWeeklyOff } from "@/lib/attendance/calendar";
import { loadWorkCalendar } from "@/lib/attendance/work-calendar";
import {
  attendanceTreatment,
  summariseAttendance,
  undecidedAttendanceBlocker,
} from "./summary";
import {
  DEFAULT_LATE_POLICY,
  calculatePayrollLine,
  daysInPeriod,
  type AttendanceSummary,
  type ComponentDefinition,
  type LatePolicy,
  type PayrollLineResult,
  type SalaryStructureInput,
} from "./engine";

/**
 * Gathers the APPROVED inputs a payroll period is calculated from and
 * runs the pure engine over them. Nothing here invents a rule: policy
 * comes from tenant configuration, money comes from the employee's
 * salary structure, days come from attendance and decided leave.
 */

export interface PayrollLineDraft {
  membershipId: string;
  name: string;
  employeeCode: string | null;
  status: "READY" | "NO_SALARY_STRUCTURE" | "BLOCKED";
  statusReason: string | null;
  result: PayrollLineResult | null;
}

export interface PayrollPreview {
  periodMonth: Date;
  calendarDays: number;
  latePolicy: LatePolicy;
  /** The company calendar this period was counted against. */
  workCalendar: {
    weeklyOffDays: number[];
    holidaysInPeriod: Array<{ date: string; name: string }>;
  };
  lines: PayrollLineDraft[];
  /**
   * Attendance records still waiting for a decision (PENDING or
   * DETAILS_REQUESTED) for the people this run calculates.
   */
  unreviewedExceptions: number;
  /**
   * Set while any of those records is undecided — Calculate and Approve
   * refuse until someone decides them (src/lib/payroll/summary.ts).
   */
  attendanceBlocker: string | null;
  grossTotal: number;
  deductionTotal: number;
  netTotal: number;
  /**
   * Adjustments sitting on lines this run will NOT pay — the person has no
   * salary structure, or is no longer active. Money recorded but not
   * payable (an expense settled through payroll, say) is surfaced as a
   * warning rather than silently dropped from the totals.
   */
  adjustmentsOnExcludedLines: Array<{
    membershipId: string;
    name: string;
    count: number;
    total: number;
  }>;
}

/** Start of a payroll month as a UTC date-only value. */
export function periodStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

/** The month currently being worked on, in the tenant's timezone. */
export function currentPeriod(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone,
  }).format(new Date());
  const [year, month] = parts.split("-").map(Number);
  return periodStart(year, month);
}

export async function loadLatePolicy(tenantId: string): Promise<LatePolicy> {
  const stored = await getPolicy<Partial<LatePolicy>>(tenantId, "payroll");
  return { ...DEFAULT_LATE_POLICY, ...(stored ?? {}) };
}

/** The client or a transaction client — whichever the caller holds. */
export type PreviewReader = Pick<
  PrismaClient,
  | "tenantMembership"
  | "salaryComponent"
  | "salaryStructure"
  | "attendanceRecord"
  | "leaveRequest"
  | "payrollRun"
>;

/**
 * Build a preview for a period from live data. This is what the payroll
 * dashboard shows before anything is written, and what Calculate and
 * Approve re-compute server-side so the figures cannot be tampered with.
 * They pass their transaction so the preview is read while they hold the
 * run's row lock.
 */
export async function buildPayrollPreview(
  session: AppSession,
  periodMonth: Date,
  db: PreviewReader = getDb(),
): Promise<PayrollPreview> {
  const tenantId = session.tenant.id;
  const calendarDays = daysInPeriod(periodMonth);
  const periodEnd = new Date(
    Date.UTC(
      periodMonth.getUTCFullYear(),
      periodMonth.getUTCMonth(),
      calendarDays,
    ),
  );
  const [latePolicy, workCalendar] = await Promise.all([
    loadLatePolicy(tenantId),
    loadWorkCalendar(tenantId),
  ]);

  const [members, components, structures, attendance, leave, existingRun] =
    await Promise.all([
      db.tenantMembership.findMany({
        where: { tenantId, status: "ACTIVE" },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      }),
      db.salaryComponent.findMany({
        where: { tenantId, isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      db.salaryStructure.findMany({
        where: { tenantId, effectiveFrom: { lte: periodEnd } },
        include: { lines: true },
        orderBy: { effectiveFrom: "desc" },
      }),
      db.attendanceRecord.findMany({
        where: {
          tenantId,
          workDate: { gte: periodMonth, lte: periodEnd },
        },
        select: {
          membershipId: true,
          workDate: true,
          checkInAt: true,
          lateMinutes: true,
          reviewStatus: true,
          exemptionStatus: true,
        },
      }),
      db.leaveRequest.findMany({
        where: {
          tenantId,
          status: "APPROVED",
          startDate: { lte: periodEnd },
          endDate: { gte: periodMonth },
        },
        select: {
          membershipId: true,
          startDate: true,
          endDate: true,
          type: true,
          paid: true,
          unpaidDays: true,
        },
      }),
      db.payrollRun.findUnique({
        where: { tenantId_periodMonth: { tenantId, periodMonth } },
        include: { lines: { include: { adjustments: true } } },
      }),
    ]);

  const componentById = new Map(components.map((c) => [c.id, c]));

  // Most recent structure effective on or before the period end wins.
  const structureByMembership = new Map<string, (typeof structures)[number]>();
  for (const structure of structures) {
    if (!structureByMembership.has(structure.membershipId)) {
      structureByMembership.set(structure.membershipId, structure);
    }
  }

  const lines: PayrollLineDraft[] = [];
  // Undecided attendance of the people this run calculates. Someone left
  // out (no salary structure, or no longer active) is not paid from their
  // attendance, so their undecided records do not hold the run up.
  const undecided: Array<{ name: string; reviewStatus: string }> = [];

  for (const member of members) {
    const structure = structureByMembership.get(member.id);
    if (!structure) {
      lines.push({
        membershipId: member.id,
        name: member.user.displayName,
        employeeCode: member.employeeCode,
        status: "NO_SALARY_STRUCTURE",
        statusReason: "No salary structure",
        result: null,
      });
      continue;
    }

    const records = attendance.filter((r) => r.membershipId === member.id);
    for (const record of records) {
      if (attendanceTreatment(record.reviewStatus) === "UNDECIDED") {
        undecided.push({ name: member.user.displayName, reviewStatus: record.reviewStatus });
      }
    }

    // Weekly offs and holidays are paid and never absent — only working
    // days can be; rejected records are not present days
    // (src/lib/payroll/summary.ts).
    const summary: AttendanceSummary = summariseAttendance({
      periodStart: periodMonth,
      periodEnd,
      calendar: workCalendar,
      weeklyOffDays: personWeeklyOff(workCalendar, member),
      records,
      leave: leave.filter((l) => l.membershipId === member.id),
    });

    const definitions: ComponentDefinition[] = structure.lines
      .map((line) => {
        const component = componentById.get(line.componentId);
        if (!component) return null;
        return {
          key: component.key,
          name: component.name,
          kind: component.kind,
          calculation: component.calculation,
          isStatutory: component.isStatutory,
          prorated: component.prorated,
          amount: Number(line.amount),
          percent: Number(line.percent),
        } satisfies ComponentDefinition;
      })
      .filter((c): c is ComponentDefinition => c !== null);

    const structureInput: SalaryStructureInput = {
      baseAmount: Number(structure.baseAmount),
      components: definitions,
    };

    const savedLine = existingRun?.lines.find(
      (l) => l.membershipId === member.id,
    );
    const adjustments = (savedLine?.adjustments ?? []).map((a) => ({
      label: a.label,
      amount: Number(a.amount),
    }));

    const result = calculatePayrollLine({
      structure: structureInput,
      attendance: summary,
      policy: latePolicy,
      adjustments,
    });

    lines.push({
      membershipId: member.id,
      name: member.user.displayName,
      employeeCode: member.employeeCode,
      status: result.net < 0 ? "BLOCKED" : "READY",
      statusReason:
        result.net < 0
          ? "Net pay is negative. Add an adjustment before approving."
          : null,
      result,
    });
  }

  // Saved adjustments whose line this preview will not pay.
  const draftByMembership = new Map(lines.map((l) => [l.membershipId, l]));
  const adjustmentsOnExcludedLines = (existingRun?.lines ?? [])
    .filter((saved) => saved.adjustments.length > 0)
    .filter((saved) => {
      const draft = draftByMembership.get(saved.membershipId);
      return !draft || draft.status === "NO_SALARY_STRUCTURE";
    })
    .map((saved) => ({
      membershipId: saved.membershipId,
      name: draftByMembership.get(saved.membershipId)?.name ?? "A former employee",
      count: saved.adjustments.length,
      total: saved.adjustments.reduce((sum, a) => sum + Number(a.amount), 0),
    }));

  const payable = lines.filter((l) => l.result);
  const periodStartKey = periodMonth.toISOString().slice(0, 10);
  const periodEndKey = periodEnd.toISOString().slice(0, 10);
  return {
    periodMonth,
    calendarDays,
    latePolicy,
    workCalendar: {
      weeklyOffDays: workCalendar.weeklyOffDays,
      holidaysInPeriod: workCalendar.holidays.filter(
        (h) => h.date >= periodStartKey && h.date <= periodEndKey,
      ),
    },
    lines,
    unreviewedExceptions: undecided.length,
    attendanceBlocker: undecidedAttendanceBlocker(undecided),
    adjustmentsOnExcludedLines,
    grossTotal: payable.reduce((sum, l) => sum + (l.result?.gross ?? 0), 0),
    deductionTotal: payable.reduce(
      (sum, l) => sum + (l.result?.deductionTotal ?? 0),
      0,
    ),
    netTotal: payable.reduce((sum, l) => sum + (l.result?.net ?? 0), 0),
  };
}
