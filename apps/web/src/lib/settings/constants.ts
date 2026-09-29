/**
 * Settings constants shared with client components.
 *
 * These live OUTSIDE `actions.ts` for a reason that cost a production
 * error: a `"use server"` module may only export async functions.
 * Exporting a value from one and importing it into a client component does
 * not fail to compile — `tsc` sees a perfectly good array, lint does not
 * model the boundary, and the build succeeds. It fails when the page
 * renders, with `TypeError: x.map is not a function`, because what crosses
 * the boundary is a server reference rather than the value.
 *
 * Rule: anything a client component reads belongs here. Only async actions
 * belong in actions.ts.
 *
 * The keys below are persisted in TenantPolicy rows. Renaming one silently
 * resets that setting for every tenant — change labels freely, keys never.
 */

/** Timezones a tenant may choose. Storage is always UTC. */
export const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "UTC",
] as const;

/** Notification settings (screen A18): event × channel, plus quiet hours. */
export const NOTIFICATION_EVENTS = [
  { key: "attendance_exception", label: "Attendance needs review" },
  { key: "leave_request", label: "Leave requested" },
  { key: "leave_decision", label: "Leave approved or rejected" },
  { key: "task_assigned", label: "Task assigned" },
  { key: "proof_submitted", label: "Proof submitted for review" },
  { key: "proof_decision", label: "Proof reviewed" },
  { key: "payslip_ready", label: "Payslip ready" },
] as const;

export const NOTIFICATION_CHANNELS = [
  { key: "in_app", label: "In-app", alwaysOn: true },
  { key: "push", label: "Push", alwaysOn: false },
  { key: "email", label: "Email", alwaysOn: false },
  { key: "whatsapp", label: "WhatsApp", alwaysOn: false },
  { key: "sms", label: "SMS", alwaysOn: false },
] as const;

export interface NotificationPolicy {
  /** "event.channel" → enabled. Absent means off. */
  matrix: Record<string, boolean>;
  quietHours: { enabled: boolean; fromMinutes: number; toMinutes: number };
}
