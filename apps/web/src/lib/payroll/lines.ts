import type { PayrollLineResult, PayslipComponentLine } from "./engine";

/**
 * What a payroll line stores, which stored lines a recalculation removes,
 * and the one rule for "do the stored lines still match a fresh
 * calculation?". Pure, so the rules are pinned by
 * src/tests/payroll-lines.test.ts.
 *
 * Why it matters: payslips are read from the stored lines, not from the
 * run totals. Calculate writes exactly `planLineWrites(...)`; Approve
 * recomputes the preview, plans the same writes, and approves only when
 * that plan would change nothing (`compareRunLines` finds no difference).
 * So what people see on their payslip is what was approved (owner
 * decision, hardening batch 4).
 *
 * Status vocabulary: NO_SALARY_STRUCTURE is the "left out of this run"
 * status everywhere — no payslip, not a settlement target, not in the
 * totals. The schema has no separate "has left" status, so a line kept
 * for someone who left uses it too, with its own reason.
 */

export type LineStatus = "READY" | "NO_SALARY_STRUCTURE" | "BLOCKED";

export interface LineFigures {
  membershipId: string;
  status: LineStatus;
  statusReason: string | null;
  calendarDays: number;
  workingDays: number;
  weeklyOffDays: number;
  holidayDays: number;
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

/** The figures Calculate stores for one preview line. */
export function lineFigures(
  draft: {
    membershipId: string;
    status: LineStatus;
    statusReason: string | null;
    result: PayrollLineResult | null;
  },
  calendarDays: number,
): LineFigures {
  const r = draft.result;
  return {
    membershipId: draft.membershipId,
    status: draft.status,
    statusReason: draft.statusReason,
    calendarDays: r?.calendarDays ?? calendarDays,
    workingDays: r?.workingDays ?? 0,
    weeklyOffDays: r?.weeklyOffDays ?? 0,
    holidayDays: r?.holidayDays ?? 0,
    presentDays: r?.presentDays ?? 0,
    paidLeaveDays: r?.paidLeaveDays ?? 0,
    unpaidDays: r?.unpaidDays ?? 0,
    payableDays: r?.payableDays ?? 0,
    lateMinutes: r?.lateMinutes ?? 0,
    lateDeductionDays: r?.lateDeductionDays ?? 0,
    // Empty, not "leave as it was": a line that loses its salary
    // structure must not keep the pay items from an older calculation.
    earnings: r?.earnings ?? [],
    deductions: r?.deductions ?? [],
    gross: r?.gross ?? 0,
    deductionTotal: r?.deductionTotal ?? 0,
    adjustmentTotal: r?.adjustmentTotal ?? 0,
    net: r?.net ?? 0,
  };
}

export const LEFT_THE_RUN_REASON =
  "No longer active — left out of this run. Its adjustments are in no payslip.";

/**
 * A stored line for someone no longer in the preview who has adjustments
 * on it. Deleting the line would delete those adjustments with it (they
 * cascade) — and an expense settled through payroll points at one — so it
 * stays, zeroed and left out of the run. The payroll screen already lists
 * such adjustments as "on lines this run will not pay".
 */
export function leftTheRunFigures(
  membershipId: string,
  calendarDays: number,
): LineFigures {
  return lineFigures(
    {
      membershipId,
      status: "NO_SALARY_STRUCTURE",
      statusReason: LEFT_THE_RUN_REASON,
      result: null,
    },
    calendarDays,
  );
}

export interface StoredLineRef {
  id: string;
  membershipId: string;
  adjustmentCount: number;
}

export interface LineWritePlan {
  /** Upsert these, keyed by membership (line ids stay stable). */
  write: LineFigures[];
  /** Delete these stored line ids: people no longer in the preview. */
  remove: string[];
}

/**
 * What Calculate writes: every preview line, plus — for stored lines whose
 * person is no longer in the preview — removal, or the zeroed "left the
 * run" line when adjustments hang off it.
 */
export function planLineWrites(
  fresh: readonly LineFigures[],
  stored: readonly StoredLineRef[],
  calendarDays: number,
): LineWritePlan {
  const inPreview = new Set(fresh.map((f) => f.membershipId));
  const write = [...fresh];
  const remove: string[] = [];
  for (const line of stored) {
    if (inPreview.has(line.membershipId)) continue;
    if (line.adjustmentCount > 0) {
      write.push(leftTheRunFigures(line.membershipId, calendarDays));
    } else {
      remove.push(line.id);
    }
  }
  return { write, remove };
}

type Numeric = number | string | { toString(): string };

/** A stored payroll line as the database returns it (Decimals, Json). */
export interface StoredLineRow {
  membershipId: string;
  status: LineStatus;
  statusReason: string | null;
  calendarDays: number;
  workingDays: number;
  weeklyOffDays: number;
  holidayDays: number;
  presentDays: Numeric;
  paidLeaveDays: Numeric;
  unpaidDays: Numeric;
  payableDays: Numeric;
  lateMinutes: number;
  lateDeductionDays: Numeric;
  earnings: unknown;
  deductions: unknown;
  gross: Numeric;
  deductionTotal: Numeric;
  adjustmentTotal: Numeric;
  net: Numeric;
}

function componentsOf(value: unknown): PayslipComponentLine[] {
  return Array.isArray(value) ? (value as PayslipComponentLine[]) : [];
}

/** A stored row in the same shape as a freshly planned line. */
export function storedLineFigures(row: StoredLineRow): LineFigures {
  return {
    membershipId: row.membershipId,
    status: row.status,
    statusReason: row.statusReason,
    calendarDays: row.calendarDays,
    workingDays: row.workingDays,
    weeklyOffDays: row.weeklyOffDays,
    holidayDays: row.holidayDays,
    presentDays: Number(row.presentDays),
    paidLeaveDays: Number(row.paidLeaveDays),
    unpaidDays: Number(row.unpaidDays),
    payableDays: Number(row.payableDays),
    lateMinutes: row.lateMinutes,
    lateDeductionDays: Number(row.lateDeductionDays),
    earnings: componentsOf(row.earnings),
    deductions: componentsOf(row.deductions),
    gross: Number(row.gross),
    deductionTotal: Number(row.deductionTotal),
    adjustmentTotal: Number(row.adjustmentTotal),
    net: Number(row.net),
  };
}

/**
 * Every number a payslip prints from the line. Days are included with
 * money: a payslip whose days disagree with its pay is as wrong as one
 * whose pay changed.
 */
export const COMPARED_FIGURES = [
  "calendarDays",
  "workingDays",
  "weeklyOffDays",
  "holidayDays",
  "presentDays",
  "paidLeaveDays",
  "unpaidDays",
  "payableDays",
  "lateMinutes",
  "lateDeductionDays",
  "gross",
  "deductionTotal",
  "adjustmentTotal",
  "net",
] as const satisfies ReadonlyArray<keyof LineFigures>;

/** Equal at the precision the database stores (two decimals). */
function sameFigure(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

/** Same pay items, in the same order, with the same amounts. */
function sameComponents(
  a: readonly PayslipComponentLine[],
  b: readonly PayslipComponentLine[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((line, i) => {
    const other = b[i];
    return (
      line.key === other.key &&
      line.kind === other.kind &&
      sameFigure(line.amount, other.amount) &&
      sameFigure(line.fullAmount, other.fullAmount)
    );
  });
}

export interface LineDifference {
  membershipId: string;
  /**
   * ADDED: someone the fresh calculation has and the run does not.
   * REMOVED: a stored line the fresh calculation would delete.
   * CHANGED: both have it, but a figure differs (`fields` names them).
   */
  change: "ADDED" | "REMOVED" | "CHANGED";
  fields: string[];
}

/**
 * The approval check. `stored` is what the run holds now; `planned` is
 * `planLineWrites(...).write` from a fresh preview (so a stored line it
 * would delete is simply absent from it). Identical means: the same set
 * of memberships, and for each the same status, every figure in
 * COMPARED_FIGURES, and the same pay items (key, kind, amount, full
 * amount) in `earnings` and `deductions`. Wording — status reasons,
 * component names and bases — is not compared. Empty result: approve.
 */
export function compareRunLines(
  stored: readonly LineFigures[],
  planned: readonly LineFigures[],
): LineDifference[] {
  const differences: LineDifference[] = [];
  const storedBy = new Map(stored.map((s) => [s.membershipId, s]));
  const plannedIds = new Set(planned.map((p) => p.membershipId));

  for (const fresh of planned) {
    const current = storedBy.get(fresh.membershipId);
    if (!current) {
      differences.push({ membershipId: fresh.membershipId, change: "ADDED", fields: [] });
      continue;
    }
    const fields: string[] = [];
    if (current.status !== fresh.status) fields.push("status");
    for (const key of COMPARED_FIGURES) {
      if (!sameFigure(current[key], fresh[key])) fields.push(key);
    }
    if (!sameComponents(current.earnings, fresh.earnings)) fields.push("earnings");
    if (!sameComponents(current.deductions, fresh.deductions)) fields.push("deductions");
    if (fields.length > 0) {
      differences.push({ membershipId: fresh.membershipId, change: "CHANGED", fields });
    }
  }

  for (const current of stored) {
    if (!plannedIds.has(current.membershipId)) {
      differences.push({ membershipId: current.membershipId, change: "REMOVED", fields: [] });
    }
  }

  return differences;
}
