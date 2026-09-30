import "server-only";

import type { AppSession } from "@/lib/auth/types";
import { mayDecideOwn } from "@/lib/authz/approvals";
import { loadRecordScope } from "@/lib/authz/record-scope";
import { canSee } from "@/lib/authz/scope";
import { getDb } from "@/lib/db";
import { canViewOthersClaims } from "./access";
import { claimListWhere } from "./queue-scope";
import { ownClaimRefusal } from "./state";

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

/**
 * May the signed-in person decide / settle their own claim? Decides which
 * queues include it (queue-scope.ts); the seam enforces the same rule.
 */
function ownClaimAllowed(session: AppSession, step: "decide" | "settle") {
  return ownClaimRefusal({ step, mayDecideOwn: mayDecideOwn(session.membership.roleKey) }) === null;
}

/**
 * The approver’s view: waiting, approved-not-settled, and recent history —
 * their team’s claims if their role is team-scoped (Hardening batch 7), and
 * their own in a queue only where they may act on it.
 */
export async function listAdminClaims(session: AppSession) {
  const db = getDb();
  const tenantId = session.tenant.id;
  const me = session.membership.id;
  const scope = await loadRecordScope(session);
  const [waiting, unsettled, recent] = await Promise.all([
    db.expenseClaim.findMany({
      where: {
        tenantId,
        status: "SUBMITTED",
        ...claimListWhere(me, scope, ownClaimAllowed(session, "decide")),
      },
      select: listSelect,
      orderBy: { submittedAt: "asc" },
    }),
    db.expenseClaim.findMany({
      where: {
        tenantId,
        status: { in: ["APPROVED", "PARTIALLY_APPROVED"] },
        ...claimListWhere(me, scope, ownClaimAllowed(session, "settle")),
      },
      select: listSelect,
      orderBy: { decidedAt: "asc" },
    }),
    db.expenseClaim.findMany({
      where: {
        tenantId,
        status: { in: ["REJECTED", "WITHDRAWN", "SETTLED"] },
        ...claimListWhere(me, scope, true),
      },
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
 * (§5: own claims always; others’ with expenses.view or expenses.approve,
 * and only within record scope — a Manager, their team’s). Both claim
 * pages load a travel claim’s evidence only after this, so it follows.
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
  if (!isOwn && !canSee(await loadRecordScope(session), session.membership.id, claim.membershipId)) {
    return null;
  }

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
 * its run. Only claims the viewer may settle: their team’s, and their own
 * only if they are the Owner. Read-only; the write still goes through the
 * seam.
 */
export async function listClaimsAwaitingPayroll(session: AppSession) {
  return getDb().expenseClaim.findMany({
    where: {
      tenantId: session.tenant.id,
      status: { in: ["APPROVED", "PARTIALLY_APPROVED"] },
      ...claimListWhere(
        session.membership.id,
        await loadRecordScope(session),
        ownClaimAllowed(session, "settle"),
      ),
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
