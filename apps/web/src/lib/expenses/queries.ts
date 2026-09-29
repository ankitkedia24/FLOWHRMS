import "server-only";

import type { AppSession } from "@/lib/auth/types";
import { getDb } from "@/lib/db";
import { canViewOthersClaims } from "./access";

/**
 * Read models for the Expenses screens. Amounts come back as Prisma
 * Decimals; pages format them with `formatAmount`, never arithmetic here.
 */

const listSelect = {
  id: true,
  claimNumber: true,
  status: true,
  categoryName: true,
  claimedAmount: true,
  approvedAmount: true,
  expenseDate: true,
  description: true,
  isLate: true,
  isOverCap: true,
  isPossibleDuplicate: true,
  submittedAt: true,
  decidedAt: true,
  decisionReason: true,
  settledAt: true,
  withdrawnAt: true,
  withdrawalReason: true,
  membership: { select: { id: true, user: { select: { displayName: true } } } },
  settlement: { select: { route: true, reference: true, settledAt: true, amount: true } },
  _count: { select: { receipts: true } },
} as const;

/** The signed-in person’s own claims, newest first. */
export async function listMyClaims(session: AppSession, take = 50) {
  return getDb().expenseClaim.findMany({
    where: { tenantId: session.tenant.id, membershipId: session.membership.id },
    select: listSelect,
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    take,
  });
}

/** The approver’s view: waiting, approved-not-settled, and recent history. */
export async function listAdminClaims(session: AppSession) {
  const db = getDb();
  const tenantId = session.tenant.id;
  const [waiting, unsettled, recent] = await Promise.all([
    db.expenseClaim.findMany({
      where: { tenantId, status: "SUBMITTED" },
      select: listSelect,
      orderBy: { submittedAt: "asc" },
    }),
    db.expenseClaim.findMany({
      where: { tenantId, status: { in: ["APPROVED", "PARTIALLY_APPROVED"] } },
      select: listSelect,
      orderBy: { decidedAt: "asc" },
    }),
    db.expenseClaim.findMany({
      where: { tenantId, status: { in: ["REJECTED", "WITHDRAWN", "SETTLED"] } },
      select: listSelect,
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
  ]);
  return { waiting, unsettled, recent };
}

/**
 * One claim with everything a screen needs — receipts, the timeline, the
 * settlement — or null when it is not here or not this person’s to see
 * (§5: own claims always; others’ with expenses.view or expenses.approve).
 */
export async function loadClaimForViewer(session: AppSession, claimId: string) {
  const claim = await getDb().expenseClaim.findFirst({
    where: { id: claimId, tenantId: session.tenant.id },
    include: {
      membership: {
        select: {
          id: true,
          user: { select: { id: true, displayName: true } },
          department: { select: { name: true } },
        },
      },
      receipts: { orderBy: { createdAt: "asc" } },
      transitions: { orderBy: { createdAt: "asc" } },
      settlement: true,
    },
  });
  if (!claim) return null;
  const isOwn = claim.membershipId === session.membership.id;
  if (!isOwn && !canViewOthersClaims(session)) return null;

  // Names for the timeline: who moved the claim at each step.
  const actorIds = Array.from(
    new Set(claim.transitions.map((t) => t.actorUserId).filter((id): id is string => Boolean(id))),
  );
  const actors = actorIds.length
    ? await getDb().user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, displayName: true },
      })
    : [];
  const actorNames: Record<string, string> = {};
  for (const a of actors) actorNames[a.id] = a.displayName;

  return { claim, isOwn, actorNames };
}

/**
 * Approved claims not yet settled — the payroll run screen pulls from
 * this list (EXPENSES-MODULE.md §13 rule 8) and filters to the people on
 * its run. Read-only; the write still goes through the seam.
 */
export async function listClaimsAwaitingPayroll(session: AppSession) {
  return getDb().expenseClaim.findMany({
    where: {
      tenantId: session.tenant.id,
      status: { in: ["APPROVED", "PARTIALLY_APPROVED"] },
    },
    select: {
      id: true,
      claimNumber: true,
      categoryName: true,
      approvedAmount: true,
      decidedAt: true,
      membershipId: true,
      membership: { select: { user: { select: { displayName: true } } } },
    },
    orderBy: { decidedAt: "asc" },
  });
}

export type ClaimListRow = Awaited<ReturnType<typeof listMyClaims>>[number];
export type ClaimDetail = NonNullable<Awaited<ReturnType<typeof loadClaimForViewer>>>;
