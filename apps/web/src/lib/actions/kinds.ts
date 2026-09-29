/**
 * The kinds of decision that can raise an action tile.
 *
 * A deliberate boundary: **this queue routes and chases decisions that
 * already exist.** Every kind here maps to an approval surface FlowHRMS already
 * had — attendance exceptions, leave, task proof. Nothing in this file
 * invents a new gate that work has to pass through.
 *
 * Which is why an ordinary check-in is absent. Thirty people checking in on
 * time raises nothing; the one who checked in from outside the permitted
 * area raises a tile, because that is the one a human has to rule on. A
 * product that pops a modal for the other twenty-nine gets its
 * notifications switched off in a week, and then the exception is missed
 * too (MODULES.md → Notifications; edge-cases.md → "alert fatigue").
 */

import type { ModuleKey } from "@/lib/catalog";

export const ACTION_KINDS = [
  "ATTENDANCE_EXCEPTION",
  "LEAVE_REQUEST",
  "TASK_PROOF",
  "EMPLOYEE_INVITE",
  // A redemption spends an employee's points on something the tenant
  // offered (PERFORMANCE-MODULE.md §D) — an approval surface by design:
  // handing over a reward is a human act, so a human confirms it.
  "REWARD_REDEMPTION",
  // An expense claim asks the company for money back (EXPENSES-MODULE.md
  // §11) — an approval surface by definition.
  "EXPENSE_CLAIM",
  // Going out on a field trip asks the reporting manager to approve
  // (FIELD-VISITS-MODULE.md §4). The trip never waits for the answer; a
  // declined trip is left out of travel claims.
  "FIELD_TRIP",
] as const;

export type ActionKind = (typeof ACTION_KINDS)[number];

/**
 * Can this be approved straight from the tile?
 *
 * Only where approving needs no further input. Leave is the instructive
 * exception: approving it requires choosing paid or unpaid, which changes
 * what someone is paid — so a one-tap Approve would be a decision made
 * without its consequence on screen, which is the one thing FlowHRMS does not
 * do (integrity pattern 1). Those open the full approval card instead.
 *
 * Rejecting is never inline: a rejection always needs a reason, and the
 * employee reads that reason word for word (Constitution §4).
 */
export const APPROVE_INLINE: Record<
  ActionKind,
  { allowed: boolean; because?: string }
> = {
  ATTENDANCE_EXCEPTION: { allowed: true },
  LEAVE_REQUEST: {
    allowed: false,
    because: "Approving leave means choosing paid or unpaid.",
  },
  TASK_PROOF: { allowed: true },
  // An invitation is not approved or rejected — it is chased. The tile
  // links to the person so an admin can resend or correct the address.
  EMPLOYEE_INVITE: { allowed: false, because: "Nothing to approve — chase or correct it." },
  // Approving means the reward is being HANDED OVER — a physical act the
  // approver should confirm from the fulfilment screen, not a tap made in
  // passing that leaves someone waiting for a voucher nobody gave them.
  REWARD_REDEMPTION: {
    allowed: false,
    because: "Approving confirms the reward was handed over.",
  },
  // Approving a claim means choosing the amount and, later, where it
  // settles — never a tap made in passing (EXPENSES-MODULE.md §11).
  EXPENSE_CLAIM: {
    allowed: false,
    because: "Approving means choosing the amount and where it settles.",
  },
  // Approving a trip needs nothing more than the tap; declining asks for
  // a reason, like every rejection, so it opens the trip.
  FIELD_TRIP: { allowed: true },
};

/** What the button that leaves the tile should say. */
export function openLabel(kind: ActionKind): string {
  switch (kind) {
    case "ATTENDANCE_EXCEPTION":
      return "Review";
    case "LEAVE_REQUEST":
      return "Review leave";
    case "TASK_PROOF":
      return "Review proof";
    case "EMPLOYEE_INVITE":
      return "Open profile";
    case "REWARD_REDEMPTION":
      return "Review redemption";
    case "EXPENSE_CLAIM":
      return "Review claim";
    case "FIELD_TRIP":
      return "Review trip";
  }
}

export function isActionKind(value: string): value is ActionKind {
  return (ACTION_KINDS as readonly string[]).includes(value);
}

/**
 * The module each kind belongs to. A tile whose module is disabled for the
 * tenant is not shown and cannot be decided (EXPENSES-MODULE.md §7) — the
 * queue never opens a door that module management has closed.
 */
export const MODULE_FOR_KIND: Record<ActionKind, ModuleKey> = {
  ATTENDANCE_EXCEPTION: "ATTENDANCE",
  LEAVE_REQUEST: "LEAVE",
  TASK_PROOF: "TASKS",
  EMPLOYEE_INVITE: "EMPLOYEES",
  REWARD_REDEMPTION: "PERFORMANCE",
  EXPENSE_CLAIM: "EXPENSES",
  FIELD_TRIP: "FIELD_VISITS",
};
