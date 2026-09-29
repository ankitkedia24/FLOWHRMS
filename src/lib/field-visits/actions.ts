"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { notify } from "@/lib/notifications";
import { resolveActionRequest } from "@/lib/actions/service";
import { formatClockTime, MAX_OPEN_VISIT_HOURS, resolveCapturedAt } from "@/lib/attendance/policy";
import { mediaPathOk } from "@/lib/media/bucket";
import { mediaExists } from "@/lib/media/urls";
import type { AppSession } from "@/lib/auth/types";
import { loadFieldVisitsPolicy } from "./access";
import { loadTripPerson, type TripPerson } from "./audience";
import { askForTripApproval, informManager, TRIP_SUBJECT, tripHref } from "./nudges";
import { computeLegsLater } from "./legs";
import { activePurposes, mayRecordVisits, type FieldVisitsPolicy } from "./policy";
import { openDay, openTrip, settleForgotten, visitLocationAllowed } from "./service";
import {
  dateKeyIn,
  firstName,
  formatDistance,
  formatStay,
  mayDecideTrip,
  NOTE_MAX,
  phaseOf,
  PLACE_NAME_MAX,
  placeNameKey,
  straightMetres,
  tapNoticeText,
  tapProblem,
  tidyPlaceName,
  zonedDateTime,
  type Spot,
} from "./state";

/**
 * Field visit taps (FIELD-VISITS-MODULE.md §3, §4).
 *
 * Non-negotiables enforced here, not in the phone:
 * - A tap belongs to an open working day; the trip is working time.
 * - Location is kept only when the person agreed to it at visit taps.
 * - A queued tap keeps its own time, judged by the same rule as a queued
 *   check-in, and a repeated send of the same tap is recorded once.
 * - Approval of going out is asked for, never waited for.
 * - Every change writes an audit event.
 */

export type ActionResult =
  | { ok: true; message: string; detail?: string }
  | { ok: false; error: string };

type Tx = Prisma.TransactionClient;

const coordsSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracyM: z.number().nonnegative().nullable().optional(),
  })
  .nullable();

const tapSchema = z.object({
  coords: coordsSchema,
  /** Original device time, for taps queued offline. */
  clientCapturedAt: z.string().datetime().optional(),
});

type Coords = z.infer<typeof coordsSchema>;

interface Prelude {
  session: AppSession;
  policy: FieldVisitsPolicy;
  version: number;
  person: TripPerson;
  effectiveAt: Date;
  clientAt: Date | null;
  coords: Coords;
}

const COULD_NOT_READ = "That tap could not be read. Try again.";

/** Everything a tap needs, or the plain reason it can't happen. */
async function prelude(raw: z.infer<typeof tapSchema>): Promise<{ ok: true; p: Prelude } | { ok: false; error: string }> {
  const { session, decision } = await checkAccess({ module: "FIELD_VISITS" });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "Field visits aren't switched on for your company." };
  }
  const published = await loadFieldVisitsPolicy(session.tenant.id);
  if (!published) {
    return { ok: false, error: "Your company hasn't published its field visit rules yet." };
  }
  const person = await loadTripPerson(session.tenant.id, session.membership.id);
  if (!person) return { ok: false, error: "Your account couldn't be found. Sign in again." };
  if (!mayRecordVisits({ roleKey: session.membership.roleKey, departmentId: person.departmentId }, published.policy)) {
    return {
      ok: false,
      error:
        session.membership.roleKey === "OWNER"
          ? "Owners don't record field visits — they see everyone's."
          : "Your company hasn't asked you to record field visits.",
    };
  }

  const now = new Date();
  const captured = resolveCapturedAt(raw.clientCapturedAt, now);
  if (captured.rejected) return { ok: false, error: captured.rejected };
  const allowed = await visitLocationAllowed(session);

  return {
    ok: true,
    p: {
      session,
      policy: published.policy,
      version: published.version,
      person,
      effectiveAt: captured.at ?? now,
      clientAt: captured.at,
      coords: allowed ? raw.coords ?? null : null,
    },
  };
}

/** One person's taps are applied one at a time, even from two phones. */
function withPersonLock<T>(membershipId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM tenant_memberships WHERE id = ${membershipId}::uuid FOR UPDATE`;
      return fn(tx);
    },
    { timeout: 20_000 },
  );
}

const sameTime = (a: Date | null | undefined, b: Date | null) => Boolean(a && b && a.getTime() === b.getTime());

type TripWithVisits = NonNullable<Awaited<ReturnType<typeof openTrip>>>;

/** Where the last stretch of road starts: the last departure, or the trip's start. */
function lastSpot(trip: TripWithVisits): (Spot & { at: Date }) | null {
  const last = trip.visits.at(-1);
  if (last) {
    return last.leftLat != null && last.leftLng != null
      ? { lat: last.leftLat, lng: last.leftLng, at: last.leftAt ?? last.arrivedAt }
      : null;
  }
  return trip.startLat != null && trip.startLng != null
    ? { lat: trip.startLat, lng: trip.startLng, at: trip.startedAt }
    : null;
}

async function addLeg(
  tx: Tx,
  tenantId: string,
  tripId: string,
  sequence: number,
  from: (Spot & { at: Date }) | null,
  to: Coords,
  toAt: Date,
): Promise<void> {
  if (!from || !to) return; // no location at one end: no distance, shown as such
  await tx.fieldLeg.create({
    data: {
      tenantId,
      tripId,
      sequence,
      fromLat: from.lat,
      fromLng: from.lng,
      fromAt: from.at,
      toLat: to.lat,
      toLng: to.lng,
      toAt,
      meters: straightMetres(from, to),
      method: "STRAIGHT",
    },
  });
}

function refresh(tripId?: string) {
  revalidatePath("/home");
  revalidatePath("/field-visits");
  if (tripId) revalidatePath(tripHref(tripId));
}

// ------------------------------------------------------------ going out

export async function goingOutAction(input: z.input<typeof tapSchema>): Promise<ActionResult> {
  const parsed = tapSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: COULD_NOT_READ };
  const pre = await prelude(parsed.data);
  if (!pre.ok) return pre;
  const { session, policy, version, person, effectiveAt, clientAt, coords } = pre.p;
  const tenantId = session.tenant.id;
  const tz = session.tenant.timezone;

  const outcome = await withPersonLock(person.membershipId, async (tx) => {
    await settleForgotten(tx, tenantId, person.membershipId, effectiveAt);
    const day = await openDay(tx, tenantId, person.membershipId, effectiveAt);
    const open = await openTrip(tx, tenantId, person.membershipId);
    if (open && sameTime(open.startedClientAt, clientAt)) return { kind: "already" as const, at: open.startedAt };
    const visit = open?.visits.find((v) => v.endKind === null) ?? null;
    const problem = tapProblem(
      phaseOf({ dayOpen: day !== null, tripOpen: open !== null, visitOpen: visit !== null }),
      "GOING_OUT",
      { place: policy.placeWord.singular, atName: visit?.placeName },
    );
    if (problem || !day) return { kind: "refused" as const, error: problem ?? "Check in first." };

    const trip = await tx.fieldTrip.create({
      data: {
        tenantId,
        membershipId: person.membershipId,
        recordId: day.recordId,
        startedAt: effectiveAt,
        startedClientAt: clientAt,
        startLat: coords?.lat,
        startLng: coords?.lng,
        startAccuracyM: coords?.accuracyM ?? null,
        approval: policy.goingOutApproval ? "PENDING" : "NOT_NEEDED",
        policyVersion: version,
        offlineCaptured: clientAt !== null,
      },
    });
    return { kind: "done" as const, trip };
  });

  if (outcome.kind === "refused") return { ok: false, error: outcome.error };
  if (outcome.kind === "already") {
    return { ok: true, message: `Out since ${formatClockTime(outcome.at, tz)}`, detail: "This was already recorded." };
  }

  const { trip } = outcome;
  await recordAuditEvent(session, {
    action: "field_visits.going_out",
    entityType: "field_trip",
    entityId: trip.id,
    after: { startedAt: effectiveAt.toISOString(), offlineCaptured: clientAt !== null, withLocation: coords !== null },
  });
  if (trip.approval === "PENDING") await askForTripApproval(session, person, trip, null);
  refresh(trip.id);

  return {
    ok: true,
    message: `Out since ${formatClockTime(effectiveAt, tz)}`,
    detail:
      trip.approval === "PENDING"
        ? "Your reporting manager has been asked to approve this trip. You don't need to wait."
        : undefined,
  };
}

// ------------------------------------------------------------ reached

const arriveSchema = tapSchema.extend({
  place: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("saved"), placeId: z.string().uuid() }),
    z.object({
      kind: z.literal("new"),
      name: z.string().trim().min(1).max(PLACE_NAME_MAX),
      address: z.string().trim().max(200).optional(),
    }),
    z.object({ kind: z.literal("once"), name: z.string().trim().min(1).max(PLACE_NAME_MAX) }),
  ]),
  purposeKey: z.string().max(40).optional(),
  note: z.string().trim().max(NOTE_MAX).optional(),
  photoPath: z.string().max(200).optional(),
});

export async function arriveAction(input: z.input<typeof arriveSchema>): Promise<ActionResult> {
  const parsed = arriveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: COULD_NOT_READ };
  const pre = await prelude(parsed.data);
  if (!pre.ok) return pre;
  const { session, policy, version, person, effectiveAt, clientAt, coords } = pre.p;
  const tenantId = session.tenant.id;
  const tz = session.tenant.timezone;
  const word = policy.placeWord.singular;
  const data = parsed.data;

  // Photo: required, optional or off, by the company's rules.
  let photoPath: string | null = null;
  if (policy.photo !== "OFF" && data.photoPath) {
    if (!mediaPathOk(data.photoPath, tenantId, "visits") || !(await mediaExists(data.photoPath))) {
      return { ok: false, error: "The photo didn't upload. Take it again." };
    }
    photoPath = data.photoPath;
  }
  if (policy.photo === "REQUIRED" && !photoPath) {
    return { ok: false, error: `Add a photo — your company asks for one at each ${word}.` };
  }

  const purpose = data.purposeKey ? activePurposes(policy).find((p) => p.key === data.purposeKey) ?? null : null;

  const outcome = await withPersonLock(person.membershipId, async (tx) => {
    await settleForgotten(tx, tenantId, person.membershipId, effectiveAt);
    const day = await openDay(tx, tenantId, person.membershipId, effectiveAt);
    let trip = await openTrip(tx, tenantId, person.membershipId);
    const current = trip?.visits.find((v) => v.endKind === null) ?? null;
    if (current && sameTime(current.arrivedClientAt, clientAt)) {
      return { kind: "already" as const, placeName: current.placeName, at: current.arrivedAt };
    }
    const problem = tapProblem(
      phaseOf({ dayOpen: day !== null, tripOpen: trip !== null, visitOpen: current !== null }),
      "ARRIVE",
      { place: word, atName: current?.placeName },
    );
    if (problem || !day) return { kind: "refused" as const, error: problem ?? "Check in first." };

    // Which place.
    let placeId: string | null = null;
    let placeName: string;
    let distanceFromPlaceM: number | null = null;
    let placeAdded = false;
    if (data.place.kind === "saved") {
      const saved = await tx.fieldPlace.findFirst({
        where: { id: data.place.placeId, tenantId, isActive: true },
      });
      if (!saved) return { kind: "refused" as const, error: `That ${word} is no longer on the list. Search again.` };
      placeId = saved.id;
      placeName = saved.name;
      distanceFromPlaceM = coords ? straightMetres(coords, saved) : null;
    } else if (data.place.kind === "new") {
      if (!coords) {
        return {
          kind: "refused" as const,
          error: `Your location isn't available, so this can't be saved as a regular ${word}. Choose "just this once" instead.`,
        };
      }
      const name = tidyPlaceName(data.place.name);
      const key = placeNameKey(name);
      // The same name close by is the same place: reuse it rather than
      // filling the list with repeats.
      const sameName = await tx.fieldPlace.findMany({ where: { tenantId, isActive: true, nameKey: key } });
      const nearby = sameName
        .map((p) => ({ p, d: straightMetres(coords, p) }))
        .filter((x) => x.d <= policy.farFlagMeters)
        .sort((a, b) => a.d - b.d)[0];
      if (nearby) {
        placeId = nearby.p.id;
        placeName = nearby.p.name;
        distanceFromPlaceM = nearby.d;
      } else {
        const created = await tx.fieldPlace.create({
          data: {
            tenantId,
            name,
            nameKey: key,
            address: data.place.address || null,
            lat: coords.lat,
            lng: coords.lng,
            createdById: person.membershipId,
          },
        });
        placeId = created.id;
        placeName = created.name;
        placeAdded = true;
      }
    } else {
      placeName = tidyPlaceName(data.place.name);
    }

    // Straight to a place from the office: the trip starts here, from
    // where they checked in, and its start is marked as estimated.
    let startedTrip = false;
    if (!trip) {
      const created = await tx.fieldTrip.create({
        data: {
          tenantId,
          membershipId: person.membershipId,
          recordId: day.recordId,
          startedAt: effectiveAt,
          startedClientAt: clientAt,
          startLat: day.checkInLat,
          startLng: day.checkInLng,
          startEstimated: true,
          approval: policy.goingOutApproval ? "PENDING" : "NOT_NEEDED",
          policyVersion: version,
          offlineCaptured: clientAt !== null,
        },
      });
      trip = { ...created, visits: [] };
      startedTrip = true;
    }

    const sequence = trip.visits.length + 1;
    await addLeg(tx, tenantId, trip.id, sequence, lastSpot(trip), coords, effectiveAt);
    const visit = await tx.fieldVisit.create({
      data: {
        tenantId,
        tripId: trip.id,
        membershipId: person.membershipId,
        sequence,
        placeId,
        placeName,
        purposeKey: purpose?.key ?? null,
        purposeName: purpose?.name ?? null,
        arrivedAt: effectiveAt,
        arrivedClientAt: clientAt,
        arriveLat: coords?.lat,
        arriveLng: coords?.lng,
        arriveAccuracyM: coords?.accuracyM ?? null,
        distanceFromPlaceM,
        isFar: distanceFromPlaceM !== null && distanceFromPlaceM > policy.farFlagMeters,
        note: data.note || null,
        photoPath,
        offlineCaptured: clientAt !== null,
      },
    });
    return { kind: "done" as const, trip, visit, startedTrip, placeAdded };
  });

  if (outcome.kind === "refused") return { ok: false, error: outcome.error };
  if (outcome.kind === "already") {
    return {
      ok: true,
      message: `At ${outcome.placeName} since ${formatClockTime(outcome.at, tz)}`,
      detail: "This was already recorded.",
    };
  }

  const { trip, visit, startedTrip, placeAdded } = outcome;
  if (placeAdded) {
    await recordAuditEvent(session, {
      action: "field_visits.place_added",
      entityType: "field_place",
      entityId: visit.placeId ?? undefined,
      after: { name: visit.placeName },
    });
  }
  await recordAuditEvent(session, {
    action: "field_visits.arrived",
    entityType: "field_visit",
    entityId: visit.id,
    after: {
      tripId: trip.id,
      place: visit.placeName,
      oneTime: visit.placeId === null,
      purpose: visit.purposeName,
      isFar: visit.isFar,
      photo: Boolean(visit.photoPath),
      offlineCaptured: clientAt !== null,
      withLocation: coords !== null,
    },
  });
  if (startedTrip && trip.approval === "PENDING") {
    await askForTripApproval(session, person, trip, { placeName: visit.placeName });
  }
  computeLegsLater(tenantId, [trip.id]);
  if (policy.managerUpdates) {
    await informManager(
      session,
      person,
      trip.id,
      tapNoticeText("ARRIVE", {
        name: person.displayName,
        timeZone: tz,
        at: effectiveAt,
        placeName: visit.placeName,
        purposeName: visit.purposeName,
      }),
    );
  }
  refresh(trip.id);

  return {
    ok: true,
    message: `At ${visit.placeName} since ${formatClockTime(effectiveAt, tz)}`,
    detail: visit.isFar
      ? `You're about ${formatDistance(visit.distanceFromPlaceM ?? 0)} from the saved spot for ${visit.placeName}. The visit still counts; the report shows a flag.`
      : startedTrip && trip.approval === "PENDING"
        ? "Your trip has started. Your reporting manager has been asked to approve it."
        : undefined,
  };
}

// ------------------------------------------------------------ end visit

const leaveSchema = tapSchema.extend({
  note: z.string().trim().max(NOTE_MAX).optional(),
});

export async function leaveAction(input: z.input<typeof leaveSchema>): Promise<ActionResult> {
  const parsed = leaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: COULD_NOT_READ };
  const pre = await prelude(parsed.data);
  if (!pre.ok) return pre;
  const { session, policy, person, effectiveAt, clientAt, coords } = pre.p;
  const tenantId = session.tenant.id;
  const tz = session.tenant.timezone;

  const outcome = await withPersonLock(person.membershipId, async (tx) => {
    await settleForgotten(tx, tenantId, person.membershipId, effectiveAt);
    const day = await openDay(tx, tenantId, person.membershipId, effectiveAt);
    const trip = await openTrip(tx, tenantId, person.membershipId);
    const last = trip?.visits.at(-1) ?? null;
    if (last && last.endKind !== null && sameTime(last.leftClientAt, clientAt)) {
      return { kind: "already" as const, placeName: last.placeName, at: last.leftAt ?? effectiveAt };
    }
    const visit = trip?.visits.find((v) => v.endKind === null) ?? null;
    const problem = tapProblem(
      phaseOf({ dayOpen: day !== null, tripOpen: trip !== null, visitOpen: visit !== null }),
      "LEAVE",
      { place: policy.placeWord.singular },
    );
    if (problem || !trip || !visit) return { kind: "refused" as const, error: problem ?? "Nothing to end." };

    const ended = await tx.fieldVisit.update({
      where: { id: visit.id },
      data: {
        leftAt: effectiveAt,
        leftClientAt: clientAt,
        leftLat: coords?.lat,
        leftLng: coords?.lng,
        leftAccuracyM: coords?.accuracyM ?? null,
        endKind: "ENDED",
        ...(parsed.data.note !== undefined ? { note: parsed.data.note || null } : {}),
      },
    });
    return { kind: "done" as const, trip, visit: ended };
  });

  if (outcome.kind === "refused") return { ok: false, error: outcome.error };
  if (outcome.kind === "already") {
    return { ok: true, message: `Left ${outcome.placeName} at ${formatClockTime(outcome.at, tz)}`, detail: "This was already recorded." };
  }

  const { trip, visit } = outcome;
  await recordAuditEvent(session, {
    action: "field_visits.visit_ended",
    entityType: "field_visit",
    entityId: visit.id,
    after: { leftAt: effectiveAt.toISOString(), offlineCaptured: clientAt !== null, withLocation: coords !== null },
  });
  if (policy.managerUpdates) {
    await informManager(
      session,
      person,
      trip.id,
      tapNoticeText("LEAVE", {
        name: person.displayName,
        timeZone: tz,
        at: effectiveAt,
        since: visit.arrivedAt,
        placeName: visit.placeName,
      }),
    );
  }
  refresh(trip.id);

  const stayed = Math.round((effectiveAt.getTime() - visit.arrivedAt.getTime()) / 60_000);
  return {
    ok: true,
    message: `Left ${visit.placeName} at ${formatClockTime(effectiveAt, tz)}`,
    detail: `You were there ${formatStay(stayed)}. Tap Reached at your next ${policy.placeWord.singular}, or Back at office.`,
  };
}

// ------------------------------------------------------------ back

export async function backAtOfficeAction(input: z.input<typeof tapSchema>): Promise<ActionResult> {
  const parsed = tapSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: COULD_NOT_READ };
  const pre = await prelude(parsed.data);
  if (!pre.ok) return pre;
  const { session, policy, person, effectiveAt, clientAt, coords } = pre.p;
  const tenantId = session.tenant.id;
  const tz = session.tenant.timezone;

  const outcome = await withPersonLock(person.membershipId, async (tx) => {
    await settleForgotten(tx, tenantId, person.membershipId, effectiveAt);
    const day = await openDay(tx, tenantId, person.membershipId, effectiveAt);
    const trip = await openTrip(tx, tenantId, person.membershipId);
    if (!trip) {
      const latest = await tx.fieldTrip.findFirst({
        where: { tenantId, membershipId: person.membershipId },
        orderBy: { startedAt: "desc" },
      });
      if (latest && sameTime(latest.endedClientAt, clientAt)) {
        return { kind: "already" as const, at: latest.endedAt ?? effectiveAt };
      }
    }
    const visit = trip?.visits.find((v) => v.endKind === null) ?? null;
    const problem = tapProblem(
      phaseOf({ dayOpen: day !== null, tripOpen: trip !== null, visitOpen: visit !== null }),
      "BACK",
      { place: policy.placeWord.singular, atName: visit?.placeName },
    );
    if (problem || !trip) return { kind: "refused" as const, error: problem ?? "You aren't out." };

    await addLeg(tx, tenantId, trip.id, trip.visits.length + 1, lastSpot(trip), coords, effectiveAt);
    const ended = await tx.fieldTrip.update({
      where: { id: trip.id },
      data: {
        endedAt: effectiveAt,
        endedClientAt: clientAt,
        endLat: coords?.lat,
        endLng: coords?.lng,
        endAccuracyM: coords?.accuracyM ?? null,
        endKind: "BACK_AT_OFFICE",
      },
    });
    return { kind: "done" as const, trip: ended, visits: trip.visits.length };
  });

  if (outcome.kind === "refused") return { ok: false, error: outcome.error };
  if (outcome.kind === "already") {
    return { ok: true, message: `Back at office at ${formatClockTime(outcome.at, tz)}`, detail: "This was already recorded." };
  }

  const { trip, visits } = outcome;
  computeLegsLater(tenantId, [trip.id]);
  await recordAuditEvent(session, {
    action: "field_visits.back_at_office",
    entityType: "field_trip",
    entityId: trip.id,
    after: { endedAt: effectiveAt.toISOString(), visits, offlineCaptured: clientAt !== null, withLocation: coords !== null },
  });
  if (policy.managerUpdates) {
    await informManager(
      session,
      person,
      trip.id,
      tapNoticeText("BACK", {
        name: person.displayName,
        timeZone: tz,
        at: effectiveAt,
        since: trip.startedAt,
        visits,
      }),
    );
  }
  refresh(trip.id);

  const out = Math.round((effectiveAt.getTime() - trip.startedAt.getTime()) / 60_000);
  return {
    ok: true,
    message: `Back at office at ${formatClockTime(effectiveAt, tz)}`,
    detail: `Out ${formatStay(out)} · ${visits} visit${visits === 1 ? "" : "s"}.`,
  };
}

// ------------------------------------------------------------ decide

const decideSchema = z.object({
  tripId: z.string().uuid(),
  decision: z.enum(["APPROVED", "DECLINED"]),
  reason: z.string().trim().max(500).optional(),
});

/** The reporting manager's answer (§4). Declining needs a reason, read word for word. */
export async function decideTripAction(input: z.input<typeof decideSchema>): Promise<ActionResult> {
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That decision could not be read. Try again." };
  const { session, decision } = await checkAccess({ module: "FIELD_VISITS" });
  if (!decision.allowed) return { ok: false, error: decision.message ?? "Field visits aren't switched on." };

  const db = getDb();
  const trip = await db.fieldTrip.findFirst({ where: { id: parsed.data.tripId, tenantId: session.tenant.id } });
  if (!trip) return { ok: false, error: "That trip is no longer available." };
  const person = await loadTripPerson(session.tenant.id, trip.membershipId);
  if (
    !person ||
    !mayDecideTrip({
      viewerMembershipId: session.membership.id,
      viewerSeesEveryone: session.permissions.has("fieldvisits.view"),
      person,
    })
  ) {
    return { ok: false, error: "Only their reporting manager or department head can decide this trip." };
  }
  const first = firstName(person.displayName);
  if (trip.approval === "NOT_NEEDED") return { ok: false, error: "This trip doesn't need approval." };
  if (trip.approval !== "PENDING") return { ok: false, error: "Someone has already decided this trip." };
  const reason = parsed.data.reason?.trim() || null;
  if (parsed.data.decision === "DECLINED" && !reason) {
    return { ok: false, error: `Say why — ${first} reads it word for word.` };
  }

  const { count } = await db.fieldTrip.updateMany({
    where: { id: trip.id, tenantId: session.tenant.id, approval: "PENDING" },
    data: {
      approval: parsed.data.decision,
      approvalDecidedById: session.user.id,
      approvalDecidedAt: new Date(),
      approvalReason: reason,
    },
  });
  if (count === 0) return { ok: false, error: "Someone has already decided this trip." };

  const approved = parsed.data.decision === "APPROVED";
  await resolveActionRequest({
    tenantId: session.tenant.id,
    subjectType: TRIP_SUBJECT,
    subjectId: trip.id,
    resolvedByUserId: session.user.id,
    resolution: approved ? "Approved" : `Declined: ${reason}`,
  });
  await recordAuditEvent(session, {
    action: approved ? "field_visits.trip_approved" : "field_visits.trip_declined",
    entityType: "field_trip",
    entityId: trip.id,
    reason: reason ?? undefined,
    before: { approval: "PENDING" },
    after: { approval: parsed.data.decision },
  });
  if (person.userId !== session.user.id) {
    await notify.fieldVisit(
      session.tenant.id,
      [person.userId],
      approved ? "Your trip was approved" : "Your trip was declined",
      approved
        ? `Went out at ${formatClockTime(trip.startedAt, session.tenant.timezone)}.`
        : `${reason} It won't count towards travel allowance.`,
      tripHref(trip.id),
    );
  }
  refresh(trip.id);

  return {
    ok: true,
    message: approved ? "Trip approved." : "Trip declined.",
    detail: approved ? undefined : `${first} has been told why.`,
  };
}

// ------------------------------------------------------------ correct

const correctSchema = z.object({
  visitId: z.string().uuid(),
  /** HH:mm in the company's timezone. */
  leftTime: z.string().regex(/^\d{2}:\d{2}$/, "Give a time like 18:30."),
  reason: z.string().trim().min(1, "Say what happened.").max(300),
});

/**
 * A visit left open when the day closed (§3). The person says when they
 * left and why; it is recorded as corrected — visibly, with the reason —
 * and their reporting manager is told. No distance is invented for it.
 */
export async function correctVisitAction(input: z.input<typeof correctSchema>): Promise<ActionResult> {
  const parsed = correctSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the correction." };
  }
  const { session, decision } = await checkAccess({ module: "FIELD_VISITS" });
  if (!decision.allowed) return { ok: false, error: decision.message ?? "Field visits aren't switched on." };

  const db = getDb();
  const tz = session.tenant.timezone;
  const visit = await db.fieldVisit.findFirst({
    where: { id: parsed.data.visitId, tenantId: session.tenant.id, membershipId: session.membership.id },
  });
  if (!visit) return { ok: false, error: "That visit is no longer available." };
  if (visit.endKind !== "NOT_RECORDED") return { ok: false, error: "This visit already has a time it ended." };

  let leftAt = zonedDateTime(dateKeyIn(visit.arrivedAt, tz), parsed.data.leftTime, tz);
  if (leftAt <= visit.arrivedAt) leftAt = new Date(leftAt.getTime() + 24 * 3_600_000); // after midnight
  if (leftAt.getTime() - visit.arrivedAt.getTime() > MAX_OPEN_VISIT_HOURS * 3_600_000) {
    return { ok: false, error: `That's more than ${MAX_OPEN_VISIT_HOURS} hours after you arrived. Check the time.` };
  }
  if (leftAt > new Date()) return { ok: false, error: "That time hasn't happened yet." };

  const reason = parsed.data.reason;
  const { count } = await db.fieldVisit.updateMany({
    where: { id: visit.id, endKind: "NOT_RECORDED" },
    data: {
      leftAt,
      endKind: "CORRECTED",
      note: [visit.note, `Left time corrected: ${reason}`].filter(Boolean).join(" · ").slice(0, NOTE_MAX + 120),
    },
  });
  if (count === 0) return { ok: false, error: "This visit already has a time it ended." };

  await recordAuditEvent(session, {
    action: "field_visits.visit_corrected",
    entityType: "field_visit",
    entityId: visit.id,
    reason,
    after: { leftAt: leftAt.toISOString() },
  });
  const person = await loadTripPerson(session.tenant.id, session.membership.id);
  if (person) {
    await informManager(session, person, visit.tripId, {
      title: `${firstName(person.displayName)} corrected a visit`.slice(0, 60),
      body: `${visit.placeName}: left at ${formatClockTime(leftAt, tz)} — ${reason}`,
    });
  }
  refresh(visit.tripId);

  return {
    ok: true,
    message: `Recorded: you left ${visit.placeName} at ${formatClockTime(leftAt, tz)}.`,
    detail: "It shows as corrected, with your reason. Your reporting manager has been told.",
  };
}
