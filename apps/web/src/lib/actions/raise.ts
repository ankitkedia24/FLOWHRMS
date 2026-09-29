import "server-only";

import type { AppSession } from "@/lib/auth/types";
import { raiseActionRequest, resolveActionRequest } from "./service";

/**
 * Thin wrappers so each event source raises its tile in one line, with the
 * subject type spelled once. The strings here are the tile's whole content
 * — they are written at the moment the event happens and never recomputed,
 * so a tile cannot describe something different from what was recorded.
 *
 * These sit BESIDE the existing `notify.*` calls rather than replacing
 * them. The bell records that a thing happened; the tile asks for the
 * decision. Collapsing the two would mean either losing the history or
 * nagging about things nobody has to decide.
 */

export const SUBJECT = {
  attendance: "attendance_record",
  leave: "leave_request",
  taskProof: "task_proof",
  invite: "employee_invite",
} as const;

export async function raiseAttendanceException(
  session: AppSession,
  recordId: string,
  membershipId: string,
  employeeName: string,
  detail: string,
): Promise<void> {
  await raiseActionRequest({
    tenantId: session.tenant.id,
    kind: "ATTENDANCE_EXCEPTION",
    subjectType: SUBJECT.attendance,
    subjectId: recordId,
    aboutMembershipId: membershipId,
    title: `${employeeName} — attendance needs a decision`,
    body: detail,
    href: `/admin/attendance?record=${recordId}`,
    actorUserId: session.user.id,
  });
}

export async function raiseLeaveRequest(
  session: AppSession,
  requestId: string,
  membershipId: string,
  employeeName: string,
  dates: string,
): Promise<void> {
  await raiseActionRequest({
    tenantId: session.tenant.id,
    kind: "LEAVE_REQUEST",
    subjectType: SUBJECT.leave,
    subjectId: requestId,
    aboutMembershipId: membershipId,
    title: `${employeeName} — leave request`,
    body: dates,
    href: `/admin/leave?request=${requestId}`,
    actorUserId: session.user.id,
  });
}

export async function raiseTaskProof(
  session: AppSession,
  taskId: string,
  assigneeMembershipId: string,
  employeeName: string,
  taskTitle: string,
): Promise<void> {
  await raiseActionRequest({
    tenantId: session.tenant.id,
    kind: "TASK_PROOF",
    subjectType: SUBJECT.taskProof,
    subjectId: taskId,
    aboutMembershipId: assigneeMembershipId,
    title: `${employeeName} — proof to review`,
    body: taskTitle,
    href: `/admin/tasks/${taskId}`,
    actorUserId: session.user.id,
  });
}

export async function clearActionRequest(
  session: AppSession,
  subjectType: string,
  subjectId: string,
  resolution: string,
): Promise<void> {
  await resolveActionRequest({
    tenantId: session.tenant.id,
    subjectType,
    subjectId,
    resolvedByUserId: session.user.id,
    resolution,
  });
}
