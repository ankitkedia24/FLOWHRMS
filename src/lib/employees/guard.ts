import { privilegeRank } from "@/lib/catalog";

/**
 * Who may change whom — pure, so the edit form, the Deactivate button and
 * the tests all apply the same rules (MODULE_GAP_AUDIT.md, security 1).
 *
 * The rules match the ones a designation change has always had:
 * 1. Not yourself — otherwise an admin removes the person who would object.
 * 2. Nobody with more access than you — HR must not suspend an Owner.
 * 3. Never the last active Owner — a company must keep someone who can run it.
 *
 * Equal access is allowed: co-owners manage each other, and so do two HR
 * people. Only "above you" is refused.
 */

export interface Actor {
  userId: string;
  roleKey: string;
}

export interface Person {
  userId: string;
  roleKey: string;
  status: string;
  name: string;
}

export const LAST_OWNER_MESSAGE =
  "This is the only owner. Make someone else an owner first, or the company would be left with nobody who can manage it.";

/**
 * Why `actor` may not move `person` from their status to `nextStatus`, or
 * null if they may. `otherActiveOwners` counts active owners other than the
 * person.
 */
export function statusChangeRefusal(input: {
  actor: Actor;
  person: Person;
  nextStatus: string;
  otherActiveOwners: number;
}): string | null {
  const { actor, person, nextStatus } = input;
  if (nextStatus === person.status) return null;
  if (person.userId === actor.userId) {
    return "You can't change your own status. Ask another owner or admin to do it.";
  }
  if (privilegeRank(person.roleKey) > privilegeRank(actor.roleKey)) {
    return `${person.name} has more access than you, so only someone above them can change their status.`;
  }
  if (
    person.roleKey === "OWNER" &&
    person.status === "ACTIVE" &&
    nextStatus !== "ACTIVE" &&
    input.otherActiveOwners === 0
  ) {
    return LAST_OWNER_MESSAGE;
  }
  return null;
}

/**
 * Would `personId` reporting to `managerId` close a loop — the manager
 * already reporting to the person, directly or through others?
 * `reportsTo` maps every membership id to its manager's id (or null).
 */
export function createsReportingLoop(
  personId: string,
  managerId: string | null,
  reportsTo: ReadonlyMap<string, string | null>,
): boolean {
  if (!managerId) return false;
  if (managerId === personId) return true;
  const seen = new Set<string>();
  let current: string | null | undefined = managerId;
  while (current && !seen.has(current)) {
    if (current === personId) return true;
    seen.add(current);
    current = reportsTo.get(current);
  }
  return false;
}
