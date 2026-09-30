import "server-only";

import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import type { AppSession } from "@/lib/auth/types";
import { approversInScope } from "@/lib/authz/record-scope";

/**
 * In-app notifications (MODULES.md: Notifications is a CORE module).
 *
 * Phase 2 delivers the in-app channel only. Push, email, WhatsApp and SMS
 * are provider-backed and stay behind their feature flags until providers
 * are configured — a channel that is off is shown as "Off" in settings and
 * is never silently failed (user-flows.md §6).
 *
 * Titles are ≤60 characters and never guilt-framed: state the fact and the
 * next action (voice-and-microcopy.md §10).
 */

interface NotificationInput {
  tenantId: string;
  userId: string;
  title: string;
  body?: string;
  href?: string;
}

async function create(input: NotificationInput): Promise<void> {
  if (devFixtureOffline()) return; // dev preview session has no database
  await getDb().notification.create({ data: input });
}

/**
 * Active holders of `permission` who may decide about the session's own
 * request: company-wide roles, and managers only when it is someone in
 * their team (lib/authz/scope.ts) — the same people the tile reaches.
 */
async function approversOfOwnRequest(
  session: AppSession,
  permission: "attendance.review" | "leave.approve",
): Promise<Array<{ userId: string }>> {
  const holders = await getDb().tenantMembership.findMany({
    where: {
      tenantId: session.tenant.id,
      status: "ACTIVE",
      role: { permissions: { some: { permission: { key: permission } } } },
    },
    select: { id: true, userId: true, role: { select: { key: true } } },
  });
  return approversInScope(
    session.tenant.id,
    session.membership.id,
    holders.map((h) => ({ membershipId: h.id, roleKey: h.role.key, userId: h.userId })),
  );
}

/** Notify reviewers that an attendance exception needs a decision. */
async function attendanceException(
  session: AppSession,
  recordId: string,
): Promise<void> {
  if (devFixtureOffline()) return;

  // Everyone in the tenant whose role can review attendance.
  const reviewers = await approversOfOwnRequest(session, "attendance.review");

  await Promise.all(
    reviewers
      .filter((r) => r.userId !== session.user.id)
      .map((r) =>
        create({
          tenantId: session.tenant.id,
          userId: r.userId,
          title: "Attendance needs your review",
          body: `${session.user.displayName} checked in outside the permitted area.`,
          href: `/admin/attendance?record=${recordId}`,
        }),
      ),
  );
}

/** Tell the employee what their manager decided. */
async function attendanceDecision(
  session: AppSession,
  userId: string,
  decision: "APPROVED" | "REJECTED" | "DETAILS_REQUESTED",
  reason?: string,
): Promise<void> {
  const title =
    decision === "APPROVED"
      ? "Attendance approved"
      : decision === "REJECTED"
        ? "Attendance needs a correction"
        : "Your manager asked for details";
  await create({
    tenantId: session.tenant.id,
    userId,
    title,
    body: reason,
    href: "/attendance",
  });
}

/** Leave decision — or the approver's question — for the requester. */
async function leaveDecision(
  session: AppSession,
  userId: string,
  decision: "APPROVED" | "REJECTED" | "DETAILS_REQUESTED",
  dates: string,
  reason?: string,
): Promise<void> {
  await create({
    tenantId: session.tenant.id,
    userId,
    title:
      decision === "DETAILS_REQUESTED"
        ? `Question about your leave: ${dates}`
        : `Leave ${decision === "APPROVED" ? "approved" : "rejected"}: ${dates}`,
    body: reason,
    href: "/leave",
  });
}

/** A new leave request for approvers. */
async function leaveRequested(
  session: AppSession,
  requestId: string,
  dates: string,
): Promise<void> {
  if (devFixtureOffline()) return;
  const approvers = await approversOfOwnRequest(session, "leave.approve");
  await Promise.all(
    approvers
      .filter((a) => a.userId !== session.user.id)
      .map((a) =>
        create({
          tenantId: session.tenant.id,
          userId: a.userId,
          title: `Leave request: ${dates}`,
          body: `From ${session.user.displayName}.`,
          href: `/admin/leave?request=${requestId}`,
        }),
      ),
  );
}

/** A task was assigned to someone. */
async function taskAssigned(
  session: AppSession,
  userId: string,
  taskTitle: string,
  taskId: string,
): Promise<void> {
  await create({
    tenantId: session.tenant.id,
    userId,
    title: `New task from ${session.user.displayName.split(/\s+/)[0]}`,
    body: taskTitle,
    href: `/tasks/${taskId}`,
  });
}

/** Proof submitted — for the task creator. */
async function proofSubmitted(
  session: AppSession,
  userId: string,
  taskTitle: string,
  taskId: string,
): Promise<void> {
  await create({
    tenantId: session.tenant.id,
    userId,
    title: "Proof submitted for review",
    body: taskTitle,
    href: `/admin/tasks/${taskId}`,
  });
}

/** Proof decision — for the assignee. */
async function proofDecision(
  session: AppSession,
  userId: string,
  taskTitle: string,
  taskId: string,
  decision: "APPROVED" | "REJECTED" | "DETAILS_REQUESTED",
  reason?: string,
): Promise<void> {
  const title =
    decision === "APPROVED"
      ? `Proof approved: ${taskTitle}`
      : decision === "REJECTED"
        ? `Proof needs redoing: ${taskTitle}`
        : `Details requested: ${taskTitle}`;
  await create({
    tenantId: session.tenant.id,
    userId,
    title: title.slice(0, 60),
    body: reason,
    href: `/tasks/${taskId}`,
  });
}

/**
 * A performance moment — badge, level, streak milestone. A bell notice,
 * NEVER an action tile: nothing here needs a decision
 * (PERFORMANCE-MODULE.md §B).
 */
async function performanceMoment(
  session: AppSession,
  userId: string,
  title: string,
  body?: string,
): Promise<void> {
  await create({
    tenantId: session.tenant.id,
    userId,
    title: title.slice(0, 60),
    body,
    href: "/performance",
  });
}

/**
 * An expense claim moved — approved, partly approved, rejected, settled.
 * The reason travels verbatim (EXPENSES-MODULE.md §11).
 */
async function expenseUpdate(
  session: AppSession,
  userId: string,
  title: string,
  body: string | undefined,
  href: string,
): Promise<void> {
  await create({
    tenantId: session.tenant.id,
    userId,
    title: title.slice(0, 60),
    body,
    href,
  });
}

/**
 * A field visit tap, or a trip decision (FIELD-VISITS-MODULE.md §4). A bell
 * notice only: the one decision in field visits — approving a trip — is
 * an action tile, raised separately.
 */
async function fieldVisit(
  tenantId: string,
  userIds: readonly string[],
  title: string,
  body: string | undefined,
  href: string,
): Promise<void> {
  await Promise.all(
    [...new Set(userIds)].map((userId) =>
      create({ tenantId, userId, title: title.slice(0, 60), body, href }),
    ),
  );
}

/**
 * The person's own password was changed. Sent to them, not to admins: if it
 * was them, it is confirmation; if it wasn't, it is the alarm.
 */
async function passwordChanged(session: AppSession, at: Date): Promise<void> {
  const when = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: session.tenant.timezone,
  }).format(at);
  await create({
    tenantId: session.tenant.id,
    userId: session.user.id,
    title: "Your password was changed",
    body: `Changed ${when}. If this wasn't you, change it again now and tell your admin.`,
    href: "/account",
  });
}

export const notify = {
  passwordChanged,
  fieldVisit,
  attendanceException,
  attendanceDecision,
  leaveDecision,
  leaveRequested,
  taskAssigned,
  proofSubmitted,
  proofDecision,
  performanceMoment,
  expenseUpdate,
};

/** Unread count for the top-bar bell. */
export async function unreadNotificationCount(
  tenantId: string,
  userId: string,
): Promise<number> {
  if (devFixtureOffline()) return 0;
  return getDb().notification.count({
    where: { tenantId, userId, readAt: null },
  });
}
