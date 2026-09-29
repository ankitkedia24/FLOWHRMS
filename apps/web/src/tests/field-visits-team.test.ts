import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";
import { BOARD_ORDER, boardStatus, monthRange, personTotals, type DayTrip } from "@/lib/field-visits/state";

const at = (hhmm: string, day = "29") => new Date(`2026-09-${day}T${hhmm}:00+05:30`);

const visit = (over: Partial<DayTrip["visits"][number]> = {}): DayTrip["visits"][number] => ({
  placeName: "Sharma Traders",
  purposeName: null,
  arrivedAt: at("11:00"),
  leftAt: at("11:30"),
  endKind: "ENDED",
  isFar: false,
  hasPhoto: false,
  note: null,
  ...over,
});

const trip = (over: Partial<DayTrip> = {}): DayTrip => ({
  id: "t",
  startedAt: at("10:30"),
  startEstimated: false,
  endedAt: at("12:30"),
  endKind: "BACK_AT_OFFICE",
  approval: "APPROVED",
  visits: [visit()],
  legs: [
    { meters: 6000, method: "ROAD", status: "DONE" },
    { meters: 5000, method: "STRAIGHT", status: "PENDING" },
  ],
  ...over,
});

const day = { checkInAt: at("09:30"), checkOutAt: null };

describe("where someone is, on the owner's board", () => {
  it("at a place, with its name and since when", () => {
    const s = boardStatus({ day, trips: [trip({ endKind: null, endedAt: null, visits: [visit({ leftAt: null, endKind: null })] })] });
    expect(s).toEqual({ kind: "AT_PLACE", placeName: "Sharma Traders", since: at("11:00") });
  });

  it("out between places, with where they were last", () => {
    const s = boardStatus({ day, trips: [trip({ endKind: null, endedAt: null })] });
    expect(s).toEqual({ kind: "OUT", since: at("10:30"), lastPlaceName: "Sharma Traders" });
  });

  it("the latest trip decides, whatever order they come in", () => {
    const earlier = trip({ id: "a", startedAt: at("09:45"), endedAt: at("10:00") });
    const now = trip({ id: "b", startedAt: at("14:00"), endKind: null, endedAt: null, visits: [] });
    expect(boardStatus({ day, trips: [now, earlier] }).kind).toBe("OUT");
  });

  it("flags a visit nobody ended", () => {
    const s = boardStatus({
      day: { checkInAt: at("09:30", "28"), checkOutAt: null },
      trips: [trip({ endKind: "NOT_RECORDED", endedAt: null, visits: [visit({ leftAt: null, endKind: "NOT_RECORDED" })] })],
    });
    expect(s).toEqual({ kind: "NEEDS_CORRECTION", placeName: "Sharma Traders" });
  });

  it("back, at the office, checked out, or not in", () => {
    expect(boardStatus({ day, trips: [trip()] })).toEqual({ kind: "BACK", at: at("12:30") });
    expect(boardStatus({ day, trips: [] })).toEqual({ kind: "AT_OFFICE", since: at("09:30") });
    expect(boardStatus({ day: { ...day, checkOutAt: at("18:30") }, trips: [trip()] })).toEqual({ kind: "CHECKED_OUT", at: at("18:30") });
    expect(boardStatus({ day: null, trips: [] })).toEqual({ kind: "NOT_IN" });
  });

  it("puts people who are out at the top", () => {
    expect(BOARD_ORDER.AT_PLACE).toBeLessThan(BOARD_ORDER.NEEDS_CORRECTION);
    expect(BOARD_ORDER.NEEDS_CORRECTION).toBeLessThan(BOARD_ORDER.AT_OFFICE);
    expect(BOARD_ORDER.AT_OFFICE).toBeLessThan(BOARD_ORDER.NOT_IN);
  });
});

describe("a person's month, added up", () => {
  it("counts days, visits, time and distance — road and estimated apart", () => {
    const t = personTotals(
      [
        { ...trip({ id: "1" }), dayKey: "2026-09-28" },
        { ...trip({ id: "2", approval: "DECLINED" }), dayKey: "2026-09-29" },
        { ...trip({ id: "3", approval: "PENDING" }), dayKey: "2026-09-29" },
      ],
      at("23:00"),
    );
    expect(t).toMatchObject({
      daysOut: 2,
      trips: 3,
      visits: 3,
      atPlaceMinutes: 90,
      outMinutes: 360,
      finalMetres: 18000,
      estimatedMetres: 15000,
      declined: 1,
      awaiting: 1,
      notEnded: 0,
    });
  });
});

describe("months", () => {
  it("knows how long each month is", () => {
    expect(monthRange("2026-09")).toEqual({ first: "2026-09-01", last: "2026-09-30" });
    expect(monthRange("2028-02")).toEqual({ first: "2028-02-01", last: "2028-02-29" });
    expect(monthRange("2026-13")).toBeNull();
    expect(monthRange("Sept")).toBeNull();
  });
});

describe("CSV that opens safely in a spreadsheet", () => {
  it("escapes commas and quotes", () => {
    expect(csvCell('Sharma "& Sons", Old Town')).toBe('"Sharma ""& Sons"", Old Town"');
  });

  it("never lets typed text run as a formula", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+91 98765")).toBe("'+91 98765");
    expect(csvCell("@sum")).toBe("'@sum");
  });

  it("leaves numbers alone, negative ones included", () => {
    expect(csvCell(-12.5)).toBe("-12.5");
    expect(toCsv(["A", "B"], [[1, "x"]])).toBe("A,B\r\n1,x");
  });
});
