import { workDateInTimezone } from "@/lib/attendance/policy";

/**
 * "Today" as a range of instants, for columns that store a moment
 * (completedAt) rather than a work date.
 *
 * The daily report counts attendance by work date — the calendar day in
 * the company's timezone (workDateInTimezone). Anything else on the same
 * report has to mean the same day, or "today" at 2 a.m. in India would
 * still be yesterday in UTC. Pure, so it can be tested across timezones.
 */

/** How far the wall clock in `timeZone` is ahead of UTC at `at`, in ms. */
function offsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const n = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return wall - (at.getTime() - at.getUTCMilliseconds());
}

/**
 * The instant the clock in `timeZone` reads 00:00 on `day` (a UTC-midnight
 * date, as workDateInTimezone returns). Two passes, so a clock change
 * between UTC midnight and local midnight is still landed on.
 */
function localMidnight(day: Date, timeZone: string): Date {
  const utcMidnight = day.getTime();
  const firstGuess = utcMidnight - offsetMs(day, timeZone);
  return new Date(utcMidnight - offsetMs(new Date(firstGuess), timeZone));
}

/** [start, end) of the company's calendar day that contains `now`. */
export function dayBoundsInTimezone(
  now: Date,
  timeZone: string,
): { start: Date; end: Date } {
  const day = workDateInTimezone(now, timeZone);
  const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
  return { start: localMidnight(day, timeZone), end: localMidnight(next, timeZone) };
}
