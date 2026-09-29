import { describe, expect, it } from "vitest";
import { PRIORITY, STATUS, statusLate, statusOverdueDays } from "@/lib/status";

/**
 * Status labels are FIXED strings (copy-deck.md §1). These tests pin them —
 * a failure here means product copy drifted from the approved deck.
 */
describe("fixed status labels", () => {
  it("matches the approved copy deck exactly", () => {
    expect(STATUS.present.label).toBe("Present");
    expect(STATUS.absent.label).toBe("Absent");
    expect(STATUS.onLeave.label).toBe("On Leave");
    expect(STATUS.halfDay.label).toBe("Half Day");
    expect(STATUS.pendingReview.label).toBe("Pending review");
    expect(STATUS.outsideArea.label).toBe("Outside area — needs approval");
    expect(STATUS.notRecorded.label).toBe("Not recorded");
    expect(STATUS.waitingToSend.label).toBe("Waiting to send");
    expect(STATUS.submittedForReview.label).toBe("Submitted for review");
    expect(STATUS.notAvailable.label).toBe("Not available");
  });

  it("every status carries a word and a tone", () => {
    for (const status of Object.values(STATUS)) {
      expect(status.label.length).toBeGreaterThan(0);
      expect(["success", "warning", "error", "info", "neutral"]).toContain(
        status.tone,
      );
    }
  });

  it("parameterised labels render the approved shape", () => {
    expect(statusLate(18).label).toBe("Late 18 min");
    expect(statusOverdueDays(2).label).toBe("Overdue 2 day");
  });

  it("priorities always carry the word", () => {
    expect(PRIORITY.high.label).toBe("High");
    expect(PRIORITY.medium.label).toBe("Medium");
    expect(PRIORITY.low.label).toBe("Low");
  });
});
