import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { loadFieldVisitsPolicy } from "./access";
import { mayRecordVisits, type FieldVisitsPolicy } from "./policy";
import {
  boardStatus,
  BOARD_ORDER,
  dateKeyIn,
  personTotals,
  summariseDay,
  type BoardStatus,
  type DayTrip,
  type DaySummary,
  type PersonTotals,
} from "./state";

/**
 * Field visits for the people you look after (FIELD-VISITS-MODULE.md §5):
 * everyone, with `fieldvisits.view`; your department, if you head it; your
 * direct reports, if you are their reporting manager. Owners never record,
 * so they are never listed. Tenant-scoped from the session throughout.
 */

export interface TeamScope {
  everyone: boolean;
  /** Departments this person heads. */
  departmentIds: string[];
  me: string;
}

/** What this person may see, or null when it is nobody. */
export async function loadTeamScope(session: AppSession): Promise<TeamScope | null> {
  const db = getDb();
  const me = session.membership.id;
  const everyone = session.permissions.has("fieldvisits.view");
  const [headed, reports] = await Promise.all([
    db.department.findMany({
      where: { tenantId: session.tenant.id, headId: me, isActive: true },
      select: { id: true },
    }),
    db.tenantMembership.count({ where: { tenantId: session.tenant.id, reportingToId: me, status: "ACTIVE" } }),
  ]);
  if (!everyone && headed.length === 0 && reports === 0) return null;
  return { everyone, departmentIds: headed.map((d) => d.id), me };
}

function scopeWhere(scope: TeamScope): Prisma.TenantMembershipWhereInput {
  if (scope.everyone) return {};
  return { OR: [{ departmentId: { in: scope.departmentIds } }, { reportingToId: scope.me }] };
}

export interface TeamMember {
  membershipId: string;
  name: string;
  designation: string | null;
  employeeCode: string | null;
  departmentId: string | null;
  departmentName: string | null;
}

/**
 * The people in scope who record visits under the company's rules, by
 * name. `departmentId` narrows it; it is checked against the scope, never
 * trusted.
 */
export async function loadTeam(
  session: AppSession,
  scope: TeamScope,
  policy: FieldVisitsPolicy,
  departmentId?: string | null,
): Promise<TeamMember[]> {
  const rows = await getDb().tenantMembership.findMany({
    where: {
      tenantId: session.tenant.id,
      status: "ACTIVE",
      ...scopeWhere(scope),
      ...(departmentId ? { departmentId } : {}),
    },
    select: {
      id: true,
      designation: true,
      employeeCode: true,
      departmentId: true,
      role: { select: { key: true } },
      user: { select: { displayName: true } },
      department: { select: { name: true } },
    },
    orderBy: { user: { displayName: "asc" } },
  });
  return rows
    .filter((m) => mayRecordVisits({ roleKey: m.role.key, departmentId: m.departmentId }, policy))
    .map((m) => ({
      membershipId: m.id,
      name: m.user.displayName,
      designation: m.designation,
      employeeCode: m.employeeCode,
      departmentId: m.departmentId,
      departmentName: m.department?.name ?? null,
    }));
}

/** One member, if they are in this viewer's scope. */
export async function teamMember(
  session: AppSession,
  scope: TeamScope,
  membershipId: string,
): Promise<TeamMember | null> {
  const m = await getDb().tenantMembership.findFirst({
    where: { id: membershipId, tenantId: session.tenant.id, ...scopeWhere(scope) },
    select: {
      id: true,
      designation: true,
      employeeCode: true,
      departmentId: true,
      user: { select: { displayName: true } },
      department: { select: { name: true } },
    },
  });
  return m
    ? {
        membershipId: m.id,
        name: m.user.displayName,
        designation: m.designation,
        employeeCode: m.employeeCode,
        departmentId: m.departmentId,
        departmentName: m.department?.name ?? null,
      }
    : null;
}

/** Departments the filter may offer: all, or only those in scope. */
export async function scopeDepartments(session: AppSession, scope: TeamScope) {
  return getDb().department.findMany({
    where: {
      tenantId: session.tenant.id,
      isActive: true,
      ...(scope.everyone ? {} : { id: { in: scope.departmentIds } }),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

type TripRow = DayTrip & { recordId: string; membershipId: string; dayKey: string };

/** Trips of these working days, in the light shape the board and report need. */
async function tripsForRecords(tenantId: string, records: Array<{ id: string; workDate: Date }>): Promise<TripRow[]> {
  if (records.length === 0) return [];
  const dayOf = new Map(records.map((r) => [r.id, r.workDate.toISOString().slice(0, 10)]));
  const rows = await getDb().fieldTrip.findMany({
    where: { tenantId, recordId: { in: [...dayOf.keys()] } },
    orderBy: { startedAt: "asc" },
    select: {
      id: true,
      recordId: true,
      membershipId: true,
      startedAt: true,
      startEstimated: true,
      endedAt: true,
      endKind: true,
      approval: true,
      visits: {
        orderBy: { sequence: "asc" },
        select: {
          placeName: true,
          purposeName: true,
          arrivedAt: true,
          leftAt: true,
          endKind: true,
          isFar: true,
          photoPath: true,
          note: true,
        },
      },
      legs: { select: { sequence: true, meters: true, durationSeconds: true, method: true, status: true } },
    },
  });
  return rows.map((t) => {
    const legs: DayTrip["legs"] = [];
    for (const l of t.legs) {
      legs[l.sequence - 1] = { meters: l.meters, durationSeconds: l.durationSeconds, method: l.method, status: l.status };
    }
    return {
      id: t.id,
      recordId: t.recordId,
      membershipId: t.membershipId,
      dayKey: dayOf.get(t.recordId) ?? "",
      startedAt: t.startedAt,
      startEstimated: t.startEstimated,
      endedAt: t.endedAt,
      endKind: t.endKind,
      approval: t.approval,
      visits: t.visits.map(({ photoPath, ...v }) => ({ ...v, hasPhoto: Boolean(photoPath) })),
      legs,
    };
  });
}

export interface BoardRow {
  member: TeamMember;
  status: BoardStatus;
  today: DaySummary;
  /** The trip to open for this person today, if any. */
  latestTripId: string | null;
  awaitingApproval: number;
}

/** Everyone in scope, where they are right now, out first (§5). */
export async function loadBoard(
  session: AppSession,
  scope: TeamScope,
  policy: FieldVisitsPolicy,
  departmentId?: string | null,
): Promise<BoardRow[]> {
  const tenantId = session.tenant.id;
  const now = new Date();
  const team = await loadTeam(session, scope, policy, departmentId);
  if (team.length === 0) return [];
  const workDate = new Date(`${dateKeyIn(now, session.tenant.timezone)}T00:00:00.000Z`);
  const records = await getDb().attendanceRecord.findMany({
    where: { tenantId, workDate, membershipId: { in: team.map((m) => m.membershipId) } },
    select: { id: true, membershipId: true, workDate: true, checkInAt: true, checkOutAt: true },
  });
  const trips = await tripsForRecords(tenantId, records);

  return team
    .map((member) => {
      const record = records.find((r) => r.membershipId === member.membershipId) ?? null;
      const mine = trips.filter((t) => t.membershipId === member.membershipId);
      return {
        member,
        status: boardStatus({ day: record, trips: mine }),
        today: summariseDay(mine, now),
        latestTripId: mine.at(-1)?.id ?? null,
        awaitingApproval: mine.filter((t) => t.approval === "PENDING").length,
      };
    })
    .sort(
      (a, b) =>
        BOARD_ORDER[a.status.kind] - BOARD_ORDER[b.status.kind] || a.member.name.localeCompare(b.member.name),
    );
}

export interface ReportRow {
  member: TeamMember;
  totals: PersonTotals;
}

/** The month for everyone in scope (§5): what the report page and the CSV show. */
export async function loadMonthReport(
  session: AppSession,
  scope: TeamScope,
  policy: FieldVisitsPolicy,
  range: { first: string; last: string },
  departmentId?: string | null,
): Promise<ReportRow[]> {
  const tenantId = session.tenant.id;
  const team = await loadTeam(session, scope, policy, departmentId);
  if (team.length === 0) return [];
  const records = await getDb().attendanceRecord.findMany({
    where: {
      tenantId,
      membershipId: { in: team.map((m) => m.membershipId) },
      workDate: { gte: new Date(`${range.first}T00:00:00.000Z`), lte: new Date(`${range.last}T00:00:00.000Z`) },
    },
    select: { id: true, workDate: true },
  });
  const trips = await tripsForRecords(tenantId, records);
  const now = new Date();
  return team
    .map((member) => ({
      member,
      totals: personTotals(
        trips.filter((t) => t.membershipId === member.membershipId),
        now,
      ),
    }))
    .sort((a, b) => b.totals.finalMetres + b.totals.estimatedMetres - (a.totals.finalMetres + a.totals.estimatedMetres) || a.member.name.localeCompare(b.member.name));
}

export interface PlaceRow {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  isActive: boolean;
  visits: number;
  lastVisitAt: Date | null;
}

/** The company's saved places, with how often and how lately each was visited. */
export async function loadPlaces(tenantId: string): Promise<PlaceRow[]> {
  const db = getDb();
  const [places, counts] = await Promise.all([
    db.fieldPlace.findMany({
      where: { tenantId },
      select: { id: true, name: true, address: true, lat: true, lng: true, isActive: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    db.fieldVisit.groupBy({
      by: ["placeId"],
      where: { tenantId, placeId: { not: null } },
      _count: { _all: true },
      _max: { arrivedAt: true },
    }),
  ]);
  const byPlace = new Map(counts.map((c) => [c.placeId, c]));
  return places.map((p) => ({
    ...p,
    visits: byPlace.get(p.id)?._count._all ?? 0,
    lastVisitAt: byPlace.get(p.id)?._max.arrivedAt ?? null,
  }));
}

/** Rules and scope together, or the reason there is nothing to show. */
export async function loadTeamContext(session: AppSession): Promise<
  | { ok: true; policy: FieldVisitsPolicy; scope: TeamScope }
  | { ok: false; reason: "unpublished" | "nobody" }
> {
  const published = await loadFieldVisitsPolicy(session.tenant.id);
  if (!published) return { ok: false, reason: "unpublished" };
  const scope = await loadTeamScope(session);
  if (!scope) return { ok: false, reason: "nobody" };
  return { ok: true, policy: published.policy, scope };
}
