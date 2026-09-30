/**
 * Status is a data contract, not a colour (implementation guide §4,
 * design decision D-005). The renderer always prints `label`; rendering a
 * status as colour alone is impossible by construction.
 *
 * Labels are FIXED strings from copy-deck.md §1 — do not paraphrase.
 */

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

export interface Status {
  key: string;
  label: string;
  tone: StatusTone;
}

const s = (key: string, label: string, tone: StatusTone): Status => ({
  key,
  label,
  tone,
});

/** Fixed, non-parameterised status labels (copy-deck.md §1). */
export const STATUS = {
  present: s("present", "Present", "success"),
  absent: s("absent", "Absent", "error"),
  onLeave: s("on-leave", "On Leave", "info"),
  halfDay: s("half-day", "Half Day", "info"),
  pendingReview: s("pending-review", "Pending review", "neutral"),
  outsideArea: s(
    "outside-area",
    "Outside area — needs approval",
    "warning",
  ),
  exempted: s("exempted", "Exempted", "success"),
  notRecorded: s("not-recorded", "Not recorded", "neutral"),
  approved: s("approved", "Approved", "success"),
  rejected: s("rejected", "Rejected", "error"),
  waitingToSend: s("waiting-to-send", "Waiting to send", "neutral"),
  notStarted: s("not-started", "Not started", "neutral"),
  inProgress: s("in-progress", "In progress", "info"),
  submittedForReview: s(
    "submitted-for-review",
    "Submitted for review",
    "info",
  ),
  completed: s("completed", "Completed", "success"),
  overdue: s("overdue", "Overdue", "error"),
  draft: s("draft", "Draft", "neutral"),
  ready: s("ready", "Ready", "success"),
  locked: s("locked", "Locked", "neutral"),
  paid: s("paid", "Paid", "success"),
  notReady: s("not-ready", "Not ready", "neutral"),
  verified: s("verified", "Verified", "success"),
  needsReview: s("needs-review", "Needs review", "warning"),
  active: s("active", "Active", "success"),
  inactive: s("inactive", "Inactive", "neutral"),
  enabled: s("enabled", "Enabled", "success"),
  disabled: s("disabled", "Disabled", "neutral"),
  notAvailable: s("not-available", "Not available", "neutral"),
  /// A catalog module with nothing behind it (catalog `built: false`).
  notBuilt: s("not-built", "Not built yet", "neutral"),
  /// Invitation lifecycle (Employee Invite & Onboarding).
  invitePending: s("invite-pending", "Pending", "info"),
  inviteAccepted: s("invite-accepted", "Accepted", "success"),
  inviteExpired: s("invite-expired", "Expired", "warning"),
  inviteRevoked: s("invite-revoked", "Revoked", "neutral"),
  /// An employee record that exists but cannot yet sign in.
  inviteNotSent: s("invite-not-sent", "Not invited", "neutral"),
  /// Added, but the company's invitations wait for its owner to confirm
  /// their email; it goes out by itself when they do.
  inviteHeld: s("invite-held", "Not sent — confirm your email", "warning"),
  snoozed: s("snoozed", "Snoozed", "neutral"),
  /// Expense claims (EXPENSES-MODULE.md §3) and the approver-facing flags.
  submitted: s("submitted", "Submitted", "info"),
  partlyApproved: s("partly-approved", "Partly approved", "warning"),
  withdrawn: s("withdrawn", "Withdrawn", "neutral"),
  settled: s("settled", "Settled", "success"),
  lateClaim: s("late-claim", "Late claim", "warning"),
  overCap: s("over-cap", "Over the cap", "warning"),
  possibleDuplicate: s("possible-duplicate", "Possible duplicate", "warning"),
} as const;

/** Parameterised fixed labels (copy-deck.md §1). */
export const statusLate = (minutes: number): Status =>
  s("late", `Late ${minutes} min`, "warning");

export const statusOverdueDays = (days: number): Status =>
  s("overdue-days", `Overdue ${days} day`, "error");

/** Priority chips always carry the word (component-specifications.md §11). */
export const PRIORITY = {
  high: s("priority-high", "High", "error"),
  medium: s("priority-medium", "Medium", "warning"),
  low: s("priority-low", "Low", "neutral"),
} as const;
