import { describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS,
  WAITING_LABEL,
  classifyOutcome,
  describeQueue,
  isQueueable,
  retryDelayMs,
  sortQueue,
  summariseSync,
  type QueuedAction,
  type SendOutcome,
} from "@/lib/offline/queue";

/**
 * The offline promise: an action taken without a connection is kept on
 * the device and sent later with its ORIGINAL time. These tests pin the
 * parts of that promise that can be broken silently.
 */
const action = (
  over: Partial<QueuedAction> & Pick<QueuedAction, "id" | "kind" | "capturedAt">,
): QueuedAction => ({ payload: {}, attempts: 0, ...over });

describe("queue order", () => {
  it("sends oldest first, so times are recorded in the order they happened", () => {
    const sorted = sortQueue([
      action({ id: "b", kind: "leaveRequest", capturedAt: "2026-08-09T10:00:00Z" }),
      action({ id: "a", kind: "leaveRequest", capturedAt: "2026-08-09T09:00:00Z" }),
    ]);
    expect(sorted.map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("sends a check-in before a check-out captured at the same moment", () => {
    const sorted = sortQueue([
      action({ id: "out", kind: "checkOut", capturedAt: "2026-08-09T09:00:00Z" }),
      action({ id: "in", kind: "checkIn", capturedAt: "2026-08-09T09:00:00Z" }),
    ]);
    // A check-out arriving first would be refused — there is nothing to
    // close yet.
    expect(sorted.map((a) => a.id)).toEqual(["in", "out"]);
  });

  it("is deterministic for identical timestamps and kinds", () => {
    const one = sortQueue([
      action({ id: "zzz", kind: "taskProof", capturedAt: "2026-08-09T09:00:00Z" }),
      action({ id: "aaa", kind: "taskProof", capturedAt: "2026-08-09T09:00:00Z" }),
    ]);
    const two = sortQueue([
      action({ id: "aaa", kind: "taskProof", capturedAt: "2026-08-09T09:00:00Z" }),
      action({ id: "zzz", kind: "taskProof", capturedAt: "2026-08-09T09:00:00Z" }),
    ]);
    expect(one.map((a) => a.id)).toEqual(["aaa", "zzz"]);
    expect(two.map((a) => a.id)).toEqual(["aaa", "zzz"]);
  });

  it("does not mutate the queue it was given", () => {
    const queue = [
      action({ id: "b", kind: "checkIn", capturedAt: "2026-08-09T10:00:00Z" }),
      action({ id: "a", kind: "checkIn", capturedAt: "2026-08-09T09:00:00Z" }),
    ];
    sortQueue(queue);
    expect(queue.map((a) => a.id)).toEqual(["b", "a"]);
  });
});

describe("what happens to an item after an attempt", () => {
  it("removes an item the server accepted", () => {
    const result = classifyOutcome({ status: "sent" }, 0);
    expect(result).toEqual({ remove: true, failedPermanently: false });
  });

  it("removes an item the server already had, without complaining", () => {
    // The idempotent path returns "sent" with a note, not an error.
    const result = classifyOutcome(
      { status: "sent", message: "This is already recorded for today." },
      2,
    );
    expect(result.remove).toBe(true);
  });

  it("stops retrying something the server refused, and flags it", () => {
    // Retrying a refusal forever would hide it from the person.
    const result = classifyOutcome(
      { status: "rejected", error: "Add a reason." },
      0,
    );
    expect(result).toEqual({ remove: false, failedPermanently: true });
  });

  it("keeps retrying a transport failure", () => {
    const result = classifyOutcome({ status: "retry", error: "offline" }, 0);
    expect(result.remove).toBe(false);
    expect(result.failedPermanently).toBe(false);
  });

  it("gives up after the attempt limit rather than looping forever", () => {
    const result = classifyOutcome(
      { status: "retry", error: "offline" },
      MAX_ATTEMPTS - 1,
    );
    expect(result.failedPermanently).toBe(true);
  });
});

describe("retry backoff", () => {
  it("backs off as attempts grow", () => {
    expect(retryDelayMs(0)).toBe(1_000);
    expect(retryDelayMs(1)).toBe(2_000);
    expect(retryDelayMs(3)).toBe(8_000);
  });

  it("caps so a long outage still recovers promptly", () => {
    expect(retryDelayMs(20)).toBe(30_000);
  });

  it("treats a negative attempt count as the first attempt", () => {
    expect(retryDelayMs(-3)).toBe(1_000);
  });
});

describe("what the person is told after reconnecting", () => {
  const sent: SendOutcome = { status: "sent" };
  const rejected: SendOutcome = { status: "rejected", error: "nope" };

  it("says nothing when there was nothing to send", () => {
    const summary = summariseSync([]);
    expect(summary.message).toBeNull();
    expect(summary.variant).toBeNull();
  });

  it("is one summary line, not one message per item", () => {
    expect(summariseSync([sent, sent]).message).toBe("2 items sent.");
  });

  it("uses the singular for a single item", () => {
    expect(summariseSync([sent]).message).toBe("1 item sent.");
  });

  it("says what to do next when something was refused", () => {
    const summary = summariseSync([rejected]);
    expect(summary.variant).toBe("error");
    expect(summary.message).toContain("Open it to see why");
  });

  it("reports both halves of a mixed run honestly", () => {
    const summary = summariseSync([sent, sent, rejected]);
    expect(summary.sent).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.message).toBe(
      "2 sent, 1 couldn't be sent. Open them to see why.",
    );
    expect(summary.variant).toBe("error");
  });

  it("does not count still-retrying items as sent or failed", () => {
    const summary = summariseSync([{ status: "retry", error: "offline" }]);
    expect(summary.sent).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.message).toBeNull();
  });
});

describe("queue description", () => {
  it("says nothing for an empty queue", () => {
    expect(describeQueue(0)).toBeNull();
    expect(describeQueue(-1)).toBeNull();
  });

  it("uses plain wording with the count", () => {
    expect(describeQueue(1)).toBe("1 item is waiting to send.");
    expect(describeQueue(3)).toBe("3 items are waiting to send.");
  });

  it("uses the approved chip label", () => {
    expect(WAITING_LABEL).toBe("Waiting to send");
  });
});

describe("what may be queued", () => {
  it("queues the four employee actions the design promises", () => {
    expect(isQueueable("checkIn")).toBe(true);
    expect(isQueueable("checkOut")).toBe(true);
    expect(isQueueable("leaveRequest")).toBe(true);
    expect(isQueueable("taskProof")).toBe(true);
  });

  it("never queues an approval, payroll or configuration change", () => {
    // FlowHRMS must not accept a decision it cannot guarantee.
    expect(isQueueable("approveException")).toBe(false);
    expect(isQueueable("approvePayroll")).toBe(false);
    expect(isQueueable("disableModule")).toBe(false);
  });
});
