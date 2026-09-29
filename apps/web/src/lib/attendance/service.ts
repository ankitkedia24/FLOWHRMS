import "server-only";

import { getDb } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { evaluateAccess } from "@/lib/authz/flags";
import { getPolicy, getPolicyVersion } from "@/lib/policies";
import { dateKey, offDayOn, personWeeklyOff } from "./calendar";
import { loadWorkCalendar } from "./work-calendar";
import { BUILT_IN_SHIFT } from "./shifts";
import {
  candidateBranches,
  effectiveRadiusM,
  workDateInTimezone,
  type AttendanceContext,
  type BranchPolicy,
} from "./policy";

/**
 * Attendance read model — resolves policy, permitted areas and today's
 * record for a session. Every query is tenant-scoped from the session,
 * never from client input (Constitution §2).
 *
 * The selection maths lives in `policy.ts` (pure, and shared with the
 * browser); this module only answers the database question — WHICH
 * locations are candidates, and what radius applies to each.
 */

export type { AttendanceContext, TodayAttendance } from "./policy";
export { computeCheckInState } from "./policy";

const DEFAULT_SHIFT = BUILT_IN_SHIFT;

const DEFAULT_RADIUS_M = 300;

interface AttendancePolicyValue {
  graceMinutes?: number;
  radiusM?: number;
  requireReasonOutsideArea?: boolean;
}

/** Load everything the check-in screen needs for the current session. */
export async function loadAttendanceContext(
  session: AppSession,
): Promise<AttendanceContext> {
  const db = getDb();
  const entitlements = await loadEntitlements(
    session.tenant.id,
    session.user.id,
  );

  const locationRequired = evaluateAccess({
    session,
    entitlements,
    module: "ATTENDANCE",
    feature: "geofence",
  }).allowed;

  // The per-person roaming setting only takes effect when the tenant has
  // the feature on. The flag is the control (Constitution §5).
  const anyBranchFeatureOn = evaluateAccess({
    session,
    entitlements,
    module: "ATTENDANCE",
    feature: "any_branch_check_in",
  }).allowed;

  const [membership, policy] = await Promise.all([
    db.tenantMembership.findUnique({
      where: { id: session.membership.id },
      include: { branch: true, shift: true },
    }),
    getPolicy<AttendancePolicyValue>(session.tenant.id, "attendance"),
  ]);

  const tenantRadiusM = policy?.radiusM ?? DEFAULT_RADIUS_M;

  const fallbackShift = membership?.shift
    ? null
    : await db.shift.findFirst({
        where: { tenantId: session.tenant.id, isDefault: true },
      });

  const resolvedShift = membership?.shift ?? fallbackShift ?? {
    ...DEFAULT_SHIFT,
    graceMinutes: policy?.graceMinutes ?? DEFAULT_SHIFT.graceMinutes,
  };

  const toBranchPolicy = (branch: {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    radiusM: number | null;
  }): BranchPolicy => ({
    id: branch.id,
    name: branch.name,
    lat: branch.lat,
    lng: branch.lng,
    radiusM: effectiveRadiusM(branch.radiusM, tenantRadiusM),
  });

  const homeBranch = membership?.branch
    ? toBranchPolicy(membership.branch)
    : null;
  const canCheckInAtAnyBranch = membership?.canCheckInAtAnyBranch ?? false;

  // Only roaming staff need the full list — everyone else costs one join.
  const activeBranches =
    canCheckInAtAnyBranch && anyBranchFeatureOn
      ? (
          await db.branch.findMany({
            where: { tenantId: session.tenant.id, isActive: true },
            orderBy: { name: "asc" },
          })
        ).map(toBranchPolicy)
      : [];

  // A person with no home location while the company has locations is a
  // configuration gap, not "location not required" — say so rather than
  // silently skipping the permitted-area check.
  const branchMissing =
    homeBranch === null &&
    locationRequired &&
    (await db.branch.count({
      where: { tenantId: session.tenant.id, isActive: true },
    })) > 0;

  const multiplePunchAllowed = evaluateAccess({
    session,
    entitlements,
    module: "ATTENDANCE",
    feature: "multiple_punch",
  }).allowed;

  const workCalendar = await loadWorkCalendar(session.tenant.id);
  const personOff = personWeeklyOff(workCalendar, membership ?? null);

  const workDate = workDateInTimezone(new Date(), session.tenant.timezone);
  const record = await db.attendanceRecord.findUnique({
    where: {
      tenantId_membershipId_workDate: {
        tenantId: session.tenant.id,
        membershipId: session.membership.id,
        workDate,
      },
    },
    // Hours come from the pairs, never from first-in/last-out, which would
    // count a lunch break as work once a day can have more than one visit.
    include: { punches: { orderBy: { sequence: "asc" } } },
  });

  return {
    timezone: session.tenant.timezone,
    homeBranch,
    branches: candidateBranches({
      homeBranch,
      activeBranches,
      canCheckInAtAnyBranch,
      anyBranchFeatureOn,
    }),
    canCheckInAtAnyBranch: canCheckInAtAnyBranch && anyBranchFeatureOn,
    branchMissing,
    shift: {
      name: resolvedShift.name,
      startMinutes: resolvedShift.startMinutes,
      endMinutes: resolvedShift.endMinutes,
      graceMinutes: resolvedShift.graceMinutes,
    },
    locationRequired,
    multiplePunchAllowed,
    workCalendar: { calendar: workCalendar, weeklyOffDays: personOff },
    offToday: offDayOn(dateKey(workDate), workCalendar, personOff),
    today: record
      ? {
          recordId: record.id,
          checkInAt: record.checkInAt,
          checkOutAt: record.checkOutAt,
          lateMinutes: record.lateMinutes,
          reviewStatus: record.reviewStatus,
          exemptionStatus: record.exemptionStatus,
          checkInOutcome: record.checkInOutcome,
          checkInDistanceM: record.checkInDistanceM,
          offlineCaptured: record.offlineCaptured,
          punches: record.punches.map((p) => ({
            checkInAt: p.checkInAt,
            checkOutAt: p.checkOutAt,
          })),
        }
      : null,
  };
}

/** The tenant's default permitted-area radius and current policy version. */
export async function loadAttendancePolicyMeta(
  tenantId: string,
): Promise<{ radiusM: number; version: number }> {
  const [policy, version] = await Promise.all([
    getPolicy<AttendancePolicyValue>(tenantId, "attendance"),
    getPolicyVersion(tenantId, "attendance"),
  ]);
  return { radiusM: policy?.radiusM ?? DEFAULT_RADIUS_M, version };
}
