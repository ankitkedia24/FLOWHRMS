/**
 * Field visits — the pure rules (FIELD-VISITS-MODULE.md §3, §4, §7).
 *
 * Which tap is allowed when, what a day adds up to, and the words the
 * reporting manager reads. No database, no session: shared by the server
 * actions, the pages and the phone, and tested on its own.
 */

import { distanceMetres, formatClockTime } from "@/lib/attendance/policy";
import { withArticle } from "./policy";

export type Tap = "GOING_OUT" | "ARRIVE" | "LEAVE" | "BACK";

/**
 * Where someone is in their working day, as far as field visits go.
 * A trip only exists inside an open day (§2).
 */
export type FieldPhase = "NOT_CHECKED_IN" | "AT_OFFICE" | "OUT" | "AT_PLACE";

export function phaseOf(input: { dayOpen: boolean; tripOpen: boolean; visitOpen: boolean }): FieldPhase {
  if (!input.dayOpen) return "NOT_CHECKED_IN";
  if (input.visitOpen) return "AT_PLACE";
  if (input.tripOpen) return "OUT";
  return "AT_OFFICE";
}

/**
 * Why this tap can't happen now, or null when it can. The phone only ever
 * offers allowed taps; this is the server's word on it, and the text for a
 * queued tap that arrives out of turn.
 */
export function tapProblem(
  phase: FieldPhase,
  tap: Tap,
  words: { place: string; atName?: string | null },
): string | null {
  if (phase === "NOT_CHECKED_IN") {
    return "Check in first — a trip is part of your working day.";
  }
  const here = words.atName ?? `this ${words.place}`;
  switch (tap) {
    case "GOING_OUT":
      if (phase === "OUT") return "You're already out.";
      if (phase === "AT_PLACE") return `You're at ${here}. End that visit first.`;
      return null;
    case "ARRIVE":
      if (phase === "AT_PLACE") return `End your visit at ${here} first.`;
      return null;
    case "LEAVE":
      if (phase !== "AT_PLACE") return `You aren't at ${withArticle(words.place)} right now.`;
      return null;
    case "BACK":
      if (phase === "AT_OFFICE") return "You're already at the office.";
      if (phase === "AT_PLACE") return `End your visit at ${here} first.`;
      return null;
  }
}

export const PLACE_NAME_MAX = 80;
export const NOTE_MAX = 500;

/** One line, single spaces, capped. */
export function tidyPlaceName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, PLACE_NAME_MAX);
}

/** For spotting a repeat: "Sharma  Traders" and "sharma traders" match. */
export function placeNameKey(name: string): string {
  return tidyPlaceName(name).toLowerCase();
}

export interface Spot {
  lat: number;
  lng: number;
}

/** Saved places, nearest first; places with no known distance go last, by name. */
export function nearestFirst<T extends Spot & { name: string }>(
  places: readonly T[],
  here: Spot | null,
): Array<T & { distanceM: number | null }> {
  const withDistance = places.map((p) => ({
    ...p,
    distanceM: here ? Math.round(distanceMetres(here, p)) : null,
  }));
  return withDistance.sort((a, b) => {
    if (a.distanceM !== null && b.distanceM !== null && a.distanceM !== b.distanceM) {
      return a.distanceM - b.distanceM;
    }
    if (a.distanceM === null && b.distanceM !== null) return 1;
    if (b.distanceM === null && a.distanceM !== null) return -1;
    return a.name.localeCompare(b.name);
  });
}

/** Straight-line metres between two tapped spots — an estimate, never the claim figure. */
export function straightMetres(from: Spot, to: Spot): number {
  return Math.round(distanceMetres(from, to));
}

/** "450 m", "6.2 km". */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.max(0, Math.round(metres / 10) * 10)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

// ---------------------------------------------------------------- a day

export interface DayLeg {
  meters: number | null;
  method: "ROAD" | "STRAIGHT" | null;
  status: "PENDING" | "DONE" | "FAILED";
}

export interface DayVisit {
  placeName: string;
  purposeName: string | null;
  arrivedAt: Date;
  leftAt: Date | null;
  endKind: "ENDED" | "CHECKED_OUT" | "NOT_RECORDED" | "CORRECTED" | null;
  isFar: boolean;
  hasPhoto: boolean;
  note: string | null;
}

export interface DayTrip {
  id: string;
  startedAt: Date;
  startEstimated: boolean;
  endedAt: Date | null;
  endKind: "BACK_AT_OFFICE" | "CHECKED_OUT" | "NOT_RECORDED" | null;
  approval: "NOT_NEEDED" | "PENDING" | "APPROVED" | "DECLINED";
  visits: DayVisit[];
  /**
   * By position: [0] to the first visit, then between visits, then back.
   * A hole means no location at one end, so no distance.
   */
  legs: Array<DayLeg | undefined>;
}

export interface DaySummary {
  trips: number;
  visits: number;
  /** Going out to back, or to now while still out. */
  outMinutes: number;
  atPlaceMinutes: number;
  metres: number;
  /** Some of the distance is a straight-line estimate, not yet by road. */
  estimated: boolean;
  /** Something was left open when the day closed. */
  notRecorded: number;
}

function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
}

/** "42 min", "1 h 23 min", "2 h" — for sentences; tables use h:mm. */
export function formatStay(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/**
 * What the day adds up to. Open trips and visits count up to `now`;
 * anything not recorded counts nothing — FlowHRMS never invents a time.
 */
export function summariseDay(trips: readonly DayTrip[], now: Date): DaySummary {
  let outMinutes = 0;
  let atPlaceMinutes = 0;
  let metres = 0;
  let estimated = false;
  let visits = 0;
  let notRecorded = 0;

  for (const trip of trips) {
    if (trip.endKind === "NOT_RECORDED") notRecorded += 1;
    else if (trip.endKind === null) outMinutes += minutesBetween(trip.startedAt, now);
    else if (trip.endedAt) outMinutes += minutesBetween(trip.startedAt, trip.endedAt);

    for (const v of trip.visits) {
      visits += 1;
      if (v.endKind === "NOT_RECORDED") {
        if (trip.endKind !== "NOT_RECORDED") notRecorded += 1;
        continue;
      }
      const end = v.leftAt ?? (v.endKind === null ? now : null);
      if (end) atPlaceMinutes += minutesBetween(v.arrivedAt, end);
    }

    for (const leg of trip.legs) {
      if (!leg || leg.meters === null) continue;
      metres += leg.meters;
      if (leg.method !== "ROAD") estimated = true;
    }
  }

  return { trips: trips.length, visits, outMinutes, atPlaceMinutes, metres, estimated, notRecorded };
}

export type TimelineEntry =
  | { kind: "out"; at: Date; label: string; detail?: string }
  | { kind: "leg"; label: string }
  | { kind: "visit"; at: Date; label: string; detail: string; flag?: string; index: number }
  | { kind: "back"; at: Date; label: string }
  | { kind: "gap"; label: string };

/** The trips of a day as the person (and their manager) reads them. */
export function tripTimeline(trip: DayTrip, now: Date): TimelineEntry[] {
  const legLabel = (leg: DayLeg | undefined) =>
    !leg || leg.meters === null
      ? "Distance not known — no location at one end"
      : leg.method === "ROAD"
        ? `${formatDistance(leg.meters)} by road`
        : `About ${formatDistance(leg.meters)} (straight line, until the road distance is ready)`;

  const entries: TimelineEntry[] = [
    {
      kind: "out",
      at: trip.startedAt,
      label: trip.startEstimated ? "Went out (time estimated)" : "Went out",
      detail: trip.startEstimated ? "Going out wasn't tapped; the trip starts at the first visit." : undefined,
    },
  ];

  trip.visits.forEach((v, i) => {
    entries.push({ kind: "leg", label: legLabel(trip.legs[i]) });
    const stayed =
      v.endKind === "NOT_RECORDED"
        ? "left time not recorded"
        : formatStay(minutesBetween(v.arrivedAt, v.leftAt ?? now)) + (v.leftAt ? "" : " so far");
    const parts = [stayed, v.purposeName, v.hasPhoto ? "photo" : null].filter(Boolean);
    entries.push({
      kind: "visit",
      index: i,
      at: v.arrivedAt,
      label: v.placeName,
      detail: parts.join(" · "),
      flag: v.isFar ? "Away from the saved spot" : v.endKind === "CORRECTED" ? "Time corrected" : undefined,
    });
  });

  if (trip.endKind === "BACK_AT_OFFICE" || trip.endKind === "CHECKED_OUT") {
    entries.push({ kind: "leg", label: legLabel(trip.legs[trip.visits.length]) });
    entries.push({
      kind: "back",
      at: trip.endedAt ?? trip.startedAt,
      label: trip.endKind === "BACK_AT_OFFICE" ? "Back at office" : "Checked out while out",
    });
  } else if (trip.endKind === "NOT_RECORDED") {
    entries.push({ kind: "gap", label: "The day closed before the trip ended, so the rest wasn't recorded." });
  }

  return entries;
}

// ---------------------------------------------------------------- nudges

export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName;
}

/** The approval tile (§4). Written once, when the trip starts. */
export function tripTileText(input: {
  name: string;
  at: Date;
  timeZone: string;
  skippedGoingOut: boolean;
  placeName?: string | null;
}): { title: string; body: string } {
  const when = formatClockTime(input.at, input.timeZone);
  return input.skippedGoingOut
    ? {
        title: `${input.name} is out on a trip`.slice(0, 60),
        body: `Reached ${input.placeName ?? "a visit"} at ${when} without tapping Going out. Approve or decline the trip.`,
      }
    : {
        title: `${input.name} is going out`.slice(0, 60),
        body: `Went out at ${when}. Approve or decline the trip.`,
      };
}

/** Information notices for the other taps (§4): nothing to decide. */
export function tapNoticeText(
  tap: "ARRIVE" | "LEAVE" | "BACK" | "CHECKED_OUT",
  input: {
    name: string;
    timeZone: string;
    at: Date;
    placeName?: string | null;
    purposeName?: string | null;
    since?: Date | null;
    visits?: number;
  },
): { title: string; body: string } {
  const first = firstName(input.name);
  const when = formatClockTime(input.at, input.timeZone);
  const since = input.since ? formatClockTime(input.since, input.timeZone) : null;
  switch (tap) {
    case "ARRIVE":
      return {
        title: `${first} reached ${input.placeName ?? "a visit"}`.slice(0, 60),
        body: [when, input.purposeName].filter(Boolean).join(" · "),
      };
    case "LEAVE":
      return {
        title: `${first} left ${input.placeName ?? "a visit"}`.slice(0, 60),
        body: since
          ? `${since} – ${when} (${formatStay(minutesBetween(input.since!, input.at))})`
          : `Left at ${when}`,
      };
    case "BACK":
      return {
        title: `${first} is back at the office`.slice(0, 60),
        body: `${since ? `Out ${since} – ${when}` : `Back at ${when}`}${
          input.visits ? ` · ${input.visits} visit${input.visits === 1 ? "" : "s"}` : ""
        }`,
      };
    case "CHECKED_OUT":
      return {
        title: `${first} checked out while out`.slice(0, 60),
        body: `Checked out at ${when}${input.placeName ? `, at ${input.placeName}` : ""}.`,
      };
  }
}

// ---------------------------------------------------------------- who decides

/**
 * Who may approve or decline a trip (§4, §5): the person's reporting
 * manager, the head of their department, or anyone who sees everyone's
 * field visits. Never the person themselves.
 */
export function mayDecideTrip(input: {
  viewerMembershipId: string;
  viewerSeesEveryone: boolean;
  person: { membershipId: string; reportingToId: string | null; departmentHeadId: string | null };
}): boolean {
  const { viewerMembershipId: me, person } = input;
  if (person.membershipId === me) return false;
  return input.viewerSeesEveryone || person.reportingToId === me || person.departmentHeadId === me;
}

/** Who may look at a trip: the person, and whoever may decide it. */
export function mayViewTrip(input: Parameters<typeof mayDecideTrip>[0]): boolean {
  return input.person.membershipId === input.viewerMembershipId || mayDecideTrip(input);
}

// ---------------------------------------------------------------- times

/** The calendar day (YYYY-MM-DD) an instant falls on, in a timezone. */
export function dateKeyIn(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(date);
}

/** A wall-clock time ("18:30") on a calendar day in a timezone, as an instant. */
export function zonedDateTime(dateKey: string, hhmm: string, timeZone: string): Date {
  const guess = new Date(`${dateKey}T${hhmm}:00.000Z`);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(guess);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  // What the zone's clock shows at that instant, read as if it were UTC.
  const shown = new Date(`${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:00.000Z`);
  return new Date(guess.getTime() - (shown.getTime() - guess.getTime()));
}
