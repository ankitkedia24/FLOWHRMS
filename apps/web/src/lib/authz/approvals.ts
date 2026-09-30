/**
 * Who may decide a leave request or an attendance exception, and while it
 * can still be decided — pure, so the actions, their queues and the
 * approval tiles all apply the same rules (Hardening batch 2).
 *
 * 1. Nobody decides their own request (USER-ROLES.md, Amendment 1). The
 *    Owner is the one exception: nobody sits above them, so refusing would
 *    leave their leave undecidable for ever.
 * 2. "Ask for details" is a question, not an ending. A request waiting on
 *    an answer can still be approved or rejected; only a final decision
 *    closes it.
 * 3. The first final decision wins. The actions make the write itself
 *    conditional on one of these statuses, so two approvers pressing at
 *    once cannot both succeed.
 */

/** Statuses a decision may still move a request out of. */
export const DECIDABLE_STATUSES = ["PENDING", "DETAILS_REQUESTED"] as const;

export type DecidableStatus = (typeof DECIDABLE_STATUSES)[number];

export function isDecidable(status: string): status is DecidableStatus {
  return (DECIDABLE_STATUSES as readonly string[]).includes(status);
}

/** Said to the approver who lost the race, or who opened a stale card. */
export const ALREADY_DECIDED =
  "Already decided. Open the activity log to see who decided.";

/**
 * Asking for details sends the employee the question word for word; an
 * empty one would leave them guessing what to add.
 */
export const QUESTION_NEEDED = "Write your question, so they know what to answer.";

/** The Owner has nobody above them, so they alone may decide their own. */
export function mayDecideOwn(roleKey: string): boolean {
  return roleKey === "OWNER";
}

export interface Decider {
  membershipId: string;
  roleKey: string;
}

const OWN: Record<"leave" | "attendance", string> = {
  leave: "You can't decide your own leave. Another approver has to.",
  attendance: "You can't review your own attendance. Another approver has to.",
};

/** Why `actor` may not decide this request themselves, or null if they may. */
export function selfDecisionRefusal(input: {
  actor: Decider;
  /** Whose request it is. */
  subjectMembershipId: string;
  kind: "leave" | "attendance";
}): string | null {
  if (input.subjectMembershipId !== input.actor.membershipId) return null;
  return mayDecideOwn(input.actor.roleKey) ? null : OWN[input.kind];
}

/**
 * Where-clause fragment that keeps someone's own requests out of the queue
 * they decide from — they would only be refused on pressing. Owners keep
 * theirs, because they may decide them.
 */
export function withoutOwn(actor: Decider): { membershipId?: { not: string } } {
  return mayDecideOwn(actor.roleKey) ? {} : { membershipId: { not: actor.membershipId } };
}
