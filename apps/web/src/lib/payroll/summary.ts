import {
  dateKey,
  leaveWorkingDays,
  splitPeriod,
  type WorkCalendar,
} from "@/lib/attendance/calendar";
import type { AttendanceSummary } from "./engine";

/**
 * How payroll treats one attendance record, by its exception review
 * (owner decision, hardening batch 4 — the screen promises "Approved
 * records for the period", so the figures must keep that promise):
 *
 * - NONE (never needed review) and APPROVED count exactly as recorded.
 * - REJECTED is not a present day, and not a late day either: the day then
 *   falls under the ordinary absent-day rules, as if nothing was recorded.
 *   Counting it late as well would charge the same day twice.
 * - PENDING and DETAILS_REQUESTED are undecided. They BLOCK Calculate and
 *   Approve (`undecidedAttendanceBlocker`) rather than being guessed at;
 *   until then the preview shows them as recorded.
 *
 * A missing status means the record never needed review.
 */
export type AttendanceTreatment = "COUNTS" | "REJECTED" | "UNDECIDED";

export function attendanceTreatment(
  reviewStatus: string | null | undefined,
): AttendanceTreatment {
  if (reviewStatus === "REJECTED") return "REJECTED";
  if (reviewStatus === "PENDING" || reviewStatus === "DETAILS_REQUESTED") {
    return "UNDECIDED";
  }
  return "COUNTS";
}

/** How many names the blocker spells out before trailing off. */
const NAMED_IN_BLOCKER = 3;

/**
 * The run-level blocker for attendance nobody has decided yet, e.g.
 * "3 attendance records still need a decision (Asha, Ravi …)."
 * Null when every record is decided. Pure, so the wording is pinned by
 * src/tests/payroll-review-status.test.ts.
 */
export function undecidedAttendanceBlocker(
  records: ReadonlyArray<{ name: string; reviewStatus: string | null | undefined }>,
): string | null {
  const undecided = records.filter(
    (r) => attendanceTreatment(r.reviewStatus) === "UNDECIDED",
  );
  if (undecided.length === 0) return null;

  const names = [...new Set(undecided.map((r) => r.name))];
  const shown = names.slice(0, NAMED_IN_BLOCKER).join(", ");
  const more = names.length > NAMED_IN_BLOCKER ? " …" : "";
  const count = undecided.length;
  return count === 1
    ? `1 attendance record still needs a decision (${shown}${more}).`
    : `${count} attendance records still need a decision (${shown}${more}).`;
}

/**
 * One person's attendance for a payroll period, against their work
 * calendar. Pure, so the rule that used to deduct every Sunday is pinned
 * by tests (src/tests/work-calendar.test.ts).
 *
 * - Only WORKING days can be absent. Weekly offs and holidays are paid.
 * - A check-in on an off day still counts as present (they came in), but an
 *   off day never becomes an absence when they did not.
 * - A REJECTED record is not a present (or late) day — see
 *   `attendanceTreatment`.
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
    /** The exception review; omitted means it never needed one. */
    reviewStatus?: string | null;
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

  const standing = input.records.filter(
    (r) => attendanceTreatment(r.reviewStatus) !== "REJECTED",
  );

  const present = new Set(
    standing.filter((r) => r.checkInAt).map((r) => dateKey(r.workDate)),
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

  const counted = standing.filter(
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
