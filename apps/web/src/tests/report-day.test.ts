import { describe, expect, it } from "vitest";
import { workDateInTimezone } from "@/lib/attendance/policy";
import { dayBoundsInTimezone } from "@/lib/reports/day";

const HOUR = 60 * 60 * 1000;

describe("today as a range of instants", () => {
  it("is the Indian calendar day, not the UTC one", () => {
    // 01:30 IST on 30 Sept is still 29 Sept in UTC.
    const now = new Date("2026-09-29T20:00:00.000Z");
    const { start, end } = dayBoundsInTimezone(now, "Asia/Kolkata");
    expect(start.toISOString()).toBe("2026-09-29T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T18:30:00.000Z");
  });

  it("puts a task completed at 00:10 IST in today and one at 23:50 IST yesterday out", () => {
    const now = new Date("2026-09-30T06:00:00.000Z"); // 11:30 IST
    const { start, end } = dayBoundsInTimezone(now, "Asia/Kolkata");
    const in_ = (d: Date) => d >= start && d < end;
    expect(in_(new Date("2026-09-29T18:40:00.000Z"))).toBe(true); // 00:10 IST
    expect(in_(new Date("2026-09-29T18:20:00.000Z"))).toBe(false); // 23:50 IST, 29th
    expect(in_(new Date("2026-09-30T18:29:59.999Z"))).toBe(true); // 23:59:59 IST
    expect(in_(new Date("2026-09-30T18:30:00.000Z"))).toBe(false); // midnight, 1 Oct
  });

  it.each([
    ["Asia/Kolkata", "2026-09-30T06:00:00.000Z"],
    ["Asia/Kathmandu", "2026-09-30T06:00:00.000Z"],
    ["UTC", "2026-09-30T23:59:59.000Z"],
    ["Pacific/Kiritimati", "2026-09-30T11:00:00.000Z"],
    ["America/New_York", "2026-03-08T15:00:00.000Z"], // clocks go forward: a 23-hour day
    ["America/New_York", "2026-11-01T15:00:00.000Z"], // clocks go back: a 25-hour day
  ])("agrees with the attendance work date in %s at %s", (tz, iso) => {
    const now = new Date(iso);
    const day = workDateInTimezone(now, tz).getTime();
    const { start, end } = dayBoundsInTimezone(now, tz);
    expect(start <= now && now < end).toBe(true);
    expect(workDateInTimezone(start, tz).getTime()).toBe(day);
    expect(workDateInTimezone(new Date(end.getTime() - 1), tz).getTime()).toBe(day);
    expect(workDateInTimezone(new Date(start.getTime() - 1), tz).getTime()).toBe(day - 24 * HOUR);
    expect(workDateInTimezone(end, tz).getTime()).toBe(day + 24 * HOUR);
  });

  it("is 23 and 25 hours long on New York's clock-change days", () => {
    const spring = dayBoundsInTimezone(new Date("2026-03-08T15:00:00.000Z"), "America/New_York");
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * HOUR);
    const autumn = dayBoundsInTimezone(new Date("2026-11-01T15:00:00.000Z"), "America/New_York");
    expect(autumn.end.getTime() - autumn.start.getTime()).toBe(25 * HOUR);
  });
});
