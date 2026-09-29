import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORK_CALENDAR,
  describeWeekdays,
  isDateKey,
  normaliseWorkCalendar,
  offDayOn,
  personWeeklyOff,
  splitPeriod,
  type WorkCalendar,
} from "@/lib/attendance/calendar";
import { computeCheckInState, type AttendanceContext } from "@/lib/attendance/policy";
import { companyDefaultShiftLabel } from "@/lib/attendance/shifts";
import { DEFAULT_LATE_POLICY, unpaidDaysFor } from "@/lib/payroll/engine";
import { summariseAttendance } from "@/lib/payroll/summary";

const d = (key: string) => new Date(`${key}T00:00:00.000Z`);
const SEPT_START = d("2026-09-01");
const SEPT_END = d("2026-09-30");
const SUNDAY_OFF: WorkCalendar = { weeklyOffDays: [0], holidays: [] };

/** Every working day in the range, checked in on time. */
function perfectRecords(calendar: WorkCalendar, off: number[], start: Date, end: Date) {
  return splitPeriod(start, end, calendar, off).working.map((key) => ({
    workDate: d(key),
    checkInAt: new Date(`${key}T04:00:00.000Z`),
    lateMinutes: 0,
    exemptionStatus: "NONE",
  }));
}

describe("work calendar defaults and validation", () => {
  it("gives a company that never saved one Sunday off, not a seven-day week", () => {
    expect(normaliseWorkCalendar(null)).toEqual(DEFAULT_WORK_CALENDAR);
    expect(DEFAULT_WORK_CALENDAR.weeklyOffDays).toEqual([0]);
  });

  it("keeps a deliberate empty weekly off", () => {
    expect(normaliseWorkCalendar({ weeklyOffDays: [] }).weeklyOffDays).toEqual([]);
  });

  it("drops invalid dates, duplicates and out-of-range weekdays; sorts holidays", () => {
    const cal = normaliseWorkCalendar({
      weeklyOffDays: [6, 0, 0, 9, -1],
      holidays: [
        { date: "2026-11-08", name: "Diwali" },
        { date: "2026-10-02", name: "Gandhi Jayanti" },
        { date: "2026-10-02", name: "Duplicate" },
        { date: "2026-02-30", name: "Not a date" },
      ],
    });
    expect(cal.weeklyOffDays).toEqual([0, 6]);
    expect(cal.holidays.map((h) => h.name)).toEqual(["Gandhi Jayanti", "Diwali"]);
  });

  it("recognises only real calendar dates", () => {
    expect(isDateKey("2026-10-02")).toBe(true);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2 Oct 2026")).toBe(false);
  });

  it("names weekdays the way people say them", () => {
    expect(describeWeekdays([0])).toBe("Sunday");
    expect(describeWeekdays([0, 6])).toBe("Saturday and Sunday");
    expect(describeWeekdays([1, 3, 5])).toBe("Monday, Wednesday and Friday");
  });
});

describe("whose day off is it", () => {
  const cal: WorkCalendar = {
    weeklyOffDays: [0],
    holidays: [{ date: "2026-10-04", name: "Local festival" }],
  };

  it("uses the company's weekly off unless the person has their own", () => {
    expect(personWeeklyOff(cal, { hasOwnWeeklyOff: false, weeklyOffDays: [2] })).toEqual([0]);
    expect(personWeeklyOff(cal, { hasOwnWeeklyOff: true, weeklyOffDays: [2] })).toEqual([2]);
  });

  it("names a holiday even when it falls on a weekly off", () => {
    // 4 Oct 2026 is a Sunday.
    expect(offDayOn("2026-10-04", cal, [0])).toEqual({ kind: "holiday", name: "Local festival" });
    expect(offDayOn("2026-09-27", cal, [0])).toEqual({ kind: "weekly_off", weekday: "Sunday" });
    expect(offDayOn("2026-09-28", cal, [0])).toBeNull();
  });

  it("applies company holidays to people with their own weekly off too", () => {
    expect(offDayOn("2026-10-04", cal, [2])?.kind).toBe("holiday");
    expect(offDayOn("2026-09-29", cal, [2])?.kind).toBe("weekly_off"); // a Tuesday
  });
});

describe("payroll no longer deducts days off", () => {
  it("a perfect September costs nothing — it used to cost four Sundays", () => {
    const summary = summariseAttendance({
      periodStart: SEPT_START,
      periodEnd: SEPT_END,
      calendar: SUNDAY_OFF,
      weeklyOffDays: [0],
      records: perfectRecords(SUNDAY_OFF, [0], SEPT_START, SEPT_END),
      leave: [],
    });
    expect(summary).toMatchObject({
      calendarDays: 30,
      workingDays: 26,
      weeklyOffDays: 4,
      holidayDays: 0,
      presentDays: 26,
      absentDays: 0,
    });
    expect(unpaidDaysFor(summary, DEFAULT_LATE_POLICY).unpaidDays).toBe(0);
  });

  it("a holiday is paid, and only a missed working day is absent", () => {
    const cal: WorkCalendar = {
      weeklyOffDays: [0],
      holidays: [{ date: "2026-10-02", name: "Gandhi Jayanti" }],
    };
    const start = d("2026-10-01");
    const end = d("2026-10-31");
    const records = perfectRecords(cal, [0], start, end).filter(
      (r) => r.workDate.toISOString().slice(0, 10) !== "2026-10-05",
    );
    const summary = summariseAttendance({
      periodStart: start,
      periodEnd: end,
      calendar: cal,
      weeklyOffDays: [0],
      records,
      leave: [],
    });
    expect(summary).toMatchObject({
      calendarDays: 31,
      workingDays: 26,
      weeklyOffDays: 4,
      holidayDays: 1,
      absentDays: 1,
    });
  });

  it("counts a person's own weekly off instead of Sunday", () => {
    // Tuesday off: 5 Tuesdays in Sept 2026 (1, 8, 15, 22, 29); Sundays are working days.
    const summary = summariseAttendance({
      periodStart: SEPT_START,
      periodEnd: SEPT_END,
      calendar: SUNDAY_OFF,
      weeklyOffDays: [2],
      records: perfectRecords(SUNDAY_OFF, [2], SEPT_START, SEPT_END),
      leave: [],
    });
    expect(summary).toMatchObject({ workingDays: 25, weeklyOffDays: 5, absentDays: 0 });
  });

  it("a check-in on a day off is present, and no day off becomes absent", () => {
    const summary = summariseAttendance({
      periodStart: SEPT_START,
      periodEnd: SEPT_END,
      calendar: SUNDAY_OFF,
      weeklyOffDays: [0],
      records: [
        ...perfectRecords(SUNDAY_OFF, [0], SEPT_START, SEPT_END),
        { workDate: d("2026-09-27"), checkInAt: d("2026-09-27"), lateMinutes: 0, exemptionStatus: "NONE" },
      ],
      leave: [],
    });
    expect(summary.presentDays).toBe(27);
    expect(summary.absentDays).toBe(0);
  });

  it("unpaid leave Saturday–Monday is two unpaid days; the Sunday stays paid", () => {
    const records = perfectRecords(SUNDAY_OFF, [0], SEPT_START, SEPT_END).filter(
      (r) => !["2026-09-12", "2026-09-14"].includes(r.workDate.toISOString().slice(0, 10)),
    );
    const summary = summariseAttendance({
      periodStart: SEPT_START,
      periodEnd: SEPT_END,
      calendar: SUNDAY_OFF,
      weeklyOffDays: [0],
      records,
      leave: [{ startDate: d("2026-09-12"), endDate: d("2026-09-14"), type: "FULL_DAY", paid: false }],
    });
    expect(summary.unpaidLeaveDays).toBe(2);
    expect(summary.absentDays).toBe(0);
    expect(unpaidDaysFor(summary, DEFAULT_LATE_POLICY).unpaidDays).toBe(2);
  });

  it("clips leave to the period and keeps half days as they were", () => {
    const summary = summariseAttendance({
      periodStart: SEPT_START,
      periodEnd: SEPT_END,
      calendar: SUNDAY_OFF,
      weeklyOffDays: [0],
      records: perfectRecords(SUNDAY_OFF, [0], SEPT_START, SEPT_END),
      leave: [
        // Half day on a worked Monday: still half a day of unpaid leave.
        { startDate: d("2026-09-07"), endDate: d("2026-09-07"), type: "HALF_DAY", paid: false },
        // Half day asked for on a Sunday: nothing to deduct.
        { startDate: d("2026-09-06"), endDate: d("2026-09-06"), type: "HALF_DAY", paid: false },
        // Paid leave running into October: only September's working days count.
        { startDate: d("2026-09-29"), endDate: d("2026-10-03"), type: "FULL_DAY", paid: true },
      ],
    });
    expect(summary.unpaidLeaveDays).toBe(0.5);
    expect(summary.paidLeaveDays).toBe(2); // 29 and 30 Sept
  });

  it("still deducts late arrivals the same way", () => {
    const records = perfectRecords(SUNDAY_OFF, [0], SEPT_START, SEPT_END).map((r, i) =>
      i < 3 ? { ...r, lateMinutes: 25 } : r,
    );
    const summary = summariseAttendance({
      periodStart: SEPT_START,
      periodEnd: SEPT_END,
      calendar: SUNDAY_OFF,
      weeklyOffDays: [0],
      records,
      leave: [],
    });
    expect(summary.lateDays).toBe(3);
    expect(unpaidDaysFor(summary, DEFAULT_LATE_POLICY)).toEqual({ unpaidDays: 1, lateDeductionDays: 1 });
  });
});

describe("checking in on a day off", () => {
  const context: AttendanceContext = {
    timezone: "Asia/Kolkata",
    homeBranch: null,
    branches: [],
    canCheckInAtAnyBranch: false,
    branchMissing: false,
    shift: { name: "Shop shift", startMinutes: 10 * 60, endMinutes: 20 * 60, graceMinutes: 10 },
    locationRequired: false,
    multiplePunchAllowed: false,
    today: null,
    workCalendar: { calendar: SUNDAY_OFF, weeklyOffDays: [0] },
  };
  // 11:00 IST — an hour after the shift starts.
  const sundayLate = new Date("2026-09-27T05:30:00.000Z");
  const mondayLate = new Date("2026-09-28T05:30:00.000Z");

  it("is never late on a weekly off", () => {
    expect(computeCheckInState(context, null, sundayLate).lateBy).toBe(0);
  });

  it("is late on a working day as before", () => {
    expect(computeCheckInState(context, null, mondayLate).lateBy).toBe(60);
  });

  it("behaves as before when a context carries no calendar", () => {
    const { workCalendar: _unused, ...legacy } = context;
    void _unused;
    expect(computeCheckInState(legacy, null, sundayLate).lateBy).toBe(60);
  });
});

describe("default shift label", () => {
  it("says which shift 'Company default' is", () => {
    expect(
      companyDefaultShiftLabel([
        { name: "Shop shift", startMinutes: 600, endMinutes: 1200, isDefault: true },
      ]),
    ).toBe("Company default (Shop shift, 10:00–20:00)");
  });

  it("names the built-in hours before any shift is the default", () => {
    expect(companyDefaultShiftLabel([])).toBe("Company default (09:30–18:30)");
  });
});
