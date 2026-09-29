import "server-only";

import { getDb } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { workDateInTimezone } from "@/lib/attendance/policy";
import { weekKey } from "./scoring";
import {
  departmentBoard,
  mostImproved,
  neighbourhoodFor,
  previousSeasonBounds,
  questForWeek,
  questProgress,
  rankSeason,
  seasonKey,
  type DepartmentRow,
  type Improvement,
  type Neighbourhood,
  type QuestProgress,
  type RankedEntry,
  type SeasonEntry,
} from "./seasons";

/**
 * Leaderboard assembly (PERFORMANCE-MODULE.md §C) — reads the ledger,
 * ranks with the pure season maths, and keeps the fair-visibility rule by
 * construction: what leaves this module is names, points, ranks and
 * badges-adjacent numbers. No attendance detail about anyone else ever
 * rides along.
 *
 * Seasons are calendar months; history is browsable because a past board
 * is the same fold over older rows — no close-out job, nothing to forget.
 */

export interface LeaderboardData {
  season: string;
  seasons: string[];
  podium: RankedEntry[];
  ranked: RankedEntry[];
  neighbourhood: Neighbourhood | null;
  improved: Improvement | null;
  departments: DepartmentRow[];
  /** The same board cut to this week (only for the current season). */
  sprint: RankedEntry[];
  quest: QuestProgress | null;
  totalPlayers: number;
}

function boundsForSeason(season: string): { start: Date; end: Date } {
  const [year, month] = season.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0)),
  };
}

export async function loadLeaderboard(
  session: AppSession,
  requestedSeason?: string,
): Promise<LeaderboardData> {
  const db = getDb();
  const tenantId = session.tenant.id;
  const today = workDateInTimezone(new Date(), session.tenant.timezone);
  const currentSeason = seasonKey(today);
  const season = /^\d{4}-\d{2}$/.test(requestedSeason ?? "")
    ? requestedSeason!
    : currentSeason;
  const bounds = boundsForSeason(season);

  // Names and departments, once, for every active member.
  const members = await db.tenantMembership.findMany({
    where: { tenantId, status: "ACTIVE" },
    select: {
      id: true,
      user: { select: { displayName: true } },
      department: { select: { name: true } },
    },
  });
  const nameById = new Map(
    members.map((m) => [m.id, { name: m.user.displayName, dept: m.department?.name ?? null }]),
  );

  const entriesFor = async (start: Date, end: Date): Promise<SeasonEntry[]> => {
    const rows = await db.performanceEvent.groupBy({
      by: ["membershipId"],
      where: { tenantId, workDate: { gte: start, lte: end } },
      _sum: { points: true },
    });
    return rows
      .filter((r) => nameById.has(r.membershipId))
      .map((r) => ({
        membershipId: r.membershipId,
        name: nameById.get(r.membershipId)!.name,
        departmentName: nameById.get(r.membershipId)!.dept,
        points: r._sum.points ?? 0,
      }));
  };

  const entries = await entriesFor(bounds.start, bounds.end);
  const ranked = rankSeason(entries);

  // Previous season for Most Improved — relative to the VIEWED season.
  const prevBounds = previousSeasonBounds(bounds.start);
  const previous = await entriesFor(prevBounds.start, prevBounds.end);

  // Weekly sprint + quest only make sense on the live season.
  let sprint: RankedEntry[] = [];
  let quest: QuestProgress | null = null;
  if (season === currentSeason) {
    const dayOfWeek = (today.getUTCDay() + 6) % 7;
    const monday = new Date(today.getTime() - dayOfWeek * 86_400_000);
    sprint = rankSeason(await entriesFor(monday, today)).slice(0, 5);

    const thisWeek = weekKey(today);
    const q = questForWeek(thisWeek);
    const me = session.membership.id;
    if (q.metric === "on_time_days") {
      const onTime = await db.attendanceRecord.count({
        where: {
          tenantId,
          membershipId: me,
          workDate: { gte: monday, lte: today },
          checkInAt: { not: null },
          lateMinutes: 0,
          reviewStatus: { in: ["NONE", "APPROVED"] },
        },
      });
      quest = questProgress(q, { onTimeDaysThisWeek: onTime, tasksCompletedThisWeek: 0 });
    } else {
      const tasks = await db.performanceEvent.count({
        where: {
          tenantId,
          membershipId: me,
          kind: "task_completed",
          workDate: { gte: monday, lte: today },
        },
      });
      quest = questProgress(q, { onTimeDaysThisWeek: 0, tasksCompletedThisWeek: tasks });
    }
  }

  // Browsable history: every month between the first event and now.
  const first = await db.performanceEvent.findFirst({
    where: { tenantId },
    orderBy: { workDate: "asc" },
    select: { workDate: true },
  });
  const seasons: string[] = [];
  if (first) {
    const cursor = new Date(
      Date.UTC(first.workDate.getUTCFullYear(), first.workDate.getUTCMonth(), 1),
    );
    while (seasonKey(cursor) <= currentSeason) {
      seasons.push(seasonKey(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    seasons.reverse();
  }

  return {
    season,
    seasons,
    podium: ranked.slice(0, 3),
    ranked,
    neighbourhood: neighbourhoodFor(ranked, session.membership.id),
    improved: mostImproved(entries, previous),
    departments: departmentBoard(entries),
    sprint,
    quest,
    totalPlayers: ranked.length,
  };
}
