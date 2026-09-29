import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { AppSession } from "@/lib/auth/types";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { evaluateAccess } from "@/lib/authz/flags";
import { getDb } from "@/lib/db";
import { recordAdjustment } from "@/lib/payroll/adjustments";
import { periodLabel, roundRupees } from "@/lib/payroll/engine";
import { adjustmentLabel, adjustmentReason, settlementMonth } from "./payroll-settlement";
import { claimRef } from "./state";
import { transitionClaim } from "./transition";

/**
 * The Expenses → Payroll seam (EXPENSES-MODULE.md §13) — the ONLY file
 * under src/lib/expenses that imports from @/lib/payroll (§15).
 *
 * Rules, in the order the code applies them:
 *   1. Entitlement first: Payroll off for this tenant → PAYROLL_UNAVAILABLE.
 *   2. Never onto an approved run: the target is the earliest DRAFT run
 *      whose period is on or after the month the claim was decided in.
 *   3. Expenses never creates runs: no DRAFT run → NO_OPEN_RUN.
 *   4. The person must be on the run with a payable line → NO_LINE_FOR_PERSON.
 *   5. Whole rupees: the adjustment AND the settlement record carry
 *      roundRupees(approvedAmount) — one figure on both sides (owner
 *      decision, 7 Sept 2026). The claim keeps its approved paise.
 *   6. One-to-one and idempotent: a claim already settled through payroll
 *      returns its existing adjustment.
 *
 * Permission boundary, on purpose: the settler holds `expenses.approve`
 * and may hold neither `payroll.edit` nor `payroll.view`. Nothing here
 * reads salary, bank details or payslips, and nothing here returns net
 * pay. Do not add a payroll permission check to this file.
 */

type Reader = Pick<PrismaClient, "payrollRun" | "payrollLine">;

export type PayrollTarget =
  | {
      ok: true;
      run: { id: string; periodMonth: Date };
      line: { id: string; status: "READY" | "BLOCKED" };
    }
  | { ok: false; reason: "NO_OPEN_RUN"; earliestLockedMonth: Date | null }
  | { ok: false; reason: "NO_LINE_FOR_PERSON"; periodMonth: Date };

/** "7 Sept 2026" for a timestamp, on the tenant's calendar, not UTC's. */
function decidedOn(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone }).format(at);
}

/** Whole rupees, Payroll's own half-up rule. */
export function payrollSettlementAmount(approvedAmount: number): number {
  return roundRupees(approvedAmount);
}

/** Is the Payroll module on for this tenant right now? */
export async function payrollAvailable(session: AppSession): Promise<boolean> {
  const entitlements = await loadEntitlements(session.tenant.id, session.user.id);
  return evaluateAccess({ session, entitlements, module: "PAYROLL" }).allowed;
}

/**
 * Rules 2–4. Read-only, so the same function serves the preview on the
 * claim page and the write path inside the transaction.
 */
export async function findPayrollTarget(
  db: Reader,
  input: { tenantId: string; membershipId: string; decidedAt: Date; timeZone: string },
): Promise<PayrollTarget> {
  const monthStart = settlementMonth(input.decidedAt, input.timeZone);

  const run = await db.payrollRun.findFirst({
    where: { tenantId: input.tenantId, status: "DRAFT", periodMonth: { gte: monthStart } },
    orderBy: { periodMonth: "asc" },
    select: { id: true, periodMonth: true },
  });
  if (!run) {
    const locked = await db.payrollRun.findFirst({
      where: { tenantId: input.tenantId, status: "APPROVED", periodMonth: { gte: monthStart } },
      orderBy: { periodMonth: "asc" },
      select: { periodMonth: true },
    });
    return { ok: false, reason: "NO_OPEN_RUN", earliestLockedMonth: locked?.periodMonth ?? null };
  }

  const line = await db.payrollLine.findUnique({
    where: { runId_membershipId: { runId: run.id, membershipId: input.membershipId } },
    select: { id: true, status: true },
  });
  // A line without a salary structure is excluded from the run at
  // approval and its adjustments are dropped from the totals — it is not
  // "on the run" for our purposes. BLOCKED (negative net) is on the run;
  // a reimbursement only helps it.
  if (!line || line.status === "NO_SALARY_STRUCTURE") {
    return { ok: false, reason: "NO_LINE_FOR_PERSON", periodMonth: run.periodMonth };
  }
  return { ok: true, run, line: { id: line.id, status: line.status } };
}

export type PayrollSettlementPreview =
  | { available: false }
  | {
      available: true;
      approvedAmount: number;
      /** What the payslip and the settlement record will both carry. */
      amount: number;
      target: PayrollTarget;
      timeZone: string;
    };

/** For the claim page: what settling through payroll would do, before the click. */
export async function previewPayrollSettlement(
  session: AppSession,
  claim: { membershipId: string; decidedAt: Date | null; approvedAmount: number },
): Promise<PayrollSettlementPreview> {
  if (!(await payrollAvailable(session))) return { available: false };
  const target = await findPayrollTarget(getDb(), {
    tenantId: session.tenant.id,
    membershipId: claim.membershipId,
    decidedAt: claim.decidedAt ?? new Date(),
    timeZone: session.tenant.timezone,
  });
  return {
    available: true,
    approvedAmount: claim.approvedAmount,
    amount: payrollSettlementAmount(claim.approvedAmount),
    target,
    timeZone: session.tenant.timezone,
  };
}

export type PayrollSettlementResult =
  | {
      ok: true;
      adjustmentId: string;
      periodMonth: Date;
      periodLabel: string;
      /** Whole rupees — the figure on the payslip and the settlement record. */
      amount: number;
      approvedAmount: number;
      alreadySettled: boolean;
    }
  | { ok: false; reason: "PAYROLL_UNAVAILABLE" }
  | { ok: false; reason: "NO_OPEN_RUN"; earliestLockedMonth: Date | null }
  | { ok: false; reason: "NO_LINE_FOR_PERSON"; periodMonth: Date }
  | { ok: false; reason: "REFUSED"; error: string };

/**
 * Settle one approved claim through payroll, inside the caller’s
 * transaction. Writes, in order: the payroll adjustment (via Payroll’s own
 * `recordAdjustment`), then the settlement record + claim status +
 * transition row + audit (via `transitionClaim`). If the transition is
 * refused after the adjustment was written, this THROWS so the caller’s
 * transaction rolls the adjustment back too.
 */
export async function settleViaPayroll(input: {
  tx: Prisma.TransactionClient;
  session: AppSession;
  claimId: string;
}): Promise<PayrollSettlementResult> {
  const { tx, session, claimId } = input;
  const tenantId = session.tenant.id;
  const timeZone = session.tenant.timezone;

  // 1. Entitlement first — returned, never thrown.
  if (!(await payrollAvailable(session))) return { ok: false, reason: "PAYROLL_UNAVAILABLE" };

  // Lock the claim for the rest of the transaction (transitionClaim locks
  // it again; same transaction, same lock).
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "expense_claims"
    WHERE "id" = ${claimId}::uuid AND "tenantId" = ${tenantId}::uuid
    FOR UPDATE`;
  if (locked.length === 0) return { ok: false, reason: "REFUSED", error: "That claim is not here." };

  const claim = await tx.expenseClaim.findUniqueOrThrow({
    where: { id: claimId },
    include: { settlement: true },
  });
  const ref = claimRef(claim.claimNumber);

  // 6. Idempotent: already settled through payroll → hand back the record.
  if (claim.status === "SETTLED") {
    const existing = claim.settlement;
    if (existing?.route === "PAYROLL" && existing.payrollAdjustmentId) {
      const adjustment = await tx.payrollAdjustment.findUnique({
        where: { id: existing.payrollAdjustmentId },
        include: { line: { include: { run: { select: { periodMonth: true } } } } },
      });
      const periodMonth = adjustment?.line.run.periodMonth ?? settlementMonth(existing.settledAt, timeZone);
      return {
        ok: true,
        adjustmentId: existing.payrollAdjustmentId,
        periodMonth,
        periodLabel: periodLabel(periodMonth, timeZone),
        amount: Number(existing.amount),
        approvedAmount: Number(claim.approvedAmount ?? existing.amount),
        alreadySettled: true,
      };
    }
    return { ok: false, reason: "REFUSED", error: `${ref} was already settled outside payroll.` };
  }
  if (claim.status !== "APPROVED" && claim.status !== "PARTIALLY_APPROVED") {
    return { ok: false, reason: "REFUSED", error: `Only an approved claim can be settled — ${ref} is ${claim.status.toLowerCase().replace("_", " ")}.` };
  }
  if (claim.approvedAmount === null) {
    return { ok: false, reason: "REFUSED", error: "Nothing approved to settle." };
  }

  // 2–4. Where it lands.
  const decidedAt = claim.decidedAt ?? new Date();
  const target = await findPayrollTarget(tx, {
    tenantId,
    membershipId: claim.membershipId,
    decidedAt,
    timeZone,
  });
  if (!target.ok) return target;

  // 5. One figure on both sides.
  const approvedAmount = Number(claim.approvedAmount);
  const amount = payrollSettlementAmount(approvedAmount);
  const decider = claim.decidedById
    ? await tx.user.findUnique({ where: { id: claim.decidedById }, select: { displayName: true } })
    : null;

  const adjustment = await recordAdjustment(tx, session, {
    lineId: target.line.id,
    label: adjustmentLabel(claim.categoryName, ref),
    amount,
    reason: adjustmentReason(ref, decidedOn(decidedAt, timeZone), decider?.displayName ?? "an approver"),
  });
  if (!adjustment.ok) return { ok: false, reason: "REFUSED", error: adjustment.error };

  const label = periodLabel(target.run.periodMonth, timeZone);
  const transition = await transitionClaim({
    tx,
    session,
    claimId: claim.id,
    to: "SETTLED",
    allowSelfApproval: false,
    settlement: {
      route: "PAYROLL",
      reference: `${label} payroll`,
      payrollAdjustmentId: adjustment.adjustmentId,
      amount,
    },
  });
  // The adjustment is already written in this transaction: only a throw
  // takes it back out.
  if (!transition.ok) throw new Error(transition.error);

  return {
    ok: true,
    adjustmentId: adjustment.adjustmentId,
    periodMonth: target.run.periodMonth,
    periodLabel: label,
    amount,
    approvedAmount,
    alreadySettled: false,
  };
}
