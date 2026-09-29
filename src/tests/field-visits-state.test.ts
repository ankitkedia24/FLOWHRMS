import { describe, expect, it } from "vitest";
import {
  formatDistance,
  dateKeyIn,
  formatStay,
  zonedDateTime,
  mayDecideTrip,
  mayViewTrip,
  nearestFirst,
  phaseOf,
  placeNameKey,
  summariseDay,
  tapNoticeText,
  tapProblem,
  tidyPlaceName,
  tripTileText,
  tripTimeline,
  type DayTrip,
} from "@/lib/field-visits/state";

const TZ = "Asia/Kolkata";
// 29 Sept 2026, times in IST (UTC+5:30).
const at = (hhmm: string) => new Date(`2026-09-29T${hhmm}:00+05:30`);

describe("where someone is", () => {
  it("needs an open day before anything else", () => {
    expect(phaseOf({ dayOpen: false, tripOpen: true, visitOpen: true })).toBe("NOT_CHECKED_IN");
    expect(phaseOf({ dayOpen: true, tripOpen: false, visitOpen: false })).toBe("AT_OFFICE");
    expect(phaseOf({ dayOpen: true, tripOpen: true, visitOpen: false })).toBe("OUT");
    expect(phaseOf({ dayOpen: true, tripOpen: true, visitOpen: true })).toBe("AT_PLACE");
  });
});

describe("which tap is allowed when", () => {
  const words = { place: "place", atName: "Sharma Traders" };

  it("allows the four taps in their order", () => {
    expect(tapProblem("AT_OFFICE", "GOING_OUT", words)).toBeNull();
    expect(tapProblem("OUT", "ARRIVE", words)).toBeNull();
    expect(tapProblem("AT_PLACE", "LEAVE", words)).toBeNull();
    expect(tapProblem("OUT", "BACK", words)).toBeNull();
  });

  it("lets someone skip Going out and tap Reached from the office", () => {
    expect(tapProblem("AT_OFFICE", "ARRIVE", words)).toBeNull();
  });

  it("refuses everything before check-in", () => {
    for (const tap of ["GOING_OUT", "ARRIVE", "LEAVE", "BACK"] as const) {
      expect(tapProblem("NOT_CHECKED_IN", tap, words)).toMatch(/Check in first/);
    }
  });

  it("says what to do instead, using the place's name and the company's word", () => {
    expect(tapProblem("AT_PLACE", "ARRIVE", words)).toBe("End your visit at Sharma Traders first.");
    expect(tapProblem("AT_PLACE", "BACK", words)).toBe("End your visit at Sharma Traders first.");
    expect(tapProblem("OUT", "GOING_OUT", words)).toBe("You're already out.");
    expect(tapProblem("AT_OFFICE", "BACK", words)).toBe("You're already at the office.");
    expect(tapProblem("OUT", "LEAVE", { place: "outlet" })).toBe("You aren't at an outlet right now.");
  });
});

describe("place names", () => {
  it("tidies spacing and finds repeats regardless of case", () => {
    expect(tidyPlaceName("  Sharma   Traders ")).toBe("Sharma Traders");
    expect(placeNameKey("Sharma  TRADERS")).toBe(placeNameKey("sharma traders"));
    expect(tidyPlaceName("x".repeat(200))).toHaveLength(80);
  });

  it("lists the nearest first, and unknown distances last by name", () => {
    const here = { lat: 20.2961, lng: 85.8245 };
    const places = [
      { name: "Far", lat: 20.35, lng: 85.9 },
      { name: "Near", lat: 20.2965, lng: 85.8249 },
      { name: "Mid", lat: 20.31, lng: 85.83 },
    ];
    expect(nearestFirst(places, here).map((p) => p.name)).toEqual(["Near", "Mid", "Far"]);
    expect(nearestFirst(places, here)[0].distanceM).toBeLessThan(100);
    expect(nearestFirst(places, null).map((p) => p.name)).toEqual(["Far", "Mid", "Near"]);
  });
});

describe("numbers people read", () => {
  it("shows short distances in metres and longer ones in km", () => {
    expect(formatDistance(83)).toBe("80 m");
    expect(formatDistance(6240)).toBe("6.2 km");
  });

  it("shows stays in words", () => {
    expect(formatStay(42)).toBe("42 min");
    expect(formatStay(83)).toBe("1 h 23 min");
    expect(formatStay(120)).toBe("2 h");
  });
});

const tripOf = (over: Partial<DayTrip> = {}): DayTrip => ({
  id: "t1",
  startedAt: at("10:40"),
  startEstimated: false,
  endedAt: at("13:49"),
  endKind: "BACK_AT_OFFICE",
  approval: "APPROVED",
  visits: [
    { placeName: "Sharma Traders", purposeName: "Sales", arrivedAt: at("11:05"), leftAt: at("11:47"), endKind: "ENDED", isFar: false, hasPhoto: false, note: null },
    { placeName: "Gupta Medical", purposeName: "Collection", arrivedAt: at("12:01"), leftAt: at("13:24"), endKind: "ENDED", isFar: true, hasPhoto: true, note: null },
  ],
  legs: [
    { meters: 6200, method: "ROAD", status: "DONE" },
    { meters: 3100, method: "STRAIGHT", status: "PENDING" },
    { meters: 7400, method: "ROAD", status: "DONE" },
  ],
  ...over,
});

describe("what a day adds up to", () => {
  it("adds the time out, the time at places and the distance", () => {
    const s = summariseDay([tripOf()], at("18:00"));
    expect(s).toMatchObject({ trips: 1, visits: 2, outMinutes: 189, atPlaceMinutes: 42 + 83, metres: 16700 });
    expect(s.estimated).toBe(true);
    expect(s.notRecorded).toBe(0);
  });

  it("counts an open trip and visit up to now", () => {
    const open = tripOf({
      endedAt: null,
      endKind: null,
      visits: [{ placeName: "Sharma Traders", purposeName: null, arrivedAt: at("11:05"), leftAt: null, endKind: null, isFar: false, hasPhoto: false, note: null }],
      legs: [{ meters: 6200, method: "ROAD", status: "DONE" }],
    });
    const s = summariseDay([open], at("11:35"));
    expect(s.outMinutes).toBe(55);
    expect(s.atPlaceMinutes).toBe(30);
    expect(s.estimated).toBe(false);
  });

  it("never invents time for what wasn't recorded", () => {
    const lost = tripOf({
      endedAt: null,
      endKind: "NOT_RECORDED",
      visits: [{ placeName: "Sharma Traders", purposeName: null, arrivedAt: at("11:05"), leftAt: null, endKind: "NOT_RECORDED", isFar: false, hasPhoto: false, note: null }],
      legs: [{ meters: null, method: null, status: "FAILED" }],
    });
    const s = summariseDay([lost], at("23:00"));
    expect(s).toMatchObject({ outMinutes: 0, atPlaceMinutes: 0, metres: 0, notRecorded: 1 });
  });
});

describe("the day as a timeline", () => {
  it("reads in order, with legs between the stops", () => {
    const lines = tripTimeline(tripOf(), at("18:00"));
    expect(lines.map((l) => l.kind)).toEqual(["out", "leg", "visit", "leg", "visit", "leg", "back"]);
    expect(lines[1]).toEqual({ kind: "leg", label: "6.2 km by road" });
    expect(lines[3].label).toMatch(/^About 3.1 km \(straight line/);
    expect(lines[4]).toMatchObject({ label: "Gupta Medical", detail: "1 h 23 min · Collection · photo", flag: "Away from the saved spot" });
    expect(lines[6]).toMatchObject({ kind: "back", label: "Back at office" });
  });

  it("says when the start was estimated, and when the rest wasn't recorded", () => {
    const lines = tripTimeline(
      tripOf({ startEstimated: true, endKind: "NOT_RECORDED", endedAt: null, legs: [] }),
      at("23:00"),
    );
    expect(lines[0].label).toBe("Went out (time estimated)");
    expect(lines[1]).toEqual({ kind: "leg", label: "Distance not known — no location at one end" });
    expect(lines.at(-1)).toMatchObject({ kind: "gap" });
  });
});

describe("what the reporting manager reads", () => {
  it("asks for approval when someone goes out", () => {
    const t = tripTileText({ name: "Rohit Das", at: at("10:40"), timeZone: TZ, skippedGoingOut: false });
    expect(t.title).toBe("Rohit Das is going out");
    expect(t.body).toMatch(/^Went out at 10:40 am\. Approve or decline the trip\.$/i);
  });

  it("still asks when Going out was skipped", () => {
    const t = tripTileText({ name: "Rohit Das", at: at("11:05"), timeZone: TZ, skippedGoingOut: true, placeName: "Sharma Traders" });
    expect(t.title).toBe("Rohit Das is out on a trip");
    expect(t.body).toMatch(/Reached Sharma Traders at 11:05 am without tapping Going out/i);
  });

  it("informs at the other taps, first name only", () => {
    expect(tapNoticeText("ARRIVE", { name: "Rohit Das", timeZone: TZ, at: at("11:05"), placeName: "Sharma Traders", purposeName: "Sales" })).toEqual({
      title: "Rohit reached Sharma Traders",
      body: expect.stringMatching(/^11:05 am · Sales$/i),
    });
    expect(tapNoticeText("LEAVE", { name: "Rohit Das", timeZone: TZ, at: at("11:47"), since: at("11:05"), placeName: "Sharma Traders" }).body).toMatch(
      /11:05 am – 11:47 am \(42 min\)/i,
    );
    expect(tapNoticeText("BACK", { name: "Rohit Das", timeZone: TZ, at: at("13:49"), since: at("10:40"), visits: 2 }).body).toMatch(
      /^Out 10:40 am – 1:49 pm · 2 visits$/i,
    );
    expect(tapNoticeText("CHECKED_OUT", { name: "Rohit Das", timeZone: TZ, at: at("18:40"), placeName: "Gupta Medical" }).title).toBe(
      "Rohit checked out while out",
    );
  });
});

describe("who decides a trip", () => {
  const person = { membershipId: "rohit", reportingToId: "meera", departmentHeadId: "suresh" };
  const as = (me: string, everyone = false) => ({ viewerMembershipId: me, viewerSeesEveryone: everyone, person });

  it("the reporting manager, the department head, or someone who sees everyone", () => {
    expect(mayDecideTrip(as("meera"))).toBe(true);
    expect(mayDecideTrip(as("suresh"))).toBe(true);
    expect(mayDecideTrip(as("owner", true))).toBe(true);
    expect(mayDecideTrip(as("colleague"))).toBe(false);
  });

  it("never the person themselves, even with the permission", () => {
    expect(mayDecideTrip(as("rohit", true))).toBe(false);
    expect(mayViewTrip(as("rohit"))).toBe(true);
    expect(mayViewTrip(as("colleague"))).toBe(false);
  });
});

describe("times in the company's timezone", () => {
  it("turns a wall-clock time into the right instant", () => {
    expect(zonedDateTime("2026-09-29", "11:47", TZ).toISOString()).toBe("2026-09-29T06:17:00.000Z");
    expect(zonedDateTime("2026-09-29", "00:10", TZ).toISOString()).toBe("2026-09-28T18:40:00.000Z");
  });

  it("reads the calendar day where the company is", () => {
    expect(dateKeyIn(new Date("2026-09-28T19:00:00Z"), TZ)).toBe("2026-09-29");
  });
});
