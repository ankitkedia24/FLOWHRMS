import { formatAmount } from "./format";
import type { SettlementRoute } from "./policy";

/**
 * Pure helpers for settling a claim through payroll (EXPENSES-MODULE.md
 * §12–13). No database, no payroll import: the seam in `settle-payroll.ts`
 * is the only file in this module allowed to touch `@/lib/payroll`.
 */

/** UTC first-of-month for the calendar month `at` falls in, in `timeZone`. */
export function settlementMonth(at: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone,
  }).format(at);
  const [year, month] = parts.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

/** "September 2026" for a UTC first-of-month value. */
export function monthLabel(periodMonth: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(periodMonth);
}

/**
 * §12 route table. Payroll is a route only while the module is on; the
 * preference is preselected, never forced.
 */
export function offeredRoutes(input: {
  payrollOn: boolean;
  defaultRoute: SettlementRoute;
}): { routes: SettlementRoute[]; preselected: SettlementRoute } {
  if (!input.payrollOn) return { routes: ["OUTSIDE"], preselected: "OUTSIDE" };
  return { routes: ["PAYROLL", "OUTSIDE"], preselected: input.defaultRoute };
}

export const ADJUSTMENT_LABEL_MAX = 120;
export const ADJUSTMENT_REASON_MAX = 500;

/** The payslip line: `Expense · Fuel · EXP-000042` (§13 rule 5, 7). */
export function adjustmentLabel(categoryName: string, ref: string): string {
  return `Expense · ${categoryName} · ${ref}`.slice(0, ADJUSTMENT_LABEL_MAX);
}

/** The payslip reason, so a payslip reader can find the claim. */
export function adjustmentReason(ref: string, approvedOn: string, approverName: string): string {
  return `Expense claim ${ref}, approved ${approvedOn} by ${approverName}`.slice(
    0,
    ADJUSTMENT_REASON_MAX,
  );
}

export type SeamFailure = "PAYROLL_UNAVAILABLE" | "NO_OPEN_RUN" | "NO_LINE_FOR_PERSON";

/** Plain-language outcome for each typed refusal, with the way out named. */
export function seamFailureMessage(
  reason: SeamFailure,
  ctx: { monthLabel?: string; earliestLockedLabel?: string | null; personName?: string },
): string {
  switch (reason) {
    case "PAYROLL_UNAVAILABLE":
      return "Payroll is not enabled for your company. Record how it was paid outside payroll.";
    case "NO_OPEN_RUN":
      return ctx.earliestLockedLabel
        ? `${ctx.earliestLockedLabel} payroll is approved and locked, and no later month is calculated yet. Calculate the next month under Payroll, or settle outside payroll.`
        : `No payroll run is open for ${ctx.monthLabel ?? "this month"} yet. Calculate it under Payroll, or settle outside payroll.`;
    case "NO_LINE_FOR_PERSON":
      return `${ctx.personName ?? "This person"} is not on the ${ctx.monthLabel ?? "current"} payroll run — no salary set, or not included. Settle outside payroll, or set their salary and recalculate.`;
  }
}

/** Shown wherever a rounded payroll settlement differs from the approved figure. */
export function payrollRoundingNote(approvedAmount: number, settledAmount: number): string | null {
  if (approvedAmount === settledAmount) return null;
  return `${formatAmount(approvedAmount)} approved, rounded to ${formatAmount(settledAmount)} — payroll works in whole rupees.`;
}
