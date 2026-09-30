/**
 * Payroll calculation engine — pure functions, no I/O, no database.
 *
 * WHAT THIS DOES NOT DO (deliberately, per Product Bible boundaries and
 * design decision D-019): it contains **no statutory formulas**. FlowHRMS does
 * not compute PF, ESI, professional tax, TDS or any other legal deduction.
 * Those are tenant-configured salary components whose amounts or
 * percentages the customer's accountant supplies. FlowHRMS never certifies
 * statutory compliance.
 *
 * What it does: turn approved inputs — attendance, approved leave, the
 * tenant's late policy and the employee's configured salary structure —
 * into a payslip whose every figure traces back to a named input.
 *
 * Rounding rule (documented once, applied consistently, stated on the
 * payslip): every component and total is rounded HALF-UP to whole rupees.
 * Totals always reconcile to the sum of the printed lines because the
 * totals are summed from the rounded lines, never rounded separately.
 */

export type ComponentKind = "EARNING" | "DEDUCTION";
export type ComponentCalculation = "FIXED" | "PERCENT_OF_BASE" | "PER_DAY";

export interface ComponentDefinition {
  key: string;
  name: string;
  kind: ComponentKind;
  calculation: ComponentCalculation;
  /** Marked by the tenant as defined by their accountant. */
  isStatutory: boolean;
  /** Whether unpaid days reduce this component. */
  prorated: boolean;
  /** FIXED and PER_DAY use this. */
  amount: number;
  /** PERCENT_OF_BASE uses this (0–100). */
  percent: number;
}

export interface SalaryStructureInput {
  baseAmount: number;
  components: ComponentDefinition[];
}

/** Tenant late policy — configuration, not code (Constitution §1). */
export interface LatePolicy {
  /** How many late arrivals convert into one unpaid day. 0 = never. */
  latesPerDeductedDay: number;
  /** Do unmarked absent days reduce pay? */
  deductAbsentDays: boolean;
}

export const DEFAULT_LATE_POLICY: LatePolicy = {
  latesPerDeductedDay: 3,
  deductAbsentDays: true,
};

export interface AttendanceSummary {
  /** Days in the payroll month. */
  calendarDays: number;
  /**
   * The calendar days split by the work calendar. Weekly offs and holidays
   * are paid and never absent; only working days can be. Optional so a
   * summary built before the work calendar existed still calculates.
   */
  workingDays?: number;
  weeklyOffDays?: number;
  holidayDays?: number;
  /** Days with a check-in that is not an unresolved exception. */
  presentDays: number;
  /** Approved leave the approver marked paid. */
  paidLeaveDays: number;
  /** Approved leave the approver marked unpaid. */
  unpaidLeaveDays: number;
  /** Working days with neither attendance nor approved leave. */
  absentDays: number;
  /** Count of days marked late (after grace, exemptions removed). */
  lateDays: number;
  /** Total late minutes, shown for transparency. */
  lateMinutes: number;
}

export interface PayslipComponentLine {
  key: string;
  name: string;
  kind: ComponentKind;
  isStatutory: boolean;
  /** The full monthly value before pro-rating. */
  fullAmount: number;
  /** What is actually applied this period, after pro-rating. */
  amount: number;
  /** Plain-language explanation of how the figure was reached. */
  basis: string;
}

export interface PayrollLineResult {
  calendarDays: number;
  workingDays?: number;
  weeklyOffDays?: number;
  holidayDays?: number;
  presentDays: number;
  paidLeaveDays: number;
  unpaidDays: number;
  payableDays: number;
  lateMinutes: number;
  lateDeductionDays: number;
  earnings: PayslipComponentLine[];
  deductions: PayslipComponentLine[];
  gross: number;
  deductionTotal: number;
  adjustmentTotal: number;
  net: number;
}

/** Half-up rounding to whole rupees — the single documented rule. */
export function roundRupees(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value) + Number.EPSILON);
}

/**
 * Unpaid days for the period: unpaid leave, optionally absent days, plus
 * days converted from repeated lateness by the tenant's policy.
 */
export function unpaidDaysFor(
  attendance: AttendanceSummary,
  policy: LatePolicy,
): { unpaidDays: number; lateDeductionDays: number } {
  const lateDeductionDays =
    policy.latesPerDeductedDay > 0
      ? Math.floor(attendance.lateDays / policy.latesPerDeductedDay)
      : 0;

  const unpaidDays =
    attendance.unpaidLeaveDays +
    (policy.deductAbsentDays ? attendance.absentDays : 0) +
    lateDeductionDays;

  return { unpaidDays, lateDeductionDays };
}

/**
 * Calculate one employee's payslip for a period.
 * Every returned line carries a `basis` string so the payslip can show
 * how the number was reached (Constitution §6 — no hidden calculations).
 */
export function calculatePayrollLine(input: {
  structure: SalaryStructureInput;
  attendance: AttendanceSummary;
  policy: LatePolicy;
  adjustments?: Array<{ label: string; amount: number }>;
}): PayrollLineResult {
  const { structure, attendance, policy } = input;
  const { unpaidDays, lateDeductionDays } = unpaidDaysFor(attendance, policy);

  const calendarDays = Math.max(1, attendance.calendarDays);
  const payableDays = Math.max(0, calendarDays - unpaidDays);
  /** Pro-rating factor — the documented per-day basis. */
  const factor = payableDays / calendarDays;

  const earnings: PayslipComponentLine[] = [];
  const deductions: PayslipComponentLine[] = [];

  for (const component of structure.components) {
    let fullAmount: number;
    let basis: string;

    switch (component.calculation) {
      case "PERCENT_OF_BASE":
        fullAmount = (structure.baseAmount * component.percent) / 100;
        basis = `${component.percent}% of base ₹${formatPlain(structure.baseAmount)}`;
        break;
      case "PER_DAY":
        fullAmount = component.amount * payableDays;
        basis = `₹${formatPlain(component.amount)} × ${payableDays} payable days`;
        break;
      case "FIXED":
      default:
        fullAmount = component.amount;
        basis = "Fixed monthly amount";
        break;
    }

    // PER_DAY is already day-based; pro-rating it again would double-count.
    const applyProration =
      component.prorated && component.calculation !== "PER_DAY";
    const amount = roundRupees(
      applyProration ? fullAmount * factor : fullAmount,
    );

    if (applyProration && unpaidDays > 0) {
      basis += ` · pro-rated for ${payableDays} of ${calendarDays} days`;
    }

    const line: PayslipComponentLine = {
      key: component.key,
      name: component.name,
      kind: component.kind,
      isStatutory: component.isStatutory,
      fullAmount: roundRupees(fullAmount),
      amount,
      basis,
    };

    if (component.kind === "EARNING") earnings.push(line);
    else deductions.push(line);
  }

  // Totals are summed from the ROUNDED lines so a payslip always adds up.
  const gross = earnings.reduce((sum, line) => sum + line.amount, 0);
  const deductionTotal = deductions.reduce((sum, line) => sum + line.amount, 0);
  const adjustmentTotal = (input.adjustments ?? []).reduce(
    (sum, adjustment) => sum + roundRupees(adjustment.amount),
    0,
  );
  const net = gross - deductionTotal + adjustmentTotal;

  return {
    calendarDays,
    workingDays: attendance.workingDays,
    weeklyOffDays: attendance.weeklyOffDays,
    holidayDays: attendance.holidayDays,
    presentDays: attendance.presentDays,
    paidLeaveDays: attendance.paidLeaveDays,
    unpaidDays,
    payableDays,
    lateMinutes: attendance.lateMinutes,
    lateDeductionDays,
    earnings,
    deductions,
    gross,
    deductionTotal,
    adjustmentTotal,
    net,
  };
}

/** A run may not be approved while any line is unpayable. */
export interface RunBlocker {
  membershipName: string;
  reason: string;
}

export function runBlockers(
  lines: Array<{ name: string; status: string; net: number }>,
): RunBlocker[] {
  const blockers: RunBlocker[] = [];
  for (const line of lines) {
    // Negative net pay blocks approval (edge-cases.md → Payroll). The
    // preview marks such a line BLOCKED, so any status counts except a line
    // left out of the run — matching READY alone let the server approve
    // what the screen had disabled.
    if (line.status !== "NO_SALARY_STRUCTURE" && line.net < 0) {
      blockers.push({
        membershipName: line.name,
        reason: "Net pay is negative. Add an adjustment before approving.",
      });
    }
  }
  return blockers;
}

/** Employees excluded from the run, named explicitly in the approval. */
export function runExclusions(
  lines: Array<{ name: string; status: string }>,
): string[] {
  return lines
    .filter((line) => line.status === "NO_SALARY_STRUCTURE")
    .map((line) => line.name);
}

/** Indian digit grouping: ₹1,42,800 (implementation guide §8). */
export function formatRupees(value: number): string {
  return `₹${formatPlain(value)}`;
}

export function formatPlain(value: number): string {
  const rounded = roundRupees(value);
  const negative = rounded < 0;
  const digits = Math.abs(rounded).toString();

  let formatted: string;
  if (digits.length <= 3) {
    formatted = digits;
  } else {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    formatted = `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
  }
  return negative ? `-${formatted}` : formatted;
}

/** "August 2026" — payroll period label. */
export function periodLabel(periodMonth: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone,
  }).format(periodMonth);
}

/** Days in the month a period starts in (UTC date-only value). */
export function daysInPeriod(periodMonth: Date): number {
  return new Date(
    Date.UTC(
      periodMonth.getUTCFullYear(),
      periodMonth.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
}
