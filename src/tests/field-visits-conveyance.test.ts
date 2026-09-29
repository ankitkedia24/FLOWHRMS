import { describe, expect, it } from "vitest";
import {
  checkClaimedKm,
  claimableMonths,
  monthName,
  monthTravel,
  toKm,
  travelAmount,
  type DayTrip,
} from "@/lib/field-visits/state";

const trip = (dayKey: string, over: Partial<DayTrip> = {}): DayTrip & { dayKey: string } => ({
  id: `${dayKey}-${Math.random()}`,
  dayKey,
  startedAt: new Date(`${dayKey}T05:00:00Z`),
  startEstimated: false,
  endedAt: new Date(`${dayKey}T08:00:00Z`),
  endKind: "BACK_AT_OFFICE",
  approval: "APPROVED",
  visits: [],
  legs: [
    { meters: 6200, method: "ROAD", status: "DONE" },
    { meters: 3100, method: "STRAIGHT", status: "PENDING" },
  ],
  ...over,
});

describe("a month's travel", () => {
  it("adds up day by day, with the estimated part kept apart", () => {
    const t = monthTravel([trip("2026-09-02"), trip("2026-09-02"), trip("2026-09-15")]);
    expect(t.days).toEqual([
      { date: "2026-09-02", km: 18.6, estimatedKm: 6.2, trips: 2 },
      { date: "2026-09-15", km: 9.3, estimatedKm: 3.1, trips: 1 },
    ]);
    expect(t).toMatchObject({ recordedKm: 27.9, estimatedKm: 9.3, tripsCounted: 3, tripsAwaiting: 0, tripsDeclined: 0 });
  });

  it("leaves declined trips out, and counts undecided ones with a flag", () => {
    const t = monthTravel([
      trip("2026-09-02", { approval: "DECLINED" }),
      trip("2026-09-03", { approval: "PENDING" }),
      trip("2026-09-04", { approval: "NOT_NEEDED" }),
    ]);
    expect(t).toMatchObject({ tripsCounted: 2, tripsAwaiting: 1, tripsDeclined: 1, recordedKm: 18.6 });
    expect(t.days.map((d) => d.date)).toEqual(["2026-09-03", "2026-09-04"]);
  });

  it("counts nothing for a stretch without a location", () => {
    const t = monthTravel([trip("2026-09-02", { legs: [undefined, { meters: null, method: null, status: "FAILED" }] })]);
    expect(t.recordedKm).toBe(0);
    expect(t.tripsCounted).toBe(1);
  });
});

describe("the claim's figures", () => {
  it("rounds kilometres to one decimal and money to paise", () => {
    expect(toKm(212_449)).toBe(212.4);
    expect(travelAmount(212.4, 3.5)).toBe(743.4);
    expect(travelAmount(10.3, 3.33)).toBe(34.3);
  });

  it("takes the recorded kilometres as they are", () => {
    expect(checkClaimedKm(212.4, 212.4, undefined)).toEqual({ ok: true, km: 212.4, changed: false });
  });

  it("needs a reason to claim anything else", () => {
    expect(checkClaimedKm(212.4, 250, undefined)).toMatchObject({ ok: false });
    expect(checkClaimedKm(212.4, 250, "  ")).toMatchObject({ ok: false });
    expect(checkClaimedKm(212.4, 250, "Road closed at Rasulgarh")).toEqual({ ok: true, km: 250, changed: true });
    expect(checkClaimedKm(0, 40, "My location was off")).toEqual({ ok: true, km: 40, changed: true });
  });

  it("refuses nothing, negatives and the impossible", () => {
    expect(checkClaimedKm(10, 0, "x")).toMatchObject({ ok: false });
    expect(checkClaimedKm(10, -5, "x")).toMatchObject({ ok: false });
    expect(checkClaimedKm(10, 50_000, "x")).toMatchObject({ ok: false });
  });
});

describe("which months can be claimed", () => {
  it("only months that have ended, newest first", () => {
    expect(claimableMonths("2026-09")).toEqual(["2026-08", "2026-07", "2026-06"]);
    expect(claimableMonths("2026-01", 2)).toEqual(["2025-12", "2025-11"]);
  });

  it("names a month", () => {
    expect(monthName("2026-09")).toBe("September 2026");
  });
});
