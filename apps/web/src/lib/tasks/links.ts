import { canSee, type RecordScope } from "@/lib/authz/scope";

/**
 * Where a manager reviews one task's proof.
 *
 * There is no page per task in the admin area: proof is reviewed in the
 * queue on /admin/tasks. Each card in that queue carries proofAnchorId(), so
 * the link from the bell and the dashboard tile lands on the right card. If
 * the proof has already been decided the card is gone and the link simply
 * opens the task list — never a missing page. Pure, so the notification,
 * the action tile and the queue agree.
 */
export function proofAnchorId(taskId: string): string {
  return `proof-${taskId}`;
}

export function proofReviewHref(taskId: string): string {
  return `/admin/tasks#${proofAnchorId(taskId)}`;
}

/**
 * Where an old /admin/tasks/{id} link lands (Hardening 7E.2). Bells and
 * tiles written before batch 5 point at a per-task admin page that never
 * existed, and those rows stay in the database; the route now exists only
 * to forward them. A task the person may see — the task list's rule: their
 * team's, their own, or one they set — opens at its proof card; anything
 * else, missing or not, opens the task list, so the link never says
 * whether a task they can't see exists.
 */
export function legacyTaskHref(input: {
  taskId: string;
  /** Null when there is no such task in this company. */
  task: { assigneeId: string; createdById: string } | null;
  scope: RecordScope;
  actorId: string;
}): string {
  const { task } = input;
  const visible =
    task !== null &&
    (canSee(input.scope, input.actorId, task.assigneeId) || task.createdById === input.actorId);
  return visible ? proofReviewHref(input.taskId) : "/admin/tasks";
}
