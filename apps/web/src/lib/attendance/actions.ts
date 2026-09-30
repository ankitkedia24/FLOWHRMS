"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import {
  clearActionRequest,
  raiseAttendanceException,
  SUBJECT,
} from "@/lib/actions/raise";
import { checkAccess } from "@/lib/authz/guard";
import {
  ALREADY_DECIDED,
  DECIDABLE_STATUSES,
  QUESTION_NEEDED,
  isDecidable,
  selfDecisionRefusal,
} from "@/lib/authz/approvals";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { evaluateAccess } from "@/lib/authz/flags";
import { getPolicyVersion } from "@/lib/policies";
import type { AppSession } from "@/lib/auth/types";
import {
  checkInIntent,
  computeCheckInState,
  isVisitStale,
  workDateInTimezone,
  formatClockTime,
  formatDistance,
  MAX_OPEN_VISIT_HOURS,
  resolveCapturedAt,
  type AttendanceContext,
  type AttendanceSnapshot,
  type CheckInState,
} from "./policy";
import { loadAttendanceContext } from "./service";
import { awardForCheckIn, awardForCheckOut } from "@/lib/performance/award";
import { endFieldWorkAtCheckOut } from "@/lib/field-visits/service";

/**
 * May this person open a second visit today?
 *
 * Evaluated rather than guarded: a "no" here is not a refusal of the whole
 * action, it is one of the answers the action has to give properly.
 */
async function multiplePunchIsOn(session: AppSession): Promise<boolean> {
  const entitlements = await loadEntitlements(session.tenant.id, session.user.id);
  return evaluateAccess({
    session,
    entitlements,
    module: "ATTENDANCE",
    feature: "multiple_punch",
  }).allowed;
}

/**
 * What was true when the record was written, captured by value so a later
 * rename, move or policy change cannot alter what a past day says.
 * Prisma's Json input needs a plain object, hence the round trip.
 */
function buildSnapshot(
  context: AttendanceContext,
  state: CheckInState,
  policyVersion: number,
): AttendanceSnapshot {
  const matched = state.location.branch;
  const home = context.homeBranch;
  return {
    v: 2,
    policyVersion,
    locationRequired: context.locationRequired,
    canCheckInAtAnyBranch: context.canCheckInAtAnyBranch,
    shift: context.shift,
    homeBranch: home
      ? { id: home.id, name: home.name, lat: home.lat, lng: home.lng, radiusM: home.radiusM }
      : null,
    matchedBranch: matched
      ? {
          id: matched.id,
          name: matched.name,
          lat: matched.lat,
          lng: matched.lng,
          radiusM: matched.radiusM,
        }
      : null,
    candidateBranchCount: context.branches.length,
    outcome: state.location.outcome,
    distanceM: state.location.distanceM,
    consequenceSentence: state.consequence?.sentence ?? null,
  };
}

/** Prisma Json input requires plain JSON; our interfaces are precise. */
function toJson<T>(value: T): Parameters<typeof JSON.stringify>[0] {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Attendance server actions.
 *
 * Non-negotiables enforced here (not in the UI):
 * - Server time is authoritative and is echoed back to the user.
 * - Outside-area or unconfirmed location REQUIRES a reason and creates a
 *   pending exception — never a silent pass or block.
 * - Duplicate taps are idempotent within the day (edge-cases.md).
 * - Never invent a check-out time for a missed punch.
 * - Every state change writes an audit event (Constitution §3).
 */

const coordsSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracyM: z.number().nonnegative().nullable().optional(),
  })
  .nullable();

const checkInSchema = z.object({
  coords: coordsSchema,
  reason: z.string().trim().max(500).optional(),
  /** Original device capture time for offline-queued check-ins. */
  clientCapturedAt: z.string().datetime().optional(),
});

export type ActionResult =
  | { ok: true; message: string; detail?: string }
  | { ok: false; error: string };

export async function checkInAction(
  input: z.input<typeof checkInSchema>,
): Promise<ActionResult> {
  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That check-in could not be read. Try again." };
  }

  const { session, decision } = await checkAccess({ module: "ATTENDANCE" });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const now = new Date(); // server receive time

  /**
   * When the attendance actually happened.
   *
   * Online, server time is authoritative. Offline, the moment the person
   * tapped is what matters — recording a 9 am check-in as 5 pm because
   * that is when the phone found signal would be worse than useless, and
   * edge-cases.md is explicit: synced "using the ORIGINAL capture time …
   * never silently re-timed".
   *
   * A device clock is not trusted blindly: a future or very old time is
   * refused, and the skew is stored for admin review.
   */
  const captured = resolveCapturedAt(parsed.data.clientCapturedAt, now);
  if (captured.rejected) {
    return { ok: false, error: captured.rejected };
  }
  const effectiveAt = captured.at ?? now;
  const isOffline = captured.at != null;

  const context = await loadAttendanceContext(session);
  const state = computeCheckInState(
    context,
    parsed.data.coords ?? null,
    effectiveAt, // lateness is judged against when it happened
  );

  // A consequence that requires a reason must have one — server-side.
  const reason = parsed.data.reason?.trim();
  if (state.consequence?.requiresReason && !reason) {
    return {
      ok: false,
      error: "Add a reason so your manager can approve this check-in.",
    };
  }

  const workDate = workDateInTimezone(effectiveAt, session.tenant.timezone);
  const existing = await db.attendanceRecord.findUnique({
    where: {
      tenantId_membershipId_workDate: {
        tenantId: session.tenant.id,
        membershipId: session.membership.id,
        workDate,
      },
    },
  });

  const multiplePunchAllowed = await multiplePunchIsOn(session);
  const intent = checkInIntent({
    checkedIn: Boolean(existing?.checkInAt),
    checkedOut: Boolean(existing?.checkOutAt),
    multiplePunchAllowed,
  });

  // The day is finished and this company records one visit per day. Say so.
  // Returning ok:true "already recorded" here was the silent no-op:
  // the tap did nothing and nothing explained why.
  if (intent === "day-closed" && existing) {
    return {
      ok: false,
      error: `You already checked out at ${formatClockTime(existing.checkOutAt!, session.tenant.timezone)}. Your company records one check-in per day, so this one can't be added. Ask your manager if you worked again today.`,
    };
  }

  // Day was closed, but this company allows coming back — lunch, a
  // delivery, a second shift. A new pair opens and the day re-opens with
  // it; the record keeps its FIRST check-in, because lateness was decided
  // on arrival and must not be re-judged by a later return.
  if (intent === "new-punch" && existing) {
    const nextSequence =
      (await db.attendancePunch.count({ where: { recordId: existing.id } })) + 1;

    await db.$transaction([
      db.attendancePunch.create({
        data: {
          tenantId: session.tenant.id,
          recordId: existing.id,
          sequence: nextSequence,
          checkInAt: effectiveAt,
          checkInClientAt: captured.at,
          checkInLat: parsed.data.coords?.lat,
          checkInLng: parsed.data.coords?.lng,
          checkInAccuracyM: parsed.data.coords?.accuracyM ?? null,
          checkInDistanceM: state.location.distanceM,
          checkInOutcome: state.location.outcome,
          checkInReason: reason,
          offlineCaptured: isOffline,
          branchId: state.location.branch?.id ?? context.homeBranch?.id,
        },
      }),
      db.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          // The day is open again, so the summary's last-out is no longer
          // true. It is set again on the next check-out.
          checkOutAt: null,
          checkOutClientAt: null,
          checkOutLat: null,
          checkOutLng: null,
          checkOutOutcome: null,
          reviewStatus:
            state.location.outcome === "OUTSIDE" ||
            state.location.outcome === "UNCONFIRMED"
              ? "PENDING"
              : existing.reviewStatus,
        },
      }),
    ]);

    await recordAuditEvent(session, {
      action: "attendance.checkin",
      entityType: "attendance_record",
      entityId: existing.id,
      reason,
      after: {
        punch: nextSequence,
        checkInAt: effectiveAt.toISOString(),
        outcome: state.location.outcome,
        distanceM: state.location.distanceM,
        branch: state.location.branch?.name ?? null,
      },
    });

    if (
      state.location.outcome === "OUTSIDE" ||
      state.location.outcome === "UNCONFIRMED"
    ) {
      await notify.attendanceException(session, existing.id);
      await raiseAttendanceException(
        session,
        existing.id,
        session.membership.id,
        session.user.displayName,
        state.location.outcome === "OUTSIDE"
          ? `Checked in again ${state.location.distanceM ?? "?"} m from ${state.location.branch?.name ?? "the permitted area"}.`
          : "Checked in again with location unavailable.",
      );
    }

    revalidatePath("/home");
    revalidatePath("/attendance");

    return {
      ok: true,
      message: `Checked in at ${formatClockTime(effectiveAt, session.tenant.timezone)}`,
      detail: `This is visit ${nextSequence} today. Your earlier hours are kept.`,
    };
  }

  // Idempotent: a second tap — or a queued action retried after the
  // connection returned — produces no second record and no error.
  if (existing?.checkInAt) {
    // A queued check-in whose captured time differs from what is already
    // recorded is a genuine conflict. The server record stands, but the
    // losing version is preserved so an admin can see both
    // (edge-cases.md → "Sync conflict").
    const queuedAt = parsed.data.clientCapturedAt
      ? new Date(parsed.data.clientCapturedAt)
      : null;
    const differsByMinute =
      queuedAt != null &&
      Math.abs(queuedAt.getTime() - existing.checkInAt.getTime()) > 60_000;

    if (differsByMinute && !existing.conflictNote) {
      const both = `This phone recorded ${formatClockTime(queuedAt, session.tenant.timezone)} while offline; ${formatClockTime(existing.checkInAt, session.tenant.timezone)} was already saved. The saved time stands.`;
      await db.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          conflictNote: both,
          reviewStatus:
            existing.reviewStatus === "NONE" ? "PENDING" : existing.reviewStatus,
        },
      });
      await recordAuditEvent(session, {
        action: "attendance.sync_conflict",
        entityType: "attendance_record",
        entityId: existing.id,
        after: {
          recorded: existing.checkInAt.toISOString(),
          queued: queuedAt.toISOString(),
        },
      });
      await notify.attendanceException(session, existing.id);
      await raiseAttendanceException(
        session,
        existing.id,
        session.membership.id,
        session.user.displayName,
        "Two different check-in times for this day. Both are on the record.",
      );

      return {
        ok: true,
        message: `Checked in at ${formatClockTime(existing.checkInAt, session.tenant.timezone)}`,
        detail:
          "A different time was saved while you were offline. Your manager will see both.",
      };
    }

    return {
      ok: true,
      message: `Checked in at ${formatClockTime(existing.checkInAt, session.tenant.timezone)}`,
      detail: "This is already recorded for today.",
    };
  }

  const needsReview =
    state.location.outcome === "OUTSIDE" ||
    state.location.outcome === "UNCONFIRMED";

  const policyVersion = await getPolicyVersion(session.tenant.id, "attendance");
  const snapshot = toJson(buildSnapshot(context, state, policyVersion));
  // The location this was JUDGED against — for roaming staff that need not
  // be their home location.
  const matchedBranchId = state.location.branch?.id ?? context.homeBranch?.id;

  const record = await db.attendanceRecord.upsert({
    where: {
      tenantId_membershipId_workDate: {
        tenantId: session.tenant.id,
        membershipId: session.membership.id,
        workDate,
      },
    },
    update: {
      checkInAt: effectiveAt,
      checkInClientAt: captured.at,
      checkInLat: parsed.data.coords?.lat,
      checkInLng: parsed.data.coords?.lng,
      checkInAccuracyM: parsed.data.coords?.accuracyM ?? null,
      checkInDistanceM: state.location.distanceM,
      checkInOutcome: state.location.outcome,
      checkInReason: reason,
      lateMinutes: state.lateBy,
      reviewStatus: needsReview ? "PENDING" : "NONE",
      branchId: matchedBranchId,
      offlineCaptured: isOffline,
      policySnapshot: snapshot,
    },
    create: {
      tenantId: session.tenant.id,
      membershipId: session.membership.id,
      workDate,
      checkInAt: effectiveAt,
      checkInClientAt: captured.at,
      checkInLat: parsed.data.coords?.lat,
      checkInLng: parsed.data.coords?.lng,
      checkInAccuracyM: parsed.data.coords?.accuracyM ?? null,
      checkInDistanceM: state.location.distanceM,
      checkInOutcome: state.location.outcome,
      checkInReason: reason,
      lateMinutes: state.lateBy,
      reviewStatus: needsReview ? "PENDING" : "NONE",
      branchId: matchedBranchId,
      offlineCaptured: isOffline,
      policySnapshot: snapshot,
    },
  });

  // The day's first pair. Every day has one, whether or not the company
  // allows a second — so hours are always summed from punches and never
  // from the summary, which would count breaks as work.
  await db.attendancePunch.upsert({
    where: { recordId_sequence: { recordId: record.id, sequence: 1 } },
    update: {
      checkInAt: effectiveAt,
      checkInClientAt: captured.at,
      checkInLat: parsed.data.coords?.lat,
      checkInLng: parsed.data.coords?.lng,
      checkInAccuracyM: parsed.data.coords?.accuracyM ?? null,
      checkInDistanceM: state.location.distanceM,
      checkInOutcome: state.location.outcome,
      checkInReason: reason,
      offlineCaptured: isOffline,
      branchId: matchedBranchId,
    },
    create: {
      tenantId: session.tenant.id,
      recordId: record.id,
      sequence: 1,
      checkInAt: effectiveAt,
      checkInClientAt: captured.at,
      checkInLat: parsed.data.coords?.lat,
      checkInLng: parsed.data.coords?.lng,
      checkInAccuracyM: parsed.data.coords?.accuracyM ?? null,
      checkInDistanceM: state.location.distanceM,
      checkInOutcome: state.location.outcome,
      checkInReason: reason,
      offlineCaptured: isOffline,
      branchId: matchedBranchId,
    },
  });

  await recordAuditEvent(session, {
    action: "attendance.checkin",
    entityType: "attendance_record",
    entityId: record.id,
    reason,
    after: {
      checkInAt: effectiveAt.toISOString(),
      // Offline records are device-timed; keep the arrival time and the
      // clock skew so an admin can review it (edge-cases.md).
      offlineCaptured: isOffline,
      receivedAt: isOffline ? now.toISOString() : undefined,
      clockSkewMs: isOffline ? captured.skewMs : undefined,
      lateMinutes: state.lateBy,
      outcome: state.location.outcome,
      distanceM: state.location.distanceM,
      branch: state.location.branch?.name ?? null,
      awayFromHomeBranch:
        state.location.branch != null &&
        context.homeBranch != null &&
        state.location.branch.id !== context.homeBranch.id,
    },
  });

  if (needsReview) {
    await notify.attendanceException(session, record.id);
    await raiseAttendanceException(
      session,
      record.id,
      session.membership.id,
      session.user.displayName,
      state.location.outcome === "OUTSIDE"
        ? `Checked in ${state.location.distanceM ?? "?"} m from ${state.location.branch?.name ?? "the permitted area"}.`
        : "Checked in with location unavailable.",
    );
  } else {
    // Final immediately — points count now. A pending-review check-in
    // scores when (and only when) the review approves it.
    await awardForCheckIn({
      session,
      membershipId: session.membership.id,
      recordId: record.id,
      workDate,
      effectiveAt,
      lateMinutes: state.lateBy,
      shiftStartMinutes: context.shift.startMinutes,
      isFirstPunchOfDay: true,
    });
  }

  revalidatePath("/home");
  revalidatePath("/attendance");

  const time = formatClockTime(now, session.tenant.timezone);
  if (needsReview) {
    const where =
      state.location.distanceM != null
        ? ` · ${formatDistance(state.location.distanceM)} outside the area`
        : "";
    return {
      ok: true,
      message: `Checked in at ${time}${where}`,
      detail: "Sent to your manager for approval.",
    };
  }
  if (state.lateBy > 0) {
    return {
      ok: true,
      message: `Checked in at ${time}`,
      detail: `Late by ${state.lateBy} min · sent for review.`,
    };
  }
  // "Recorded at {branch}" (copy-deck.md §5) — worth saying when someone
  // has checked in somewhere other than their usual place of work.
  const awayFromHome =
    state.location.branch != null &&
    context.homeBranch != null &&
    state.location.branch.id !== context.homeBranch.id;
  const firstName = session.user.displayName.split(/\s+/)[0];
  return {
    ok: true,
    message: `Checked in at ${time}`,
    detail: awayFromHome
      ? `Recorded at ${state.location.branch?.name}. Have a good shift, ${firstName}.`
      : `Have a good shift, ${firstName}.`,
  };
}

const checkOutSchema = z.object({
  coords: coordsSchema,
  clientCapturedAt: z.string().datetime().optional(),
});

export async function checkOutAction(
  input: z.input<typeof checkOutSchema>,
): Promise<ActionResult> {
  const parsed = checkOutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That check-out could not be read. Try again." };
  }

  const { session, decision } = await checkAccess({ module: "ATTENDANCE" });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const now = new Date();
  // Same rule as check-in: a queued check-out records when the person
  // actually left, not when the phone found signal.
  const captured = resolveCapturedAt(parsed.data.clientCapturedAt, now);
  if (captured.rejected) return { ok: false, error: captured.rejected };
  const effectiveAt = captured.at ?? now;

  /**
   * Check out of the visit that is actually OPEN — not of today's date.
   *
   * This used to look up the record for the calendar day the check-out
   * happened on, which quietly broke every shift crossing midnight. Someone
   * who started at 22:00, or at 00:11 on a 24x7 shift, found their visit
   * belonged to yesterday and got told "You haven't checked in today" —
   * false, with their own check-in sitting in the database. Their visit
   * then stayed open for ever. edge-cases.md already said the record
   * belongs to the shift's START date; the lookup did not.
   */
  const openPunch = await db.attendancePunch.findFirst({
    where: {
      checkOutAt: null,
      record: {
        tenantId: session.tenant.id,
        membershipId: session.membership.id,
      },
    },
    orderBy: { checkInAt: "desc" },
    include: { record: true },
  });

  if (!openPunch) {
    // Nothing open. Either they never checked in, or they already left.
    const today = await db.attendanceRecord.findUnique({
      where: {
        tenantId_membershipId_workDate: {
          tenantId: session.tenant.id,
          membershipId: session.membership.id,
          workDate: workDateInTimezone(effectiveAt, session.tenant.timezone),
        },
      },
    });
    if (today?.checkOutAt) {
      return {
        ok: true,
        message: `Checked out at ${formatClockTime(today.checkOutAt, session.tenant.timezone)}`,
        detail: "This is already recorded for today.",
      };
    }
    return {
      ok: false,
      error:
        "You haven't checked in, so there's nothing to check out of. Check in first, or ask your manager to record it.",
    };
  }

  // Open far too long to be a shift. Recording it as one would put a day
  // of overtime on a payslip that nobody worked, so it goes to the
  // correction flow instead — which asks for a time and a reason, and
  // shows the manager the hours before they approve.
  if (isVisitStale(openPunch.checkInAt, effectiveAt)) {
    const since = formatClockTime(openPunch.checkInAt, session.tenant.timezone);
    return {
      ok: false,
      error: `Your last check-in was at ${since}, more than ${MAX_OPEN_VISIT_HOURS} hours ago, so this can't be recorded as one stretch of work. Ask your manager to correct that day — they can set the time you actually left.`,
    };
  }

  const record = openPunch.record;
  const context = await loadAttendanceContext(session);
  const state = computeCheckInState(context, parsed.data.coords ?? null, effectiveAt);

  await db.$transaction([
    db.attendanceRecord.update({
      where: { id: record.id },
      data: {
        checkOutAt: effectiveAt,
        checkOutClientAt: captured.at,
        checkOutLat: parsed.data.coords?.lat,
        checkOutLng: parsed.data.coords?.lng,
        checkOutOutcome: state.location.outcome,
      },
    }),
    ...(openPunch
      ? [
          db.attendancePunch.update({
            where: { id: openPunch.id },
            data: {
              checkOutAt: effectiveAt,
              checkOutClientAt: captured.at,
              checkOutLat: parsed.data.coords?.lat,
              checkOutLng: parsed.data.coords?.lng,
              checkOutOutcome: state.location.outcome,
            },
          }),
        ]
      : []),
  ]);

  await recordAuditEvent(session, {
    action: "attendance.checkout",
    entityType: "attendance_record",
    entityId: record.id,
    after: {
      checkOutAt: effectiveAt.toISOString(),
      offlineCaptured: captured.at != null,
      outcome: state.location.outcome,
      branch: state.location.branch?.name ?? null,
    },
  });

  // Checking out while out on a field trip ends the visit and the trip at
  // the check-out (FIELD-VISITS-MODULE.md §3). Never fails the check-out.
  await endFieldWorkAtCheckOut(session, {
    at: effectiveAt,
    clientAt: captured.at,
    coords: parsed.data.coords ?? null,
  });

  // The recorded check-out completes the day (full-day points).
  await awardForCheckOut({
    session,
    membershipId: session.membership.id,
    recordId: record.id,
    workDate: record.workDate,
  });

  revalidatePath("/home");
  revalidatePath("/attendance");

  return {
    ok: true,
    message: `Checked out at ${formatClockTime(now, session.tenant.timezone)}`,
    detail: "Your hours for today are recorded.",
  };
}

/**
 * Missed check-out correction (edge-cases.md → "Missed check-out").
 *
 * FlowHRMS never invents a check-out time. The employee proposes one with a
 * reason; the manager sees the hours it would record before approving.
 */
const correctionSchema = z.object({
  recordId: z.string().uuid(),
  /** HH:mm in the tenant's timezone. */
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, "Give a time like 18:30."),
  reason: z.string().trim().min(1, "Say what happened.").max(500),
});

export async function requestCheckOutCorrectionAction(
  input: z.input<typeof correctionSchema>,
): Promise<ActionResult> {
  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the correction details.",
    };
  }

  const { session, decision } = await checkAccess({
    module: "ATTENDANCE",
    feature: "missed_punch_correction",
  });
  if (!decision.allowed) {
    return {
      ok: false,
      error: decision.message ?? "Corrections are turned off for your company.",
    };
  }

  const db = getDb();
  const record = await db.attendanceRecord.findFirst({
    where: {
      id: parsed.data.recordId,
      tenantId: session.tenant.id,
      membershipId: session.membership.id, // own records only
    },
  });
  if (!record) {
    return { ok: false, error: "That record is no longer available." };
  }
  if (!record.checkInAt) {
    return { ok: false, error: "There is no check-in to correct." };
  }
  if (record.checkOutAt) {
    return { ok: false, error: "A check-out is already recorded for that day." };
  }

  // The proposed time is stored as a request, NOT applied — a manager
  // approves it, and only then does it become the record.
  await db.attendanceRecord.update({
    where: { id: record.id },
    data: {
      reviewStatus: "PENDING",
      checkInReason: record.checkInReason
        ? `${record.checkInReason} · Correction requested: check-out ${parsed.data.checkOutTime} — ${parsed.data.reason}`
        : `Correction requested: check-out ${parsed.data.checkOutTime} — ${parsed.data.reason}`,
    },
  });

  await recordAuditEvent(session, {
    action: "attendance.correction_requested",
    entityType: "attendance_record",
    entityId: record.id,
    reason: parsed.data.reason,
    after: { proposedCheckOut: parsed.data.checkOutTime },
  });

  await notify.attendanceException(session, record.id);
  await raiseAttendanceException(
    session,
    record.id,
    session.membership.id,
    session.user.displayName,
    `Asked to record a check-out at ${parsed.data.checkOutTime}.`,
  );

  revalidatePath("/attendance");
  revalidatePath("/admin/attendance");

  return {
    ok: true,
    message: "Correction sent to your manager.",
    detail: "They will see the hours it would record before deciding.",
  };
}

/** Admin/manager decision on an attendance exception (Approval card). */
const reviewSchema = z.object({
  recordId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED", "DETAILS_REQUESTED"]),
  reason: z.string().trim().max(500).optional(),
});

export async function reviewAttendanceAction(
  input: z.input<typeof reviewSchema>,
): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That decision could not be read. Try again." };
  }

  const { session, decision: access } = await checkAccess({
    module: "ATTENDANCE",
    permission: "attendance.review",
  });
  if (!access.allowed) {
    return { ok: false, error: access.message ?? "You don't have access to this." };
  }

  // Reject ALWAYS requires a reason (Constitution §3, Approval card).
  const reason = parsed.data.reason?.trim();
  if (parsed.data.decision === "REJECTED" && !reason) {
    return { ok: false, error: "Add a reason so the employee knows why." };
  }
  if (parsed.data.decision === "DETAILS_REQUESTED" && !reason) {
    return { ok: false, error: QUESTION_NEEDED };
  }

  const db = getDb();
  const record = await db.attendanceRecord.findFirst({
    where: { id: parsed.data.recordId, tenantId: session.tenant.id },
    include: { membership: { include: { user: true } } },
  });
  if (!record) {
    return { ok: false, error: "That record is no longer available." };
  }

  // Nobody reviews their own attendance, except an Owner (approvals.ts).
  const own = selfDecisionRefusal({
    actor: { membershipId: session.membership.id, roleKey: session.membership.roleKey },
    subjectMembershipId: record.membershipId,
    kind: "attendance",
  });
  if (own) return { ok: false, error: own };

  // Stale decision: another admin already decided (edge-cases.md). A
  // question asked earlier leaves it open, so it can still be decided.
  if (!isDecidable(record.reviewStatus)) {
    const who = record.reviewedAt
      ? ` at ${formatClockTime(record.reviewedAt, session.tenant.timezone)}`
      : "";
    return {
      ok: false,
      error: `Already decided${who}. Open the activity log to see who decided.`,
    };
  }

  const before = {
    reviewStatus: record.reviewStatus,
    lateMinutes: record.lateMinutes,
  };

  // Conditional on the exception still being open: of two reviewers
  // pressing at once, exactly one write lands. The other is told, and no
  // audit, points or notification follow for it.
  const written = await db.attendanceRecord.updateMany({
    where: {
      id: record.id,
      tenantId: session.tenant.id,
      reviewStatus: { in: [...DECIDABLE_STATUSES] },
    },
    data: {
      reviewStatus: parsed.data.decision,
      reviewedById: session.membership.id,
      reviewedAt: new Date(),
      // Cleared on approval without a note, so an earlier question is not
      // later shown as the reason for the decision.
      reviewReason: reason ?? null,
    },
  });
  if (written.count === 0) {
    return { ok: false, error: ALREADY_DECIDED };
  }

  await recordAuditEvent(session, {
    action: `attendance.exception_${parsed.data.decision.toLowerCase()}`,
    entityType: "attendance_record",
    entityId: record.id,
    reason,
    before,
    after: { reviewStatus: parsed.data.decision },
  });

  await clearActionRequest(
    session,
    SUBJECT.attendance,
    record.id,
    parsed.data.decision,
  );

  // Approval makes the check-in final, so its base points land now —
  // retro, so streak milestones don't fire on the wrong day, and no
  // early-bird (shift context from days ago cannot be honestly rebuilt).
  if (parsed.data.decision === "APPROVED" && record.checkInAt) {
    await awardForCheckIn({
      session,
      membershipId: record.membershipId,
      recordId: record.id,
      workDate: record.workDate,
      effectiveAt: record.checkInAt,
      lateMinutes: record.lateMinutes,
      shiftStartMinutes: 0,
      isFirstPunchOfDay: true,
      retro: true,
    });
    if (record.checkOutAt) {
      await awardForCheckOut({
        session,
        membershipId: record.membershipId,
        recordId: record.id,
        workDate: record.workDate,
      });
    }
  }

  await notify.attendanceDecision(
    session,
    record.membership.userId,
    parsed.data.decision,
    reason,
  );

  revalidatePath("/admin/attendance");
  revalidatePath("/admin");

  const name = record.membership.user.displayName;
  if (parsed.data.decision === "APPROVED") {
    return { ok: true, message: `Approved. ${name}'s attendance is updated.` };
  }
  if (parsed.data.decision === "REJECTED") {
    return { ok: true, message: `Rejected. ${name} has been told why.` };
  }
  return { ok: true, message: `Details requested from ${name}.` };
}
