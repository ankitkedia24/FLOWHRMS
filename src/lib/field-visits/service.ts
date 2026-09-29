import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { evaluateAccess } from "@/lib/authz/flags";
import { isVisitStale, workDateInTimezone } from "@/lib/attendance/policy";
import { consentStandings } from "@/lib/consent/record";
import { mediaUrls } from "@/lib/media/urls";
import { loadFieldVisitsPolicy } from "./access";
import { loadTripPerson } from "./audience";
import { informManager } from "./nudges";
import { computeLegsLater } from "./legs";
import {
  activePurposes,
  mayRecordVisits,
  type FieldVisitsPolicy,
  type PhotoRule,
  type PlaceWord,
} from "./policy";
import {
  phaseOf,
  straightMetres,
  summariseDay,
  tapNoticeText,
  type DaySummary,
  type DayTrip,
  type DayVisit,
  type FieldPhase,
  type Spot,
  type TripMapData,
} from "./state";

/**
 * Field visits read model and the rules that span attendance
 * (FIELD-VISITS-MODULE.md §3). Tenant-scoped from the session, never from
 * client input.
 */

type Tx = Prisma.TransactionClient;
type Client = Tx | ReturnType<typeof getDb>;

export interface OpenDay {
  recordId: string;
  checkInAt: Date;
  checkInLat: number | null;
  checkInLng: number | null;
}

/**
 * The working day a tap at `at` belongs to: the latest check-in still
 * open, unless it has been open so long it is a forgotten check-out.
 */
export async function openDay(
  client: Client,
  tenantId: string,
  membershipId: string,
  at: Date,
): Promise<OpenDay | null> {
  const punch = await client.attendancePunch.findFirst({
    where: { checkOutAt: null, record: { tenantId, membershipId } },
    orderBy: { checkInAt: "desc" },
    select: { recordId: true, checkInAt: true, checkInLat: true, checkInLng: true },
  });
  if (!punch || punch.checkInAt > at || isVisitStale(punch.checkInAt, at)) return null;
  return punch;
}

/**
 * A trip still open on a day that is no longer open — the person never
 * checked out — is marked "not recorded", with any visit left open. Times
 * are never invented (§3); a correction supplies them.
 */
export async function settleForgotten(
  client: Client,
  tenantId: string,
  membershipId: string,
  at: Date,
): Promise<void> {
  const open = await client.fieldTrip.findMany({
    where: { tenantId, membershipId, endKind: null },
    select: { id: true, recordId: true },
  });
  if (open.length === 0) return;
  const day = await openDay(client, tenantId, membershipId, at);
  const lost = open.filter((t) => !day || t.recordId !== day.recordId).map((t) => t.id);
  if (lost.length === 0) return;
  await client.fieldVisit.updateMany({
    where: { tenantId, tripId: { in: lost }, endKind: null },
    data: { endKind: "NOT_RECORDED" },
  });
  await client.fieldTrip.updateMany({
    where: { tenantId, id: { in: lost } },
    data: { endKind: "NOT_RECORDED" },
  });
}

/** The person's open trip with its visits, if they are out. */
export async function openTrip(client: Client, tenantId: string, membershipId: string) {
  return client.fieldTrip.findFirst({
    where: { tenantId, membershipId, endKind: null },
    orderBy: { startedAt: "desc" },
    include: { visits: { orderBy: { sequence: "asc" } } },
  });
}

/**
 * Whether this person agreed to location at visit taps (employee notice
 * v3, optional). Without it their taps are recorded without location.
 */
export async function visitLocationAllowed(session: AppSession): Promise<boolean> {
  if (session.source !== "supabase") return true;
  const [standing] = await consentStandings(session.user.id, ["employee"]);
  return (
    standing?.status.state === "current" &&
    standing.status.choices.some((c) => c.key === "visit_location" && c.granted)
  );
}

export interface PlaceOption {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
}

export interface FieldHome {
  tenantId: string;
  timezone: string;
  phase: FieldPhase;
  word: PlaceWord;
  photo: PhotoRule;
  purposes: Array<{ key: string; name: string }>;
  locationAllowed: boolean;
  trip: {
    id: string;
    startedAt: string;
    approval: DayTrip["approval"];
    approvalReason: string | null;
    lastPlaceName: string | null;
  } | null;
  visit: {
    id: string;
    placeName: string;
    purposeName: string | null;
    arrivedAt: string;
    note: string | null;
  } | null;
  places: PlaceOption[];
  today: DaySummary;
}

/** Is field visits on for this company, with rules published? */
export async function fieldVisitsReady(
  session: AppSession,
): Promise<{ policy: FieldVisitsPolicy; version: number } | null> {
  if (devFixtureOffline()) return null;
  const entitlements = await loadEntitlements(session.tenant.id, session.user.id);
  if (!evaluateAccess({ session, entitlements, module: "FIELD_VISITS" }).allowed) return null;
  return loadFieldVisitsPolicy(session.tenant.id);
}

/**
 * Everything the home card needs, or null when this person doesn't
 * record visits (module off, rules unpublished, owner, not in scope).
 */
export async function loadFieldHome(session: AppSession): Promise<FieldHome | null> {
  const ready = await fieldVisitsReady(session);
  if (!ready) return null;
  const { policy } = ready;
  const tenantId = session.tenant.id;
  const membershipId = session.membership.id;
  const db = getDb();

  const person = await loadTripPerson(tenantId, membershipId);
  if (!person) return null;
  if (!mayRecordVisits({ roleKey: session.membership.roleKey, departmentId: person.departmentId }, policy)) {
    return null;
  }

  const now = new Date();
  await settleForgotten(db, tenantId, membershipId, now);
  const [day, trip, places, locationAllowed] = await Promise.all([
    openDay(db, tenantId, membershipId, now),
    openTrip(db, tenantId, membershipId),
    db.fieldPlace.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, address: true, lat: true, lng: true },
      orderBy: { name: "asc" },
      take: 2000,
    }),
    visitLocationAllowed(session),
  ]);

  const visit = trip?.visits.find((v) => v.endKind === null) ?? null;
  const lastPlace = trip?.visits.at(-1) ?? null;
  // Today's trips even after checking out, so the day's count stays in view.
  const recordId =
    day?.recordId ??
    (
      await db.attendanceRecord.findUnique({
        where: {
          tenantId_membershipId_workDate: {
            tenantId,
            membershipId,
            workDate: workDateInTimezone(now, session.tenant.timezone),
          },
        },
        select: { id: true },
      })
    )?.id;
  const todayTrips = recordId ? await loadTrips(tenantId, { recordId }) : [];

  return {
    tenantId,
    timezone: session.tenant.timezone,
    phase: phaseOf({ dayOpen: day !== null, tripOpen: trip !== null, visitOpen: visit !== null }),
    word: policy.placeWord,
    photo: policy.photo,
    purposes: activePurposes(policy).map(({ key, name }) => ({ key, name })),
    locationAllowed,
    trip: trip
      ? {
          id: trip.id,
          startedAt: trip.startedAt.toISOString(),
          approval: trip.approval,
          approvalReason: trip.approvalReason,
          lastPlaceName: lastPlace?.placeName ?? null,
        }
      : null,
    visit: visit
      ? {
          id: visit.id,
          placeName: visit.placeName,
          purposeName: visit.purposeName,
          arrivedAt: visit.arrivedAt.toISOString(),
          note: visit.note,
        }
      : null,
    places,
    today: summariseDay(todayTrips, now),
  };
}

export interface VisitDetail extends DayVisit {
  id: string;
  photoUrl: string | null;
}

export interface TripDetail extends DayTrip {
  membershipId: string;
  recordId: string;
  personName: string;
  approvalReason: string | null;
  approvalDecidedAt: Date | null;
  approvalDecidedByName: string | null;
  visits: VisitDetail[];
  /** Only the tapped spots; null when none carried a location. */
  map: TripMapData | null;
}

/** Trips with their visits and legs, oldest first, photos as short-lived links. */
export async function loadTrips(
  tenantId: string,
  where: { recordId: string } | { tripId: string },
): Promise<TripDetail[]> {
  const db = getDb();
  const rows = await db.fieldTrip.findMany({
    where: { tenantId, ...("tripId" in where ? { id: where.tripId } : { recordId: where.recordId }) },
    orderBy: { startedAt: "asc" },
    include: {
      visits: { orderBy: { sequence: "asc" } },
      legs: { orderBy: { sequence: "asc" } },
      membership: { select: { user: { select: { displayName: true } } } },
    },
  });

  const deciderIds = [...new Set(rows.map((r) => r.approvalDecidedById).filter((x): x is string => Boolean(x)))];
  const deciders = deciderIds.length
    ? await db.user.findMany({ where: { id: { in: deciderIds } }, select: { id: true, displayName: true } })
    : [];
  const deciderName = new Map(deciders.map((u) => [u.id, u.displayName]));
  const photos = await mediaUrls(rows.flatMap((r) => r.visits.map((v) => v.photoPath)));
  const waiting = rows.filter((r) => r.legs.some((l) => l.status === "PENDING")).map((r) => r.id);
  if (waiting.length > 0) computeLegsLater(tenantId, waiting);

  return rows.map((t) => {
    const legs: TripDetail["legs"] = [];
    for (const leg of t.legs) {
      legs[leg.sequence - 1] = {
        meters: leg.meters,
        durationSeconds: leg.durationSeconds,
        method: leg.method,
        status: leg.status,
      };
    }
    const stops: TripMapData["stops"] = [];
    if (t.startLat != null && t.startLng != null) {
      stops.push({ lat: t.startLat, lng: t.startLng, label: "S", title: t.startEstimated ? "Start (estimated)" : "Went out" });
    }
    t.visits.forEach((v, i) => {
      if (v.arriveLat != null && v.arriveLng != null) {
        stops.push({ lat: v.arriveLat, lng: v.arriveLng, label: String(i + 1), title: v.placeName });
      }
    });
    if (t.endLat != null && t.endLng != null) {
      stops.push({
        lat: t.endLat,
        lng: t.endLng,
        label: "E",
        title: t.endKind === "BACK_AT_OFFICE" ? "Back at office" : "Checked out",
      });
    }
    const map: TripMapData | null = stops.length
      ? {
          stops,
          legs: t.legs.map((l) => ({
            from: { lat: l.fromLat, lng: l.fromLng },
            to: { lat: l.toLat, lng: l.toLng },
            polyline: l.polyline,
          })),
        }
      : null;

    return {
      id: t.id,
      membershipId: t.membershipId,
      recordId: t.recordId,
      personName: t.membership.user.displayName,
      startedAt: t.startedAt,
      startEstimated: t.startEstimated,
      endedAt: t.endedAt,
      endKind: t.endKind,
      approval: t.approval,
      approvalReason: t.approvalReason,
      approvalDecidedAt: t.approvalDecidedAt,
      approvalDecidedByName: t.approvalDecidedById ? deciderName.get(t.approvalDecidedById) ?? null : null,
      legs,
      visits: t.visits.map((v) => ({
        id: v.id,
        placeName: v.placeName,
        purposeName: v.purposeName,
        arrivedAt: v.arrivedAt,
        leftAt: v.leftAt,
        endKind: v.endKind,
        isFar: v.isFar,
        hasPhoto: Boolean(v.photoPath),
        photoUrl: v.photoPath ? photos.get(v.photoPath) ?? null : null,
        note: v.note,
      })),
      map,
    };
  });
}

/**
 * Checking out while out ends the visit and the trip at the check-out
 * (§3). Called by the attendance check-out after it has recorded; never
 * fails it.
 */
export async function endFieldWorkAtCheckOut(
  session: AppSession,
  input: { at: Date; clientAt: Date | null; coords: (Spot & { accuracyM?: number | null }) | null },
): Promise<void> {
  if (devFixtureOffline()) return;
  try {
    const db = getDb();
    const tenantId = session.tenant.id;
    const membershipId = session.membership.id;
    const trip = await openTrip(db, tenantId, membershipId);
    if (!trip) return;

    const coords = (await visitLocationAllowed(session)) ? input.coords : null;
    const open = trip.visits.find((v) => v.endKind === null) ?? null;
    const last = trip.visits.at(-1) ?? null;
    const from: (Spot & { at: Date }) | null =
      open
        ? open.arriveLat != null && open.arriveLng != null
          ? { lat: open.arriveLat, lng: open.arriveLng, at: open.arrivedAt }
          : null
        : last
          ? last.leftLat != null && last.leftLng != null
            ? { lat: last.leftLat, lng: last.leftLng, at: last.leftAt ?? last.arrivedAt }
            : null
          : trip.startLat != null && trip.startLng != null
            ? { lat: trip.startLat, lng: trip.startLng, at: trip.startedAt }
            : null;

    await db.$transaction(async (tx) => {
      if (open) {
        await tx.fieldVisit.update({
          where: { id: open.id },
          data: {
            leftAt: input.at,
            leftClientAt: input.clientAt,
            leftLat: coords?.lat,
            leftLng: coords?.lng,
            leftAccuracyM: coords?.accuracyM ?? null,
            endKind: "CHECKED_OUT",
          },
        });
      }
      if (from && coords) {
        await tx.fieldLeg.create({
          data: {
            tenantId,
            tripId: trip.id,
            sequence: trip.visits.length + 1,
            fromLat: from.lat,
            fromLng: from.lng,
            fromAt: from.at,
            toLat: coords.lat,
            toLng: coords.lng,
            toAt: input.at,
            meters: straightMetres(from, coords),
            method: "STRAIGHT",
          },
        });
      }
      await tx.fieldTrip.update({
        where: { id: trip.id },
        data: {
          endedAt: input.at,
          endedClientAt: input.clientAt,
          endLat: coords?.lat,
          endLng: coords?.lng,
          endAccuracyM: coords?.accuracyM ?? null,
          endKind: "CHECKED_OUT",
        },
      });
    });

    computeLegsLater(tenantId, [trip.id]);
    await recordAuditEvent(session, {
      action: "field_visits.ended_at_check_out",
      entityType: "field_trip",
      entityId: trip.id,
      after: { endedAt: input.at.toISOString(), visitEnded: open?.id ?? null },
    });

    const ready = await loadFieldVisitsPolicy(tenantId);
    const person = await loadTripPerson(tenantId, membershipId);
    if (ready?.policy.managerUpdates && person) {
      await informManager(
        session,
        person,
        trip.id,
        tapNoticeText("CHECKED_OUT", {
          name: person.displayName,
          timeZone: session.tenant.timezone,
          at: input.at,
          placeName: open?.placeName ?? null,
        }),
      );
    }
  } catch (error) {
    console.error("[field-visits:end-at-check-out-failed]", error);
  }
}
