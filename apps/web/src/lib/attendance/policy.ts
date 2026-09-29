/**
 * Attendance policy logic — pure functions, no I/O.
 *
 * Rules come from the approved documents:
 * - Grace is INCLUSIVE: exactly `graceMinutes` late is NOT late
 *   (edge-cases.md → "Late exactly at the grace boundary").
 * - GPS accuracy worse than 200 m cannot confirm the area; it becomes the
 *   outside-area approval path, never a silent pass or silent block.
 * - Consequences are computed, never generic
 *   (design-system-implementation-guide.md §5, decision D-011).
 *
 * Server time is authoritative for every recorded event; these helpers
 * receive the already-resolved server timestamp.
 */

import { dateKey, offDayOn, type OffDay, type WorkCalendar } from "./calendar";

export type LocationOutcome =
  | "INSIDE"
  | "OUTSIDE"
  | "UNCONFIRMED"
  | "NOT_REQUIRED";

/** Worst GPS accuracy that can still confirm a permitted area. */
export const MAX_ACCURACY_M = 200;

/** What a check-in tap should do, given how the day already stands. */
export type CheckInIntent =
  | "open-day" // nothing recorded yet — first punch of the day
  | "already-open" // checked in and still in; the tap is a repeat
  | "new-punch" // day was closed and multiple punches are allowed
  | "day-closed"; // day was closed and they are not

/**
 * One decision, in one place, for "can they check in right now?".
 *
 * It used to be implied by a UI branch that simply omitted the button and
 * a server action that silently returned "already recorded". Neither said
 * no, and neither said why — which edge-cases.md rules out: a blocked
 * second check-in is "blocked with an explanation, not a silent no-op".
 */
export function checkInIntent(input: {
  checkedIn: boolean;
  checkedOut: boolean;
  multiplePunchAllowed: boolean;
}): CheckInIntent {
  if (!input.checkedIn) return "open-day";
  if (!input.checkedOut) return "already-open";
  return input.multiplePunchAllowed ? "new-punch" : "day-closed";
}

/** An in/out pair. Open pairs (no check-out yet) count up to `now`. */
export interface WorkedPunch {
  checkInAt: Date;
  checkOutAt: Date | null;
}

/**
 * How long a visit may stay open before it stops being "at work".
 *
 * Long enough for any real shift including night work, so someone who
 * started at 22:00 can still check out at 06:00 the next morning — the case
 * that was broken. Short enough that a forgotten check-out becomes a
 * missed punch needing a correction, rather than a 26-hour day recorded as
 * fact.
 */
export const MAX_OPEN_VISIT_HOURS = 18;

/** Has this visit been open so long that it is a forgotten check-out? */
export function isVisitStale(checkInAt: Date, now: Date): boolean {
  return now.getTime() - checkInAt.getTime() > MAX_OPEN_VISIT_HOURS * 3_600_000;
}

/** Is a day carrying a visit nobody closed? */
export function hasUnrecordedCheckOut(
  punches: readonly WorkedPunch[],
  now: Date,
): boolean {
  return punches.some((p) => !p.checkOutAt && isVisitStale(p.checkInAt, now));
}

/**
 * Minutes actually worked across a day's punches.
 *
 * Deliberately NOT last-out minus first-in: with more than one punch that
 * counts the gap between them — lunch, a delivery run, a trip home — as
 * time at work. Summing the pairs is the only version that stays true once
 * a day can be left and returned to.
 *
 * A visit left open past the deadline contributes NOTHING, rather than
 * climbing for ever. Someone who forgot to check out on Tuesday did not
 * work forty hours on Tuesday, and edge-cases.md forbids the alternative
 * of quietly inventing an end time: "No automatic check-out time is
 * invented." Zero and a visible "not recorded" is the honest answer; the
 * correction flow is how a real number gets there.
 */
export function workedMinutes(punches: readonly WorkedPunch[], now: Date): number {
  let total = 0;
  for (const punch of punches) {
    if (!punch.checkOutAt && isVisitStale(punch.checkInAt, now)) continue;
    const end = punch.checkOutAt ?? now;
    const ms = end.getTime() - punch.checkInAt.getTime();
    if (ms > 0) total += ms / 60_000;
  }
  return total;
}

export interface ShiftPolicy {
  startMinutes: number;
  endMinutes: number;
  graceMinutes: number;
}

export interface BranchPolicy {
  /** Optional so single-branch fixtures and older callers still type-check. */
  id?: string;
  name: string;
  lat: number | null;
  lng: number | null;
  /** Already resolved: the branch override, or the tenant default. */
  radiusM: number;
}

export interface Coordinates {
  lat: number;
  lng: number;
  accuracyM?: number | null;
}

/** Great-circle distance in metres (haversine). */
export function distanceMetres(a: Coordinates, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface LocationAssessment {
  outcome: LocationOutcome;
  distanceM: number | null;
  /** Employee-facing wording — "permitted area", never "geofence". */
  label: string;
}

/**
 * Assess where the person is relative to their permitted area.
 * `locationRequired` is the resolved feature flag (geofence/gps_capture).
 */
export function assessLocation(input: {
  locationRequired: boolean;
  branch: BranchPolicy | null;
  coords: Coordinates | null;
}): LocationAssessment {
  const { locationRequired, branch, coords } = input;

  if (!locationRequired || !branch || branch.lat == null || branch.lng == null) {
    return { outcome: "NOT_REQUIRED", distanceM: null, label: "" };
  }

  if (!coords) {
    return {
      outcome: "UNCONFIRMED",
      distanceM: null,
      label: "Location is off",
    };
  }

  if (coords.accuracyM != null && coords.accuracyM > MAX_ACCURACY_M) {
    return {
      outcome: "UNCONFIRMED",
      distanceM: null,
      label: "Location could not be confirmed",
    };
  }

  const distanceM = distanceMetres(coords, {
    lat: branch.lat,
    lng: branch.lng,
  });

  if (distanceM <= branch.radiusM) {
    return {
      outcome: "INSIDE",
      distanceM,
      label: `Inside ${branch.name} area`,
    };
  }

  return {
    outcome: "OUTSIDE",
    distanceM,
    label: `Outside permitted area — ${formatDistance(distanceM)} away`,
  };
}

/** "1.4 km" / "320 m" — the copy deck's distance shape. */
export function formatDistance(metres: number): string {
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}

/* ------------------------------------------------------------------------
 * Multiple locations.
 *
 * A company may operate from several places. `assessLocation` above is
 * deliberately untouched — it answers "am I inside THIS area?". The layer
 * below answers "which of my permitted areas applies?" and then delegates,
 * so the employee-facing wording can never drift between the two paths.
 * --------------------------------------------------------------------- */

/**
 * Resolve a location's radius: its own override, else the tenant default.
 * `??` not `||` — a deliberate 0 m override is a real value, not "unset".
 */
export function effectiveRadiusM(
  branchRadiusM: number | null | undefined,
  tenantDefaultM: number,
): number {
  return branchRadiusM ?? tenantDefaultM;
}

/**
 * Which locations count as a permitted area for this person.
 *
 * The home location always counts — even if it has been deactivated, so
 * someone is never locked out by a config change mid-shift. Every other
 * ACTIVE location counts only when the person is marked as roaming AND the
 * tenant has the feature on; the flag is the control, the per-person
 * setting alone is not (Constitution §5).
 */
export function candidateBranches(input: {
  homeBranch: BranchPolicy | null;
  activeBranches: readonly BranchPolicy[];
  canCheckInAtAnyBranch: boolean;
  anyBranchFeatureOn: boolean;
}): BranchPolicy[] {
  const { homeBranch, activeBranches, canCheckInAtAnyBranch, anyBranchFeatureOn } =
    input;

  if (!canCheckInAtAnyBranch || !anyBranchFeatureOn) {
    return homeBranch ? [homeBranch] : [];
  }

  const seen = new Set<string>();
  const result: BranchPolicy[] = [];
  for (const branch of [...(homeBranch ? [homeBranch] : []), ...activeBranches]) {
    const key = branch.id ?? branch.name;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(branch);
  }
  return result;
}

export interface NearestBranch {
  branch: BranchPolicy;
  distanceM: number;
  inside: boolean;
}

/**
 * The location this position should be judged against.
 *
 * Being INSIDE beats being nearer-but-outside: with different radii per
 * location, a further branch whose own radius contains you is the correct
 * match. Ties resolve by distance then id so the result is deterministic.
 */
export function nearestBranch(
  branches: readonly BranchPolicy[],
  coords: Coordinates,
): NearestBranch | null {
  const measured = branches
    .filter((b) => b.lat != null && b.lng != null)
    .map((branch) => {
      const distanceM = distanceMetres(coords, {
        lat: branch.lat as number,
        lng: branch.lng as number,
      });
      return { branch, distanceM, inside: distanceM <= branch.radiusM };
    });

  if (measured.length === 0) return null;

  measured.sort((a, b) => {
    if (a.inside !== b.inside) return a.inside ? -1 : 1;
    if (a.distanceM !== b.distanceM) return a.distanceM - b.distanceM;
    return (a.branch.id ?? a.branch.name).localeCompare(
      b.branch.id ?? b.branch.name,
    );
  });

  return measured[0];
}

export interface AreaAssessment extends LocationAssessment {
  /** The location the outcome refers to. Null when no area applies. */
  branch: BranchPolicy | null;
}

/**
 * Assess a position against every permitted area. With one candidate the
 * result is identical to `assessLocation` — a parity test enforces that.
 */
export function assessArea(input: {
  locationRequired: boolean;
  branches: readonly BranchPolicy[];
  coords: Coordinates | null;
}): AreaAssessment {
  const { locationRequired, branches, coords } = input;

  const withCoords = branches.filter((b) => b.lat != null && b.lng != null);

  // No usable area, or the policy does not require one.
  if (!locationRequired || withCoords.length === 0) {
    return {
      ...assessLocation({ locationRequired, branch: null, coords }),
      branch: null,
    };
  }

  // Location off or too imprecise: the outcome does not depend on which
  // area we name, so delegate with the first candidate and keep the copy.
  if (!coords || (coords.accuracyM != null && coords.accuracyM > MAX_ACCURACY_M)) {
    return {
      ...assessLocation({ locationRequired, branch: withCoords[0], coords }),
      branch: null,
    };
  }

  const match = nearestBranch(withCoords, coords);
  if (!match) {
    return {
      ...assessLocation({ locationRequired, branch: null, coords }),
      branch: null,
    };
  }

  return {
    ...assessLocation({ locationRequired, branch: match.branch, coords }),
    branch: match.branch,
  };
}

/**
 * Minutes late against the shift start, applying the inclusive grace rule.
 * `nowMinutes` is minutes-from-midnight in the tenant's timezone.
 */
export function lateMinutes(
  nowMinutes: number,
  shift: ShiftPolicy,
): number {
  const past = nowMinutes - shift.startMinutes;
  if (past <= shift.graceMinutes) return 0; // grace is inclusive
  return past;
}

/**
 * The consequence contract (implementation guide §5): a computed sentence
 * rendered before the control AND appended to its accessible name.
 * A generic fallback is not acceptable.
 */
export interface Consequence {
  sentence: string;
  detail?: string;
  requiresReason: boolean;
}

export function checkInConsequence(input: {
  location: LocationAssessment;
  lateBy: number;
  branchName?: string;
}): Consequence | null {
  const { location, lateBy, branchName } = input;

  if (location.outcome === "OUTSIDE" && location.distanceM != null) {
    return {
      sentence: `You are ${formatDistance(location.distanceM)} outside the ${branchName ?? "branch"} area.`,
      detail:
        "You can still check in. It will be sent to your manager for approval with your reason.",
      requiresReason: true,
    };
  }

  if (location.outcome === "UNCONFIRMED") {
    return {
      sentence: "Your location could not be confirmed.",
      detail:
        "You can still check in. It will be sent to your manager for approval with your reason.",
      requiresReason: true,
    };
  }

  if (lateBy > 0) {
    return {
      sentence: `Checking in now will record a late arrival of ${lateBy} minutes.`,
      detail: "Your manager will see this in today's attendance review.",
      requiresReason: false,
    };
  }

  return null;
}

/** Button label follows the consequence (copy-deck.md §2). */
export function checkInButtonLabel(consequence: Consequence | null): string {
  return consequence?.requiresReason ? "Check In — needs approval" : "Check In";
}

/* ------------------------------------------------------------------------
 * The check-in state contract.
 *
 * This lives in the PURE module on purpose: the server action and the
 * browser card both call `computeCheckInState`, so the sentence shown
 * before the tap is by construction the sentence that gets recorded
 * (design decision D-011). Putting it in a `server-only` module would
 * force the card to re-implement it, which is exactly the drift this
 * contract forbids.
 * --------------------------------------------------------------------- */

export interface TodayAttendance {
  recordId: string | null;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  lateMinutes: number;
  reviewStatus:
    | "NONE"
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "DETAILS_REQUESTED";
  exemptionStatus: "NONE" | "REQUESTED" | "EXEMPTED" | "DECLINED";
  checkInOutcome: LocationOutcome | null;
  checkInDistanceM: number | null;
  offlineCaptured: boolean;
  /** Every in/out pair today, in order. Hours are summed from these. */
  punches?: WorkedPunch[];
}

export interface AttendanceContext {
  timezone: string;
  /** The person's home location, if one is set. */
  homeBranch: BranchPolicy | null;
  /** Every permitted area for this person, radii already resolved. */
  branches: BranchPolicy[];
  canCheckInAtAnyBranch: boolean;
  /** The tenant has locations but this person has none assigned. */
  branchMissing: boolean;
  shift: ShiftPolicy & { name: string };
  locationRequired: boolean;
  /** ATTENDANCE.multiple_punch — may they come back after checking out? */
  multiplePunchAllowed: boolean;
  today: TodayAttendance | null;
  /**
   * The company calendar and this person's weekly offs. A check-in on a day
   * off is recorded but is never late. Optional: absent means "no days off",
   * which is how contexts built before the work calendar behaved.
   */
  workCalendar?: { calendar: WorkCalendar; weeklyOffDays: number[] };
  /** Today's day off, if it is one — resolved on the server for display. */
  offToday?: OffDay | null;
}

/** The day off `now` falls on for this person, if any. */
export function offDayAt(context: AttendanceContext, now: Date): OffDay | null {
  if (!context.workCalendar) return null;
  return offDayOn(
    dateKey(workDateInTimezone(now, context.timezone)),
    context.workCalendar.calendar,
    context.workCalendar.weeklyOffDays,
  );
}

export interface CheckInState {
  location: AreaAssessment;
  lateBy: number;
  consequence: Consequence | null;
}

/**
 * Everything the check-in control needs, from a context and a position.
 * The consequence names the MATCHED area, not the home one — an approver
 * reading "410 m outside the Bhiwandi Warehouse area" can act on it;
 * "31 km outside the Andheri Shop area" would mislead them.
 */
export function computeCheckInState(
  context: AttendanceContext,
  coords: Coordinates | null,
  now: Date,
): CheckInState {
  const location = assessArea({
    locationRequired: context.locationRequired,
    branches: context.branches,
    coords,
  });

  // Coming in on a weekly off or a holiday is never "late" — there was no
  // shift to be late for.
  const lateBy = offDayAt(context, now)
    ? 0
    : lateMinutes(minutesInTimezone(now, context.timezone), context.shift);

  return {
    location,
    lateBy,
    consequence: checkInConsequence({
      location,
      lateBy,
      branchName: location.branch?.name ?? context.homeBranch?.name,
    }),
  };
}

/* ------------------------------------------------------------------------
 * Evidence: what a past record says about itself.
 * --------------------------------------------------------------------- */

export interface SnapshotBranch {
  id?: string;
  name: string;
  lat: number | null;
  lng: number | null;
  radiusM: number;
}

/**
 * What was true when an attendance record was written. Stored on the
 * record so a later rename, move or policy change cannot alter what a
 * past day says (edge-cases.md → "Policy changed mid-month").
 *
 * `v` absent means the Phase 3 shape; old rows are never rewritten.
 */
export interface AttendanceSnapshot {
  v?: number;
  policyVersion?: number;
  locationRequired?: boolean;
  canCheckInAtAnyBranch?: boolean;
  shift?: (ShiftPolicy & { name?: string }) | null;
  homeBranch?: SnapshotBranch | null;
  matchedBranch?: SnapshotBranch | null;
  radiusSource?: "branch" | "tenant-default";
  candidateBranchCount?: number;
  outcome?: LocationOutcome;
  distanceM?: number | null;
  /** The exact sentence the employee read and accepted. */
  consequenceSentence?: string | null;
  /** Phase 3 shape kept for old rows. */
  radiusM?: number | null;
}

export interface RecordDescription {
  /** The location name as recorded, or the current one for older rows. */
  branchName: string | null;
  /** True when the name comes from a live join, not the record itself. */
  branchNameIsCurrent: boolean;
  radiusM: number | null;
  radiusSource: "branch" | "tenant-default" | null;
  consequenceSentence: string | null;
  policyVersion: number | null;
}

/**
 * Explain a stored attendance record, preferring what the record itself
 * captured over anything that may have changed since.
 */
export function describeAttendanceRecord(input: {
  snapshot: AttendanceSnapshot | null | undefined;
  /** Current name from the branch join, used only as a fallback. */
  currentBranchName?: string | null;
}): RecordDescription {
  const snapshot = input.snapshot ?? {};
  const recorded = snapshot.matchedBranch ?? snapshot.homeBranch ?? null;

  if (recorded?.name) {
    return {
      branchName: recorded.name,
      branchNameIsCurrent: false,
      radiusM: recorded.radiusM ?? snapshot.radiusM ?? null,
      radiusSource: snapshot.radiusSource ?? null,
      consequenceSentence: snapshot.consequenceSentence ?? null,
      policyVersion: snapshot.policyVersion ?? null,
    };
  }

  // Phase 3 rows carry no branch by value — fall back to the live join and
  // say so, rather than implying the name was the one recorded.
  return {
    branchName: input.currentBranchName ?? null,
    branchNameIsCurrent: input.currentBranchName != null,
    radiusM: snapshot.radiusM ?? null,
    radiusSource: null,
    consequenceSentence: snapshot.consequenceSentence ?? null,
    policyVersion: snapshot.policyVersion ?? null,
  };
}

/** Duration in data contexts is `h:mm` (implementation guide §8). */
export function formatDuration(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

/** Minutes from midnight for a date, in the given IANA timezone. */
export function minutesInTimezone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/** The tenant-local calendar date (YYYY-MM-DD) for a moment in time. */
export function workDateInTimezone(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(date);
  return new Date(`${parts}T00:00:00.000Z`);
}

/** "9:42 AM" in the tenant's timezone — confirmation copy. */
export function formatClockTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(date);
}

/** "Fri, 7 Aug 2026" — never MM/DD (implementation guide §8). */
export function formatLongDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date);
}

/** "09:30" from minutes-from-midnight. */
export function formatShiftTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** A queued action older than this is refused rather than back-dated. */
export const MAX_QUEUE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Tolerance for an ordinary clock drift before it counts as the future. */
export const CLOCK_SKEW_TOLERANCE_MS = 2 * 60 * 1000;

/**
 * Resolve a device-supplied capture time. Shared by attendance and field
 * visits, so a queued tap is judged by exactly the same rule.
 *
 * The device clock can be wrong or manipulated (edge-cases.md → "Phone
 * clock wrong"), so a time in the future or improbably old is refused
 * outright rather than quietly trusted or quietly ignored.
 */
export function resolveCapturedAt(
  raw: string | undefined,
  now: Date,
): { at: Date | null; skewMs: number; rejected?: string } {
  if (!raw) return { at: null, skewMs: 0 };

  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) {
    return { at: null, skewMs: 0, rejected: "That saved time could not be read." };
  }

  const skewMs = now.getTime() - at.getTime();
  if (skewMs < -CLOCK_SKEW_TOLERANCE_MS) {
    return {
      at: null,
      skewMs,
      rejected:
        "This phone's clock is ahead of ours. Check the date and time on the phone, then try again.",
    };
  }
  if (skewMs > MAX_QUEUE_AGE_MS) {
    return {
      at: null,
      skewMs,
      rejected:
        "This was saved more than a week ago and can't be sent now. Ask your manager to record it.",
    };
  }

  return { at, skewMs };
}
