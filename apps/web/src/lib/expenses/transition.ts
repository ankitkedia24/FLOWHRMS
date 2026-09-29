import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { AppSession } from "@/lib/auth/types";
import { recordAuditEvent } from "@/lib/audit";
import { claimRef, transitionGuard, type ClaimStatus } from "./state";

/**
 * The ONE seam through which an expense claim changes status
 * (EXPENSES-MODULE.md §3–4, §14).
 *
 * Runs inside the caller’s transaction. Locks the claim row first, so two
 * transitions racing each other — a withdrawal and an approval in the same
 * second — resolve to exactly one winner: the second sees the new status
 * and is refused with that status named. Then the pure guard decides;
 * then, in this order, the settlement record (if any), the claim update,
 * the transition row, and the audit event — all in the same transaction,
 * so a failure in any of them rolls back the status.
 */

type Tx = Prisma.TransactionClient;

export interface TransitionInput {
  tx: Tx;
  session: AppSession;
  claimId: string;
  to: ClaimStatus;
  allowSelfApproval: boolean;
  reason?: string;
  approvedAmount?: number;
  /** For SETTLED only: the record that makes settlement a fact (§12). */
  settlement?: {
    route: "OUTSIDE" | "PAYROLL";
    reference: string | null;
    payrollAdjustmentId?: string | null;
    /** Whole rupees when the route is PAYROLL (§13); defaults to approvedAmount. */
    amount?: number;
  };
}

export interface LockedClaim {
  id: string;
  tenantId: string;
  membershipId: string;
  claimNumber: number;
  status: ClaimStatus;
  claimedAmount: number;
  approvedAmount: number | null;
  categoryName: string;
  isLate: boolean;
  isOverCap: boolean;
  isPossibleDuplicate: boolean;
  policyVersion: number | null;
}

export type TransitionResult =
  | {
      ok: true;
      claim: LockedClaim;
      from: ClaimStatus;
      selfApproved: boolean;
      ref: string;
      /** The amount on the settlement record, when this transition settled. */
      settledAmount: number | null;
    }
  | { ok: false; error: string; status?: ClaimStatus };

const AUDIT_ACTION: Record<ClaimStatus, string> = {
  DRAFT: "expense.drafted",
  SUBMITTED: "expense.submitted",
  APPROVED: "expense.approved",
  PARTIALLY_APPROVED: "expense.partially_approved",
  REJECTED: "expense.rejected",
  WITHDRAWN: "expense.withdrawn",
  SETTLED: "expense.settled",
};

export async function transitionClaim(input: TransitionInput): Promise<TransitionResult> {
  const { tx, session, claimId, to } = input;
  const tenantId = session.tenant.id;

  // 1. Lock the row. Tenant-scoped, so another tenant’s id is “not here”.
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "expense_claims"
    WHERE "id" = ${claimId}::uuid AND "tenantId" = ${tenantId}::uuid
    FOR UPDATE`;
  if (locked.length === 0) return { ok: false, error: "That claim is not here." };

  const row = await tx.expenseClaim.findUniqueOrThrow({ where: { id: claimId } });
  const claim: LockedClaim = {
    id: row.id,
    tenantId: row.tenantId,
    membershipId: row.membershipId,
    claimNumber: row.claimNumber,
    status: row.status,
    claimedAmount: Number(row.claimedAmount),
    approvedAmount: row.approvedAmount === null ? null : Number(row.approvedAmount),
    categoryName: row.categoryName,
    isLate: row.isLate,
    isOverCap: row.isOverCap,
    isPossibleDuplicate: row.isPossibleDuplicate,
    policyVersion: row.policyVersion,
  };
  const from = claim.status;

  // 2. The pure guard decides.
  const guard = transitionGuard({
    from,
    to,
    actor: {
      isClaimant: claim.membershipId === session.membership.id,
      canApprove: session.permissions.has("expenses.approve"),
    },
    allowSelfApproval: input.allowSelfApproval,
    claimedAmount: claim.claimedAmount,
    approvedAmount: input.approvedAmount,
    reason: input.reason,
    hasSettlementRecord: Boolean(input.settlement),
  });
  if (!guard.ok) return { ok: false, error: guard.error, status: from };

  const now = new Date();
  const ref = claimRef(claim.claimNumber);

  // 3. Settlement record first — the fact that makes SETTLED true.
  let settledAmount: number | null = null;
  if (to === "SETTLED" && input.settlement) {
    if (claim.approvedAmount === null) {
      return { ok: false, error: "Nothing approved to settle.", status: from };
    }
    settledAmount = input.settlement.amount ?? claim.approvedAmount;
    await tx.expenseSettlement.create({
      data: {
        tenantId,
        claimId: claim.id,
        route: input.settlement.route,
        amount: settledAmount,
        reference: input.settlement.reference,
        payrollAdjustmentId: input.settlement.payrollAdjustmentId ?? null,
        settledById: session.user.id,
        settledAt: now,
      },
    });
  }

  // 4. The claim itself.
  const data: Prisma.ExpenseClaimUpdateInput = { status: to };
  switch (to) {
    case "SUBMITTED":
      data.submittedAt = now;
      break;
    case "APPROVED":
    case "PARTIALLY_APPROVED":
      data.approvedAmount = guard.approvedAmount;
      data.decidedById = session.user.id;
      data.decidedAt = now;
      data.decisionReason = guard.reason;
      break;
    case "REJECTED":
      data.decidedById = session.user.id;
      data.decidedAt = now;
      data.decisionReason = guard.reason;
      break;
    case "WITHDRAWN":
      data.withdrawnAt = now;
      data.withdrawalReason = guard.reason;
      break;
    case "SETTLED":
      data.settledAt = now;
      break;
  }
  await tx.expenseClaim.update({ where: { id: claim.id }, data });

  // 5. The claim’s own timeline (§14).
  await tx.expenseClaimTransition.create({
    data: {
      tenantId,
      claimId: claim.id,
      fromStatus: from,
      toStatus: to,
      actorUserId: session.user.id,
      actorType: "USER",
      reason: guard.reason,
      approvedAmount: guard.approvedAmount,
      selfApproved: guard.selfApproved,
      createdAt: now,
    },
  });

  // 6. The tenant-wide log, in the same transaction.
  await recordAuditEvent(
    session,
    {
      action: AUDIT_ACTION[to],
      entityType: "expense_claim",
      entityId: claim.id,
      reason: guard.reason ?? undefined,
      before: { status: from, approvedAmount: claim.approvedAmount },
      after: { status: to, approvedAmount: guard.approvedAmount ?? claim.approvedAmount },
      metadata: {
        claimNumber: claim.claimNumber,
        ref,
        amount: claim.claimedAmount,
        category: claim.categoryName,
        ...(to === "SUBMITTED"
          ? {
              isLate: claim.isLate,
              isOverCap: claim.isOverCap,
              isPossibleDuplicate: claim.isPossibleDuplicate,
              policyVersion: claim.policyVersion,
            }
          : {}),
        ...(guard.selfApproved ? { selfApproved: true } : {}),
        ...(to === "SETTLED" && input.settlement
          ? {
              route: input.settlement.route,
              reference: input.settlement.reference,
              payrollAdjustmentId: input.settlement.payrollAdjustmentId ?? null,
              settledAmount,
            }
          : {}),
      },
    },
    tx,
  );

  return {
    ok: true,
    claim: { ...claim, status: to },
    from,
    selfApproved: guard.selfApproved,
    ref,
    settledAmount,
  };
}
