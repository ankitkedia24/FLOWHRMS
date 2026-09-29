/**
 * Offline queue logic — pure functions, no storage, no network.
 *
 * The promise this keeps (empty-loading-error-states.md §5, edge-cases.md):
 * a check-in, check-out, field visit tap, leave request or task proof made
 * without a connection is confirmed locally, kept on the device, and sent later
 * **using its original capture time**. Never lost, never silently re-timed.
 *
 * Everything here is deterministic so the parts that matter — ordering,
 * what counts as retryable, and what the person is told afterwards — can
 * be tested without a browser.
 */

export type QueuedKind = "checkIn" | "fieldTap" | "checkOut" | "leaveRequest" | "taskProof";

export interface QueuedAction<TPayload = unknown> {
  /** Client-generated; doubles as the server-side idempotency key. */
  id: string;
  kind: QueuedKind;
  payload: TPayload;
  /** Original device time, ISO. Sent to the server and never rewritten. */
  capturedAt: string;
  attempts: number;
  lastError?: string;
  /** Set once the server has refused it for good. */
  failedPermanently?: boolean;
}

/** Give up after this many tries and tell the person plainly. */
export const MAX_ATTEMPTS = 5;

/** What the person sees while an item waits (copy-deck.md §1). */
export const WAITING_LABEL = "Waiting to send";

/**
 * Oldest first. Attendance before everything else on the same timestamp:
 * a check-out that arrives before its check-in would be rejected, and a
 * day's attendance is the record other things hang off. Field visit taps
 * sit inside the day, so between the check-in and the check-out.
 */
const KIND_ORDER: Record<QueuedKind, number> = {
  checkIn: 0,
  fieldTap: 1,
  checkOut: 2,
  taskProof: 3,
  leaveRequest: 4,
};

export function sortQueue<T>(
  actions: readonly QueuedAction<T>[],
): QueuedAction<T>[] {
  return [...actions].sort((a, b) => {
    if (a.capturedAt !== b.capturedAt) {
      return a.capturedAt < b.capturedAt ? -1 : 1;
    }
    if (KIND_ORDER[a.kind] !== KIND_ORDER[b.kind]) {
      return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    }
    return a.id.localeCompare(b.id);
  });
}

export type SendOutcome =
  /** The server accepted it (or had already recorded it). */
  | { status: "sent"; message?: string }
  /** The server refused it for a reason retrying will not change. */
  | { status: "rejected"; error: string }
  /** Transport failed; try again later. */
  | { status: "retry"; error: string };

/**
 * Decide what to do with a server response.
 *
 * An action that the server *rejects* must leave the queue — retrying a
 * refusal forever would silently hide it from the person. Only transport
 * failures are retried.
 */
export function classifyOutcome(outcome: SendOutcome, attempts: number): {
  remove: boolean;
  failedPermanently: boolean;
} {
  if (outcome.status === "sent") {
    return { remove: true, failedPermanently: false };
  }
  if (outcome.status === "rejected") {
    return { remove: false, failedPermanently: true };
  }
  // Transport failure: keep trying, but not forever.
  const exhausted = attempts + 1 >= MAX_ATTEMPTS;
  return { remove: false, failedPermanently: exhausted };
}

/** Wait before retrying, in ms. Capped so a long outage stays responsive. */
export function retryDelayMs(attempts: number): number {
  return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempts));
}

export interface SyncSummary {
  sent: number;
  failed: number;
  /** One line for the reconnect toast — never a per-item barrage. */
  message: string | null;
  variant: "success" | "error" | null;
}

/**
 * One summary after a sync run (empty-loading-error-states.md §5:
 * "a single summary toast confirms").
 */
export function summariseSync(
  outcomes: readonly SendOutcome[],
): SyncSummary {
  const sent = outcomes.filter((o) => o.status === "sent").length;
  const failed = outcomes.filter((o) => o.status === "rejected").length;

  if (sent === 0 && failed === 0) {
    return { sent: 0, failed: 0, message: null, variant: null };
  }
  if (failed === 0) {
    return {
      sent,
      failed,
      message: sent === 1 ? "1 item sent." : `${sent} items sent.`,
      variant: "success",
    };
  }
  if (sent === 0) {
    return {
      sent,
      failed,
      message:
        failed === 1
          ? "1 item couldn't be sent. Open it to see why."
          : `${failed} items couldn't be sent. Open them to see why.`,
      variant: "error",
    };
  }
  return {
    sent,
    failed,
    message: `${sent} sent, ${failed} couldn't be sent. Open them to see why.`,
    variant: "error",
  };
}

/** Plain wording for a queue count — used by the offline bar. */
export function describeQueue(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? "1 item is waiting to send."
    : `${count} items are waiting to send.`;
}

/**
 * Whether a kind may be queued at all. Admin work — approvals, payroll,
 * configuration — is deliberately NOT queued: FlowHRMS will not accept a
 * decision it cannot guarantee (implementation guide §7).
 */
export function isQueueable(kind: string): kind is QueuedKind {
  return (
    kind === "checkIn" ||
    kind === "fieldTap" ||
    kind === "checkOut" ||
    kind === "leaveRequest" ||
    kind === "taskProof"
  );
}
