import { describe, expect, it } from "vitest";
import type { WorkCalendar } from "@/lib/attendance/calendar";
import {
  attendanceTreatment,
  summariseAttendance,
  undecidedAttendanceBlocker,
} from "@/lib/payroll/summary";

/**
 * Hardening batch 4.1 — payroll counts only decided attendance.
 * Owner decision: REJECTED is not a present day (the absent-day rules then
 * apply); PENDING / DETAILS_REQUESTED block Calculate and Approve; records
 * that never needed review count exactly as before.
 */

const d = (key: string) => new Date(`${key}T00:00:00.000Z`);
const SUNDAY_OFF: WorkCalendar = { weeklyOffDays: [0], holidays: [] };
// September 2026: 30 days, 4 Sundays → 26 working days.
const SEPT = { periodStart: d("2026-09-01"), periodEnd: d("2026-09-30") };

function record(key: string, reviewStatus?: string, lateMinutes = 0) {
  return {
    workDate: d(key),
    checkInAt: new Date(`${key}T04:00:00.000Z`),
    lateMinutes,
    exemptionStatus: "NONE",
    ...(reviewStatus === undefined ? {} : { reviewStatus }),
  };
}

function summarise(records: ReturnType<typeof record>[]) {
  return summariseAttendance({
    ...SEPT,
    calendar: SUNDAY_OFF,
    weeklyOffDays: [0],
    records,
    leave: [],
  });
}

describe("attendanceTreatment", () => {
  it("counts records that never needed review, and approved ones", () => {
    expect(attendanceTreatment("NONE")).toBe("COUNTS");
    expect(attendanceTreatment("APPROVED")).toBe("COUNTS");
    expect(attendanceTreatment(undefined)).toBe("COUNTS");
    expect(attendanceTreatment(null)).toBe("COUNTS");
  });

  it("treats a rejected record as not counting", () => {
    expect(attendanceTreatment("REJECTED")).toBe("REJECTED");
  });

  it("treats pending and details-requested as undecided", () => {
    expect(attendanceTreatment("PENDING")).toBe("UNDECIDED");
    expect(attendanceTreatment("DETAILS_REQUESTED")).toBe("UNDECIDED");
  });
});

describe("present and absent days by review status", () => {
  it("counts a record that never needed review as present, exactly as before", () => {
    const withStatus = summarise([record("2026-09-01", "NONE"), record("2026-09-02", "APPROVED")]);
    const without = summarise([record("2026-09-01"), record("2026-09-02")]);
    expect(withStatus.presentDays).toBe(2);
    expect(withStatus.absentDays).toBe(24);
    expect(without).toEqual(withStatus);
  });

  it("does not count a rejected record as present — the day is absent", () => {
    const s = summarise([record("2026-09-01", "NONE"), record("2026-09-02", "REJECTED")]);
    expect(s.presentDays).toBe(1);
    expect(s.absentDays).toBe(25);
  });

  it("does not count a rejected record late either, so the day is not charged twice", () => {
    const s = summarise([record("2026-09-01", "REJECTED", 40), record("2026-09-02", "NONE", 15)]);
    expect(s.lateDays).toBe(1);
    expect(s.lateMinutes).toBe(15);
  });

  it("shows an undecided record as recorded in the preview (the run is blocked meanwhile)", () => {
    const s = summarise([record("2026-09-01", "PENDING"), record("2026-09-02", "DETAILS_REQUESTED")]);
    expect(s.presentDays).toBe(2);
    expect(s.absentDays).toBe(24);
  });

  it("never makes a rejected check-in on a weekly off an absence", () => {
    // 6 Sept 2026 is a Sunday.
    const s = summarise([record("2026-09-06", "REJECTED")]);
    expect(s.presentDays).toBe(0);
    expect(s.absentDays).toBe(26);
  });
});

describe("undecided attendance blocker", () => {
  it("is null when every record is decided", () => {
    expect(
      undecidedAttendanceBlocker([
        { name: "Asha", reviewStatus: "NONE" },
        { name: "Ravi", reviewStatus: "APPROVED" },
        { name: "Meena", reviewStatus: "REJECTED" },
      ]),
    ).toBeNull();
    expect(undecidedAttendanceBlocker([])).toBeNull();
  });

  it("counts records and names the people, once each", () => {
    expect(
      undecidedAttendanceBlocker([
        { name: "Asha", reviewStatus: "PENDING" },
        { name: "Asha", reviewStatus: "DETAILS_REQUESTED" },
        { name: "Ravi", reviewStatus: "PENDING" },
        { name: "Meena", reviewStatus: "APPROVED" },
      ]),
    ).toBe("3 attendance records still need a decision (Asha, Ravi).");
  });

  it("speaks of one record in the singular", () => {
    expect(undecidedAttendanceBlocker([{ name: "Asha", reviewStatus: "PENDING" }])).toBe(
      "1 attendance record still needs a decision (Asha).",
    );
  });

  it("names three people and trails off after that", () => {
    const names = ["Asha", "Ravi", "Meena", "Vikas", "Kiran"];
    expect(
      undecidedAttendanceBlocker(names.map((name) => ({ name, reviewStatus: "PENDING" }))),
    ).toBe("5 attendance records still need a decision (Asha, Ravi, Meena …).");
  });
});
