import {
  dateKey,
  leaveWorkingDays,
  splitPeriod,
  type WorkCalendar,
} from "@/lib/attendance/calendar";
import type { AttendanceSummary } from "./engine";

/**
 * One person's attendance for a payroll period, against their work
 * calendar. Pure, so the rule that used to deduct every Sunday is pinned
 * by tests (src/tests/work-calendar.test.ts).
 *
 * - Only WORKING days can be absent. Weekly offs and holidays are paid.
 * - A check-in on an off day still counts as present (they came in), but an
 *   off day never becomes an absence when they did not.
 * - Leave counts working days only: unpaid leave Saturday–Monday with Sunday
 *   off is two unpaid days (owner's decision, 27 Sept 2026).
 * - Otherwise leave counts as it always has: a half day of unpaid leave on a
 *   day they worked the other half is still half a day unpaid.
 */
export function summariseAttendance(input: {
  periodStart: Date;
  periodEnd: Date;
  calendar: WorkCalendar;
  weeklyOffDays: readonly number[];
  records: ReadonlyArray<{
    workDate: Date;
    checkInAt: Date | null;
    lateMinutes: number;
    exemptionStatus: string;
  }>;
  leave: ReadonlyArray<{
    startDate: Date;
    endDate: Date;
    type: string;
    paid: boolean | null;
  }>;
}): AttendanceSummary {
  const period = splitPeriod(
    input.periodStart,
    input.periodEnd,
    input.calendar,
    input.weeklyOffDays,
  );
  const working = new Set(period.working);
  const calendarDays = working.size + period.weeklyOffCount + period.holidayCount;

  const present = new Set(
    input.records.filter((r) => r.checkInAt).map((r) => dateKey(r.workDate)),
  );

  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  const onLeave = new Set<string>();
  for (const leave of input.leave) {
    const covered = leaveWorkingDays(leave, working);
    if (leave.paid === true) paidLeaveDays += covered.days;
    else unpaidLeaveDays += covered.days;
    for (const k of covered.keys) onLeave.add(k);
  }

  let absentDays = 0;
  for (const key of working) {
    if (!present.has(key) && !onLeave.has(key)) absentDays += 1;
  }

  const counted = input.records.filter(
    (r) => r.lateMinutes > 0 && r.exemptionStatus !== "EXEMPTED",
  );

  return {
    calendarDays,
    workingDays: working.size,
    weeklyOffDays: period.weeklyOffCount,
    holidayDays: period.holidayCount,
    presentDays: present.size,
    paidLeaveDays,
    unpaidLeaveDays,
    absentDays,
    lateDays: counted.length,
    lateMinutes: counted.reduce((sum, r) => sum + r.lateMinutes, 0),
  };
}
