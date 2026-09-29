import type { PermissionKey } from "@/lib/catalog";
import type { ActionKind } from "./kinds";

/**
 * Who gets asked to decide.
 *
 * The rule the user asked for is "the admin and the respective department
 * head". The rule as implemented adds one constraint: **a tile only reaches
 * someone who can actually act on it.** Sending an Approve button to a
 * department head whose role lacks `leave.approve` produces a button that
 * fails when pressed, which is worse than not sending it — so the head is
 * included by virtue of being the head, but still filtered by permission,
 * and the department screen warns an owner when that filter is biting.
 *
 * Two people are always excluded: whoever raised the request, and whoever
 * it is about. Nobody approves their own leave, even if they run the
 * department (Product Constitution §5).
 *
 * Pure. The database query that produces `candidates` lives in service.ts.
 */

export interface AudienceCandidate {
  userId: string;
  membershipId: string;
  displayName: string;
  /** Holds the permission that decides this kind of request. */
  canDecide: boolean;
  /** Heads the department the request is about. */
  isDepartmentHead: boolean;
}

export interface Recipient {
  userId: string;
  /** Shown on the tile so nobody wonders why it reached them. */
  reason: string;
}

export interface AudienceInput {
  candidates: AudienceCandidate[];
  /** Who raised it — never asked to decide their own request. */
  actorUserId?: string | null;
  /** Whose work it concerns — never asked to decide about themselves. */
  aboutUserId?: string | null;
  /** For the head's reason line: "You are the head of Dispatch." */
  departmentName?: string | null;
}

export function resolveAudience(input: AudienceInput): Recipient[] {
  const excluded = new Set(
    [input.actorUserId, input.aboutUserId].filter(Boolean) as string[],
  );

  const seen = new Set<string>();
  const recipients: Recipient[] = [];

  // Department heads first: their reason is the more specific one, and a
  // person who is both head and admin should be told the useful thing.
  const ordered = [...input.candidates].sort(
    (a, b) => Number(b.isDepartmentHead) - Number(a.isDepartmentHead),
  );

  for (const c of ordered) {
    if (excluded.has(c.userId) || seen.has(c.userId) || !c.canDecide) continue;
    seen.add(c.userId);
    recipients.push({
      userId: c.userId,
      reason:
        c.isDepartmentHead && input.departmentName
          ? `You are the head of ${input.departmentName}.`
          : "You handle approvals for this company.",
    });
  }

  return recipients;
}

/**
 * Which permission decides each kind. Single source, so the tile audience
 * and the screen that actually performs the decision can never disagree.
 */
export const DECIDING_PERMISSION: Record<ActionKind, PermissionKey> = {
  ATTENDANCE_EXCEPTION: "attendance.review",
  LEAVE_REQUEST: "leave.approve",
  TASK_PROOF: "tasks.manage",
  EMPLOYEE_INVITE: "employees.manage",
  // Handing over a reward is a people decision, and employees.manage is
  // the permission that already marks who makes those.
  REWARD_REDEMPTION: "employees.manage",
  // Approving spend is its own authority (EXPENSES-MODULE.md §5).
  EXPENSE_CLAIM: "expenses.approve",
  // The reporting manager decides by being the reporting manager
  // (FIELD-VISITS-MODULE.md §4); this is who else may, when there is none.
  FIELD_TRIP: "fieldvisits.view",
};

/**
 * When a department has a head who cannot act, an owner should hear about
 * it while looking at the department — not discover it as silence.
 */
export function describeHeadGap(input: {
  departmentName: string;
  headName: string | null;
  headCanDecideAnything: boolean;
}): string | null {
  if (!input.headName) {
    return `${input.departmentName} has no head, so approvals for this team go to admins only.`;
  }
  if (!input.headCanDecideAnything) {
    return `${input.headName} heads ${input.departmentName} but their role can't approve anything, so requests go to admins only. Change their role to involve them.`;
  }
  return null;
}
