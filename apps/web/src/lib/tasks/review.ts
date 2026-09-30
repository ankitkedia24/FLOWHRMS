import { mayDecideOwn, type Decider } from "@/lib/authz/approvals";
import {
  decidableWhere,
  decisionScopeRefusal,
  type RecordScope,
} from "@/lib/authz/scope";

/**
 * Who may review a task's proof, and while it can still be reviewed —
 * pure, so the action, the review queue, the dashboard count and the tests
 * all draw the same line (Hardening 7E.3, 7E.4).
 *
 * 1. Nobody reviews their own proof except the Owner — the approvals rule
 *    (lib/authz/approvals.ts) applied to every role. Record scope already
 *    refused a Manager; without this an Admin, HR or Super Admin could
 *    approve their own task and collect its points.
 * 2. A Manager reviews only their team's proof (lib/authz/scope.ts).
 * 3. Only a proof still PENDING can be decided. Asking for details ends
 *    that proof — the task goes back to In progress and the employee sends
 *    a new one, which is what gets reviewed next. The action makes its
 *    write conditional on this status, so of two reviewers pressing at
 *    once exactly one decision lands.
 */

export const REVIEWABLE_PROOF_DECISIONS = ["PENDING"] as const;

export const OWN_PROOF = "You can't review your own proof. Another approver has to.";

/** Why `actor` may not review proof on this person's task, or null. */
export function proofReviewRefusal(input: {
  actor: Decider;
  scope: RecordScope;
  /** Whose task it is — the person who sent the proof. */
  assigneeId: string;
}): string | null {
  if (input.assigneeId === input.actor.membershipId && !mayDecideOwn(input.actor.roleKey)) {
    return OWN_PROOF;
  }
  return decisionScopeRefusal(input.scope, input.actor.membershipId, input.assigneeId);
}

/**
 * Where-clause fragment (on Task.assigneeId) for the proof review queue
 * and its count: the team only, and never your own unless you are an
 * Owner — who would otherwise only be refused on pressing.
 */
export function reviewableProofWhere(
  actor: Decider,
  scope: RecordScope,
): { assigneeId?: { not: string } | { in: string[] } } {
  const { membershipId } = decidableWhere(actor, scope);
  return membershipId ? { assigneeId: membershipId } : {};
}
