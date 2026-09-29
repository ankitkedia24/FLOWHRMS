import { describe, expect, it } from "vitest";
import {
  MAX_ACCURACY_M,
  assessLocation,
  checkInButtonLabel,
  checkInConsequence,
  checkInIntent,
  distanceMetres,
  formatDistance,
  formatDuration,
  hasUnrecordedCheckOut,
  isVisitStale,
  lateMinutes,
  minutesInTimezone,
  workDateInTimezone,
  workedMinutes,
} from "@/lib/attendance/policy";

const BRANCH = {
  name: "Shivaji Market",
  lat: 19.076,
  lng: 72.8777,
  radiusM: 300,
};

const SHIFT = { startMinutes: 9 * 60 + 30, endMinutes: 18 * 60 + 30, graceMinutes: 10 };

describe("late calculation", () => {
  it("is not late before the shift starts", () => {
    expect(lateMinutes(9 * 60 + 15, SHIFT)).toBe(0);
  });

  it("is not late exactly at the grace boundary (grace is inclusive)", () => {
    // edge-cases.md: "at exactly 10 minutes the employee is NOT late"
    expect(lateMinutes(9 * 60 + 40, SHIFT)).toBe(0);
  });

  it("is late one minute past the grace boundary", () => {
    expect(lateMinutes(9 * 60 + 41, SHIFT)).toBe(11);
  });

  it("reports the full minutes late, not minutes past grace", () => {
    expect(lateMinutes(9 * 60 + 42, SHIFT)).toBe(12);
  });
});

describe("checking in again the same day", () => {
  const day = (checkedIn: boolean, checkedOut: boolean, allowed: boolean) =>
    checkInIntent({ checkedIn, checkedOut, multiplePunchAllowed: allowed });

  it("opens the day when nothing is recorded yet", () => {
    expect(day(false, false, false)).toBe("open-day");
    expect(day(false, false, true)).toBe("open-day");
  });

  it("treats a repeat tap while still in as already open", () => {
    // Idempotency: a double tap, or a queued action retried after signal
    // returned, must not open a second visit.
    expect(day(true, false, true)).toBe("already-open");
    expect(day(true, false, false)).toBe("already-open");
  });

  it("allows a return after check-out only where the feature is on", () => {
    expect(day(true, true, true)).toBe("new-punch");
    expect(day(true, true, false)).toBe("day-closed");
  });

  it("distinguishes 'closed' from 'already open' so the refusal can differ", () => {
    // The whole point: "day-closed" is a NO that owes an explanation,
    // "already-open" is a silent success. Collapsing them is what made a
    // blocked second check-in look like a broken button.
    expect(day(true, true, false)).not.toBe(day(true, false, false));
  });
});

describe("hours across a day with more than one visit", () => {
  const at = (h: number, m = 0) => new Date(Date.UTC(2026, 7, 12, h, m));

  it("sums the pairs rather than measuring first-in to last-out", () => {
    // 09:00–13:00 and 14:00–18:00 is eight hours worked, not the nine
    // hours between arriving and leaving. The hour of lunch is the whole
    // difference, and it is the difference someone gets paid for.
    const worked = workedMinutes(
      [
        { checkInAt: at(9), checkOutAt: at(13) },
        { checkInAt: at(14), checkOutAt: at(18) },
      ],
      at(20),
    );
    expect(worked).toBe(8 * 60);
    expect(worked).not.toBe(at(18).getTime() - at(9).getTime());
  });

  it("counts an open visit up to now, so the clock runs while working", () => {
    expect(
      workedMinutes([{ checkInAt: at(9), checkOutAt: null }], at(11, 30)),
    ).toBe(150);
  });

  it("adds a finished visit to one still open", () => {
    expect(
      workedMinutes(
        [
          { checkInAt: at(9), checkOutAt: at(13) },
          { checkInAt: at(14), checkOutAt: null },
        ],
        at(15),
      ),
    ).toBe(5 * 60);
  });

  it("matches the old single-pair answer for a day recorded before punches", () => {
    expect(
      workedMinutes([{ checkInAt: at(9), checkOutAt: at(17, 30) }], at(20)),
    ).toBe(8 * 60 + 30);
  });

  it("ignores a pair that would count backwards", () => {
    // A corrected check-out earlier than the check-in must not subtract
    // from a day's total.
    expect(
      workedMinutes(
        [
          { checkInAt: at(9), checkOutAt: at(8) },
          { checkInAt: at(10), checkOutAt: at(11) },
        ],
        at(12),
      ),
    ).toBe(60);
  });

  it("is zero for a day with no visits", () => {
    expect(workedMinutes([], at(12))).toBe(0);
  });
});

describe("a visit that crosses midnight", () => {
  const at = (day: number, h: number, m = 0) =>
    new Date(Date.UTC(2026, 7, day, h, m));

  it("is still open eight hours into a night shift", () => {
    // 22:00 Tuesday to 06:00 Wednesday. Checking out here used to be
    // refused with "You haven't checked in today", because the lookup used
    // the calendar date of the check-OUT.
    expect(isVisitStale(at(11, 22), at(12, 6))).toBe(false);
  });

  it("counts those hours as worked, across the date boundary", () => {
    expect(
      workedMinutes([{ checkInAt: at(11, 22), checkOutAt: at(12, 6) }], at(12, 9)),
    ).toBe(8 * 60);
  });

  it("holds right up to the deadline and gives way just after", () => {
    const start = at(11, 22);
    expect(isVisitStale(start, at(12, 16))).toBe(false); // exactly 18h
    expect(isVisitStale(start, new Date(at(12, 16).getTime() + 1))).toBe(true);
  });

  it("stops a forgotten check-out counting for ever", () => {
    // The case that prompted this: checked in 00:11, still open a day
    // later. Nobody worked 26 hours, and recording it would put a day of
    // overtime on a payslip.
    const punches = [{ checkInAt: at(13, 0, 11), checkOutAt: null }];
    expect(workedMinutes(punches, at(14, 2))).toBe(0);
    expect(hasUnrecordedCheckOut(punches, at(14, 2))).toBe(true);
  });

  it("still runs the clock for someone genuinely at work", () => {
    const punches = [{ checkInAt: at(13, 9), checkOutAt: null }];
    expect(workedMinutes(punches, at(13, 12, 30))).toBe(210);
    expect(hasUnrecordedCheckOut(punches, at(13, 12, 30))).toBe(false);
  });

  it("does not let a stale visit erase the hours around it", () => {
    // A forgotten Tuesday must not subtract from a properly recorded one.
    const punches = [
      { checkInAt: at(13, 9), checkOutAt: at(13, 13) },
      { checkInAt: at(13, 14), checkOutAt: null }, // forgotten
    ];
    expect(workedMinutes(punches, at(14, 20))).toBe(4 * 60);
    expect(hasUnrecordedCheckOut(punches, at(14, 20))).toBe(true);
  });

  it("reports nothing unrecorded when every visit is closed", () => {
    expect(
      hasUnrecordedCheckOut(
        [{ checkInAt: at(13, 9), checkOutAt: at(13, 17) }],
        at(20, 9),
      ),
    ).toBe(false);
  });
});

describe("location assessment", () => {
  it("omits location entirely when policy does not require it", () => {
    const result = assessLocation({
      locationRequired: false,
      branch: BRANCH,
      coords: { lat: 0, lng: 0 },
    });
    expect(result.outcome).toBe("NOT_REQUIRED");
    expect(result.label).toBe("");
  });

  it("is INSIDE within the permitted radius", () => {
    const result = assessLocation({
      locationRequired: true,
      branch: BRANCH,
      coords: { lat: 19.0761, lng: 72.8778, accuracyM: 20 },
    });
    expect(result.outcome).toBe("INSIDE");
    expect(result.label).toContain("Inside Shivaji Market area");
  });

  it("is OUTSIDE beyond the radius and reports the distance", () => {
    const result = assessLocation({
      locationRequired: true,
      branch: BRANCH,
      coords: { lat: 19.09, lng: 72.8777, accuracyM: 20 },
    });
    expect(result.outcome).toBe("OUTSIDE");
    expect(result.distanceM).toBeGreaterThan(300);
  });

  it("treats poor GPS accuracy as unconfirmed, not a silent pass", () => {
    const result = assessLocation({
      locationRequired: true,
      branch: BRANCH,
      coords: { lat: 19.0761, lng: 72.8778, accuracyM: MAX_ACCURACY_M + 1 },
    });
    expect(result.outcome).toBe("UNCONFIRMED");
  });

  it("is unconfirmed when location is unavailable", () => {
    const result = assessLocation({
      locationRequired: true,
      branch: BRANCH,
      coords: null,
    });
    expect(result.outcome).toBe("UNCONFIRMED");
  });

  it("measures distance sanely", () => {
    const oneDegreeLat = distanceMetres(
      { lat: 0, lng: 0 },
      { lat: 1, lng: 0 },
    );
    expect(oneDegreeLat).toBeGreaterThan(110_000);
    expect(oneDegreeLat).toBeLessThan(112_000);
  });
});

describe("consequence contract", () => {
  it("returns null when there is nothing to warn about", () => {
    const consequence = checkInConsequence({
      location: { outcome: "INSIDE", distanceM: 10, label: "Inside" },
      lateBy: 0,
    });
    expect(consequence).toBeNull();
  });

  it("states exact late minutes before the action", () => {
    const consequence = checkInConsequence({
      location: { outcome: "INSIDE", distanceM: 10, label: "Inside" },
      lateBy: 12,
    });
    expect(consequence?.sentence).toBe(
      "Checking in now will record a late arrival of 12 minutes.",
    );
    expect(consequence?.requiresReason).toBe(false);
  });

  it("requires a reason outside the permitted area and names the distance", () => {
    const consequence = checkInConsequence({
      location: { outcome: "OUTSIDE", distanceM: 1400, label: "Outside" },
      lateBy: 0,
      branchName: "Shivaji Market",
    });
    expect(consequence?.sentence).toBe(
      "You are 1.4 km outside the Shivaji Market area.",
    );
    expect(consequence?.requiresReason).toBe(true);
    expect(consequence?.detail).toContain("sent to your manager for approval");
  });

  it("requires a reason when location cannot be confirmed", () => {
    const consequence = checkInConsequence({
      location: { outcome: "UNCONFIRMED", distanceM: null, label: "" },
      lateBy: 0,
    });
    expect(consequence?.requiresReason).toBe(true);
  });

  it("changes the button label when approval is needed", () => {
    expect(checkInButtonLabel(null)).toBe("Check In");
    expect(
      checkInButtonLabel({ sentence: "x", requiresReason: true }),
    ).toBe("Check In — needs approval");
    expect(
      checkInButtonLabel({ sentence: "x", requiresReason: false }),
    ).toBe("Check In");
  });
});

describe("formatting", () => {
  it("formats distances the way the copy deck does", () => {
    expect(formatDistance(1400)).toBe("1.4 km");
    expect(formatDistance(320)).toBe("320 m");
  });

  it("formats durations as h:mm", () => {
    expect(formatDuration(126)).toBe("2:06");
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(-5)).toBe("0:00");
  });

  it("resolves tenant-local minutes and work date", () => {
    // 2026-08-07T04:12:00Z is 09:42 IST on the 7th.
    const moment = new Date("2026-08-07T04:12:00.000Z");
    expect(minutesInTimezone(moment, "Asia/Kolkata")).toBe(9 * 60 + 42);
    expect(workDateInTimezone(moment, "Asia/Kolkata").toISOString()).toBe(
      "2026-08-07T00:00:00.000Z",
    );
  });

  it("keeps the work date on the local day across the UTC boundary", () => {
    // 2026-08-07T20:00:00Z is 01:30 IST on the 8th.
    const moment = new Date("2026-08-07T20:00:00.000Z");
    expect(workDateInTimezone(moment, "Asia/Kolkata").toISOString()).toBe(
      "2026-08-08T00:00:00.000Z",
    );
  });
});
