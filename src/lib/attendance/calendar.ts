/**
 * The work calendar: which days are working days, for a company and for
 * one person in it.
 *
 * Pure and dependency-free, so the rules that decide whether a Sunday
 * costs someone a day's pay are asserted in tests rather than discovered
 * on a payslip.
 *
 * Three rules, all decided with the owner (27 Sept 2026):
 * 1. The company sets its weekly off days (Sunday unless changed), and any
 *    person may have their own instead — shop staff often take a weekday.
 * 2. A company holiday list: every holiday is a paid day off for everyone.
 * 3. Leave never counts an off day. Unpaid leave Saturday–Monday is two
 *    unpaid days; the Sunday in between stays paid.
 *
 * Dates are "YYYY-MM-DD" keys. Work dates are stored as UTC midnight of the
 * local calendar date (see workDateInTimezone), so a key read from one with
 * toISOString() is the local date, and the weekday is its UTC weekday.
 */

export interface Holiday {
  /** "YYYY-MM-DD" */
  date: string;
  name: string;
}

export interface WorkCalendar {
  /** 0 = Sunday … 6 = Saturday. */
  weeklyOffDays: number[];
  holidays: Holiday[];
}

export const DEFAULT_WORK_CALENDAR: WorkCalendar = {
  weeklyOffDays: [0],
  holidays: [],
};

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const MAX_HOLIDAYS = 100;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date in "YYYY-MM-DD" form (rejects 2026-02-30). */
export function isDateKey(value: string): boolean {
  if (!DATE_KEY.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weekdayOf(key: string): number {
  return new Date(`${key}T00:00:00.000Z`).getUTCDay();
}

/** Sorted, de-duplicated weekdays in 0–6. */
export function normaliseWeekdays(days: readonly number[]): number[] {
  return [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(
    (a, b) => a - b,
  );
}

/**
 * Whatever is stored, as a usable calendar. A company that has never saved
 * one gets Sunday off and no holidays — the safe default, because the
 * alternative is deducting every Sunday from everyone's pay.
 */
export function normaliseWorkCalendar(raw: unknown): WorkCalendar {
  const value = (raw ?? {}) as Partial<WorkCalendar>;
  const weeklyOffDays = Array.isArray(value.weeklyOffDays)
    ? normaliseWeekdays(value.weeklyOffDays)
    : DEFAULT_WORK_CALENDAR.weeklyOffDays;
  const seen = new Set<string>();
  const holidays = (Array.isArray(value.holidays) ? value.holidays : [])
    .filter((h): h is Holiday =>
      Boolean(h) && typeof h.date === "string" && isDateKey(h.date) && typeof h.name === "string",
    )
    .filter((h) => (seen.has(h.date) ? false : (seen.add(h.date), true)))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { weeklyOffDays, holidays };
}

/** One person's weekly offs: their own if they have them, else the company's. */
export function personWeeklyOff(
  calendar: WorkCalendar,
  person: { hasOwnWeeklyOff: boolean; weeklyOffDays: readonly number[] } | null,
): number[] {
  return person?.hasOwnWeeklyOff
    ? normaliseWeekdays(person.weeklyOffDays)
    : calendar.weeklyOffDays;
}

export type OffDay =
  | { kind: "holiday"; name: string }
  | { kind: "weekly_off"; weekday: string };

/**
 * Is this date a day off for this person? A holiday wins over a weekly off,
 * because it is the more specific fact and the one worth naming.
 */
export function offDayOn(
  key: string,
  calendar: WorkCalendar,
  weeklyOffDays: readonly number[],
): OffDay | null {
  const holiday = calendar.holidays.find((h) => h.date === key);
  if (holiday) return { kind: "holiday", name: holiday.name };
  const weekday = weekdayOf(key);
  if (weeklyOffDays.includes(weekday)) {
    return { kind: "weekly_off", weekday: WEEKDAYS[weekday] };
  }
  return null;
}

/** Every date key from start to end inclusive. */
export function dateKeysBetween(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(`${dateKey(start)}T00:00:00.000Z`);
  const last = dateKey(end);
  while (dateKey(cursor) <= last) {
    keys.push(dateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

export interface PeriodDays {
  /** Working days in the period for this person. */
  working: string[];
  weeklyOffCount: number;
  holidayCount: number;
}

/** Split a period into working days, weekly offs and holidays for one person. */
export function splitPeriod(
  start: Date,
  end: Date,
  calendar: WorkCalendar,
  weeklyOffDays: readonly number[],
): PeriodDays {
  const working: string[] = [];
  let weeklyOffCount = 0;
  let holidayCount = 0;
  for (const key of dateKeysBetween(start, end)) {
    const off = offDayOn(key, calendar, weeklyOffDays);
    if (!off) working.push(key);
    else if (off.kind === "holiday") holidayCount += 1;
    else weeklyOffCount += 1;
  }
  return { working, weeklyOffCount, holidayCount };
}

/**
 * The working days a leave covers inside a period. Off days inside a leave
 * are skipped — they are paid days off whether or not the person is on
 * leave around them.
 */
export function leaveWorkingDays(
  leave: { startDate: Date; endDate: Date; type: string },
  workingDays: ReadonlySet<string>,
): { keys: string[]; days: number } {
  if (leave.type === "HALF_DAY") {
    const key = dateKey(leave.startDate);
    return workingDays.has(key) ? { keys: [key], days: 0.5 } : { keys: [], days: 0 };
  }
  const keys = dateKeysBetween(leave.startDate, leave.endDate).filter((k) =>
    workingDays.has(k),
  );
  return { keys, days: keys.length };
}

/**
 * "Sunday", "Saturday and Sunday", "Monday, Wednesday and Friday", "no day".
 * Listed Monday first, the way a working week is spoken about.
 */
export function describeWeekdays(days: readonly number[]): string {
  const names = normaliseWeekdays(days)
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => WEEKDAYS[d]);
  if (names.length === 0) return "no day";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
