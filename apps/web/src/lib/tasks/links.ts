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
