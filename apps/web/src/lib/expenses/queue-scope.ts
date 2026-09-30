import type { RecordScope } from "@/lib/authz/scope";

/**
 * Which claims an approver's lists show (Hardening batch 7) — pure, so the
 * Expenses screen and Payroll's "waiting to settle" list draw the same line
 * as the actions that refuse (transition.ts).
 *
 * - Team-scoped roles (Manager, Team Leader, Viewer, custom roles) see
 *   their team's claims; Owner, Super Admin, Admin and HR see everyone's
 *   (lib/authz/scope.ts).
 * - The actor's own claim is in a queue only when they could act on it
 *   there (`ownClaimRefusal`, state.ts) — otherwise the button would only
 *   refuse. History lists always include it: seeing your own is fine.
 *
 * Returns a where-clause fragment for `expenseClaim.membershipId`.
 */
export function claimListWhere(
  actorId: string,
  scope: RecordScope,
  includeOwn: boolean,
): { membershipId?: { not: string } | { in: string[] } } {
  if (scope === "all") return includeOwn ? {} : { membershipId: { not: actorId } };
  return { membershipId: { in: includeOwn ? [actorId, ...scope] : [...scope] } };
}
