import { withoutOwn, type Decider } from "./approvals";

/**
 * Record scope — whose records a person may see and act on, applied before
 * any permission (USER-ROLES.md: managers "view and manage their reporting
 * tree"; the /admin/roles screen promises it). Pure, so every screen and
 * action draws the same line; lib/authz/record-scope.ts loads the rows.
 *
 * - Owner, Super Admin, Admin and HR run the whole company.
 * - Everyone else — Manager, Team Leader, Viewer, and any role a company
 *   adds — sees their team: whoever reports to them, directly or through
 *   others, plus the members of any department they head.
 *
 * A person is never in their own team. Lists add them back (seeing your
 * own records is fine); decisions do not, so a manager cannot approve
 * their own request by way of scope either.
 */

export const COMPANY_WIDE_ROLES: ReadonlySet<string> = new Set([
  "OWNER",
  "SUPER_ADMIN",
  "ADMIN",
  "HR",
]);

export function seesWholeCompany(roleKey: string): boolean {
  return COMPANY_WIDE_ROLES.has(roleKey);
}

export interface ScopeMember {
  id: string;
  reportingToId: string | null;
  departmentId: string | null;
}

/** An active department and its head (inactive ones confer nothing). */
export interface ScopeDepartment {
  id: string;
  headId: string | null;
}

/** "all", or the membership ids of the person's team (never themselves). */
export type RecordScope = "all" | ReadonlySet<string>;

export const OUTSIDE_TEAM = "That person isn't in your team.";

/**
 * Everyone `actorId` looks after: reports at any depth, plus members of the
 * departments they head. A reporting line that loops back on itself is
 * walked once — every person is visited at most once, so it cannot hang.
 */
export function teamOf(
  actorId: string,
  members: readonly ScopeMember[],
  departments: readonly ScopeDepartment[],
): Set<string> {
  const reportsOf = new Map<string, string[]>();
  for (const m of members) {
    if (!m.reportingToId) continue;
    const list = reportsOf.get(m.reportingToId);
    if (list) list.push(m.id);
    else reportsOf.set(m.reportingToId, [m.id]);
  }

  const team = new Set<string>();
  const queue = [actorId];
  while (queue.length > 0) {
    const next = queue.pop()!;
    for (const report of reportsOf.get(next) ?? []) {
      if (team.has(report)) continue;
      team.add(report);
      queue.push(report);
    }
  }

  const headed = new Set(departments.filter((d) => d.headId === actorId).map((d) => d.id));
  if (headed.size > 0) {
    for (const m of members) {
      if (m.departmentId && headed.has(m.departmentId)) team.add(m.id);
    }
  }

  team.delete(actorId);
  return team;
}

/**
 * The other direction: everyone who has `targetId` in their team — their
 * managers up the line, and the head of their department. Used to decide
 * which approvers a tile or bell about them should reach.
 */
export function supervisorsOf(
  targetId: string,
  members: readonly ScopeMember[],
  departments: readonly ScopeDepartment[],
): Set<string> {
  const byId = new Map(members.map((m) => [m.id, m]));
  const found = new Set<string>();
  let current = byId.get(targetId)?.reportingToId ?? null;
  while (current && !found.has(current)) {
    found.add(current);
    current = byId.get(current)?.reportingToId ?? null;
  }
  const departmentId = byId.get(targetId)?.departmentId;
  const head = departments.find((d) => d.id === departmentId)?.headId;
  if (head) found.add(head);
  found.delete(targetId);
  return found;
}

export function recordScope(input: {
  actor: { membershipId: string; roleKey: string };
  members: readonly ScopeMember[];
  departments: readonly ScopeDepartment[];
}): RecordScope {
  if (seesWholeCompany(input.actor.roleKey)) return "all";
  return teamOf(input.actor.membershipId, input.members, input.departments);
}

/** May the actor see this person's records? Their own, always. */
export function canSee(scope: RecordScope, actorId: string, targetId: string): boolean {
  return scope === "all" || targetId === actorId || scope.has(targetId);
}

/**
 * The membership ids a list may show — the team plus the actor — or null
 * when it is everyone. Feed it to `{ in: ids }` on the right column.
 */
export function visibleIds(scope: RecordScope, actorId: string): string[] | null {
  return scope === "all" ? null : [actorId, ...scope];
}

/**
 * Why the actor may not decide about this person, or null. Deciding needs
 * them in the team; being yourself is handled by the caller's own-request
 * rule first (approvals.ts), and otherwise reads as its own refusal.
 */
export function decisionScopeRefusal(
  scope: RecordScope,
  actorId: string,
  targetId: string,
): string | null {
  if (scope === "all" || scope.has(targetId)) return null;
  return targetId === actorId
    ? "You can't review your own work. Another approver has to."
    : OUTSIDE_TEAM;
}

/**
 * Where-clause fragment for a queue of things to decide: the team only,
 * and never your own unless you are an Owner (who is company-wide).
 */
export function decidableWhere(
  actor: Decider,
  scope: RecordScope,
): { membershipId?: { not: string } | { in: string[] } } {
  return scope === "all" ? withoutOwn(actor) : { membershipId: { in: [...scope] } };
}
