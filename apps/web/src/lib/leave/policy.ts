/**
 * Leave policy logic — pure functions, no I/O.
 *
 * V1 has no earned-leave balances and no holiday calendar (both explicitly
 * excluded from V1), so every approved day of leave is unpaid unless the
 * approver decides otherwise at approval time — that decision is recorded
 * with a reason (user-flows.md §4).
 *
 * Payroll figures are NOT calculated here: this module states the payroll
 * *effect* in words for the consequence line. Actual salary maths waits for
 * the approved payroll rule documents.
 */

export type LeaveType = "FULL_DAY" | "HALF_DAY" | "EMERGENCY";

/** Whole days between two date-only values, inclusive of both ends. */
export function countDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

/** Days deducted for a request. Half day counts as 0.5. */
export function leaveDays(input: {
  type: LeaveType;
  start: Date;
  end: Date;
}): number {
  if (input.type === "HALF_DAY") return 0.5;
  return Math.max(1, countDays(input.start, input.end));
}

/** "August" — the payroll period a request falls in (tenant timezone). */
export function payrollMonthLabel(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", timeZone }).format(
    date,
  );
}

/** "12–13 August 2026" / "12 August 2026" — notification and status copy. */
export function formatDateRange(
  start: Date,
  end: Date,
  timeZone: string,
): string {
  const sameDay = start.getTime() === end.getTime();
  const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  });
  if (sameDay) return dayMonthYear.format(start);
  const dayOnly = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    timeZone,
  });
  const sameMonth =
    new Intl.DateTimeFormat("en-GB", { month: "long", timeZone }).format(
      start,
    ) ===
    new Intl.DateTimeFormat("en-GB", { month: "long", timeZone }).format(end);
  return sameMonth
    ? `${dayOnly.format(start)}–${dayMonthYear.format(end)}`
    : `${dayMonthYear.format(start)} – ${dayMonthYear.format(end)}`;
}

export interface Consequence {
  sentence: string;
  detail?: string;
  requiresReason: boolean;
}

/**
 * Consequence shown to the employee BEFORE sending a request
 * (copy-deck.md §4 — fixed wording).
 */
export function leaveRequestConsequence(input: {
  days: number;
  monthLabel: string;
}): Consequence {
  const dayWord = input.days === 1 ? "day" : "days";
  return {
    sentence: `${input.days} unpaid ${dayWord} will be applied to ${input.monthLabel} payroll.`,
    detail: "Your manager can change this before payroll is approved.",
    requiresReason: true,
  };
}

/** Impact line on the approver's card — computed, never generic. */
export function leaveApprovalImpact(input: {
  days: number;
  monthLabel: string;
  name: string;
  paid: boolean;
}): string {
  if (input.paid) {
    return `Approving as paid applies no deduction for ${input.name}. The reason is recorded.`;
  }
  const dayWord = input.days === 1 ? "day" : "days";
  return `Approving applies ${input.days} unpaid ${dayWord} to ${input.monthLabel} payroll for ${input.name}.`;
}

/** Overlap check (edge-cases.md: blocked at submission, dates named). */
export function overlaps(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
): boolean {
  return a.start <= b.end && b.start <= a.end;
}
