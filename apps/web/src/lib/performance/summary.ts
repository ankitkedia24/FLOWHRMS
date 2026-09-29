import "server-only";

import { getDb } from "@/lib/db";
import { getPolicy, getPolicyVersion } from "@/lib/policies";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { evaluateAccess } from "@/lib/authz/flags";
import type { AppSession } from "@/lib/auth/types";
import { workDateInTimezone } from "@/lib/attendance/policy";
import {
  normalizeScoring,
  weekKey,
  type ScoringPolicy,
} from "./scoring";
import { BADGES, type BadgeDefinition } from "./badges";
import { levelFor, type LevelStanding } from "./levels";

/**
 * Everything the motivation surfaces show, assembled once.
 *
 * The My Performance screen and the Home widget both read THIS, so the
 * flame on the widget and the flame on the full screen can never disagree
 * — the classic gamification bug that teaches people the numbers are
 * decorative.
 *
 * Every figure derives from the ledger or the attendance table. Nothing
 * here writes; awarding lives in award.ts on the action paths.
 */

export interface EarnedBadge {
  key: string;
  name: string;
  earnedLine: string;
  earnedAt: Date;
}

export interface LockedBadge {
  key: string;
  name: string;
  howToEarn: string;
}

export interface Celebration {
  badgeKey: string;
  /** Badge name, or the level name for level_N keys. */
  title: string;
  kind: "badge" | "level";
}

export interface PerformanceSummary {
  published: boolean;
  version: number;
  policy: ScoringPolicy | null;
  totalPoints: number;
  todayPoints: number;
  weekPoints: number;
  level: LevelStanding;
  /** Consecutive on-time worked days, as of today. */
  streak: number;
  /** Longest run inside the last year — a personal best, labelled so. */
  longestStreak: number;
  bestDay: { points: number; date: Date | null };
  bestWeek: { points: number; week: string | null };
  /** Mon..Sun of the current week, tenant-local days. */
  weekBars: Array<{ day: string; points: number; isToday: boolean }>;
  earned: EarnedBadge[];
  locked: LockedBadge[];
  celebrations: Celebration[];
  /** An active double-points window, for the Home banner. */
  boost: { name: string; multiplier: number; endDate: Date } | null;
  /** Whether the leaderboard feature is enabled for this person. */
  leaderboardOn: boolean;
  /** Whether the rewards store is enabled for this person. */
  rewardsOn: boolean;
}

const DAY_MS = 86_400_000;

export async function loadPerformanceSummary(
  session: AppSession,
): Promise<PerformanceSummary | null> {
  const entitlements = await loadEntitlements(session.tenant.id, session.user.id);
  const moduleOn = evaluateAccess({
    session,
    entitlements,
    module: "PERFORMANCE",
  }).allowed;
  if (!moduleOn) return null;
  const leaderboardOn = evaluateAccess({
    session,
    entitlements,
    module: "PERFORMANCE",
    feature: "leaderboard",
  }).allowed;
  const rewardsOn = evaluateAccess({
    session,
    entitlements,
    module: "PERFORMANCE",
    feature: "rewards",
  }).allowed;

  const db = getDb();
  const tenantId = session.tenant.id;
  const membershipId = session.membership.id;
  const today = workDateInTimezone(new Date(), session.tenant.timezone);
  const thisWeek = weekKey(today);

  const raw = await getPolicy<unknown>(tenantId, "performance");
  const policy = raw == null ? null : normalizeScoring(raw);
  const version = raw == null ? 0 : await getPolicyVersion(tenantId, "performance");

  const [total, events, badgeRows, boost] = await Promise.all([
    db.performanceEvent.aggregate({
      where: { tenantId, membershipId },
      _sum: { points: true },
    }),
    // A year of events covers best-day/best-week honestly for V1 scale.
    db.performanceEvent.findMany({
      where: {
        tenantId,
        membershipId,
        workDate: { gte: new Date(today.getTime() - 365 * DAY_MS) },
      },
      select: { workDate: true, points: true },
    }),
    db.employeeBadge.findMany({
      where: { tenantId, membershipId },
      orderBy: { earnedAt: "asc" },
    }),
    db.performanceBoost.findFirst({
      where: { tenantId, startDate: { lte: today }, endDate: { gte: today } },
      orderBy: { multiplier: "desc" },
    }),
  ]);

  // ---- daily and weekly sums from one pass over the events
  const byDay = new Map<string, number>();
  const byWeek = new Map<string, number>();
  for (const e of events) {
    const d = e.workDate.toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + e.points);
    const w = weekKey(e.workDate);
    byWeek.set(w, (byWeek.get(w) ?? 0) + e.points);
  }
  const todayKey = today.toISOString().slice(0, 10);

  let bestDay: PerformanceSummary["bestDay"] = { points: 0, date: null };
  for (const [d, points] of byDay) {
    if (points > bestDay.points) bestDay = { points, date: new Date(`${d}T00:00:00.000Z`) };
  }
  let bestWeek: PerformanceSummary["bestWeek"] = { points: 0, week: null };
  for (const [w, points] of byWeek) {
    if (points > bestWeek.points) bestWeek = { points, week: w };
  }

  // ---- streaks from the attendance table (the same rule award.ts uses)
  const records = await db.attendanceRecord.findMany({
    where: {
      tenantId,
      membershipId,
      workDate: { gte: new Date(today.getTime() - 365 * DAY_MS) },
      checkInAt: { not: null },
    },
    select: { workDate: true, lateMinutes: true, reviewStatus: true, exemptionStatus: true },
  });
  const standing = new Map<string, boolean>(); // date → on time?
  for (const r of records) {
    const late = r.lateMinutes > 0 && r.exemptionStatus !== "EXEMPTED";
    standing.set(
      r.workDate.toISOString().slice(0, 10),
      !late && r.reviewStatus !== "REJECTED",
    );
  }
  let streak = 0;
  let longestStreak = 0;
  let run = 0;
  // Oldest → newest for the longest run; unrecorded days are skipped
  // (leave pauses, never breaks — PERFORMANCE-MODULE.md §1.8).
  for (let i = 365; i >= 0; i--) {
    const key = new Date(today.getTime() - i * DAY_MS).toISOString().slice(0, 10);
    const s = standing.get(key);
    if (s === undefined) continue;
    run = s ? run + 1 : 0;
    if (run > longestStreak) longestStreak = run;
  }
  // Current streak: walk back from today.
  for (let i = 0; i <= 365; i++) {
    const key = new Date(today.getTime() - i * DAY_MS).toISOString().slice(0, 10);
    const s = standing.get(key);
    if (s === undefined) continue;
    if (!s) break;
    streak += 1;
  }

  // ---- this week's bars, Monday-first
  const dayOfWeek = (today.getUTCDay() + 6) % 7; // Mon=0
  const monday = new Date(today.getTime() - dayOfWeek * DAY_MS);
  const weekBars = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime() + i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    return {
      day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
      points: byDay.get(key) ?? 0,
      isToday: key === todayKey,
    };
  });

  // ---- badges: earned from the store, locked from the catalog
  const earnedKeys = new Set(badgeRows.map((b) => b.badgeKey));
  const catalogByKey = new Map<string, BadgeDefinition>(BADGES.map((b) => [b.key, b]));
  const earned: EarnedBadge[] = badgeRows
    .filter((b) => catalogByKey.has(b.badgeKey))
    .map((b) => {
      const def = catalogByKey.get(b.badgeKey)!;
      return { key: b.badgeKey, name: def.name, earnedLine: def.earnedLine, earnedAt: b.earnedAt };
    });
  const locked: LockedBadge[] = BADGES.filter((b) => !earnedKeys.has(b.key)).map((b) => ({
    key: b.key,
    name: b.name,
    howToEarn: b.howToEarn,
  }));

  const levelNames = (policy ?? normalizeScoring(null)).levelNames;
  const totalPoints = total._sum.points ?? 0;

  // ---- celebrations not yet shown, badge and level alike
  const celebrations: Celebration[] = badgeRows
    .filter((b) => b.celebratedAt === null)
    .map((b) => {
      if (b.badgeKey.startsWith("level_")) {
        const index = Number(b.badgeKey.split("_")[1]);
        return {
          badgeKey: b.badgeKey,
          title: levelNames[index] ?? `Level ${index + 1}`,
          kind: "level" as const,
        };
      }
      const def = catalogByKey.get(b.badgeKey);
      return def
        ? { badgeKey: b.badgeKey, title: def.name, kind: "badge" as const }
        : null;
    })
    .filter((c): c is Celebration => c !== null);

  return {
    published: raw != null,
    version,
    policy,
    totalPoints,
    todayPoints: byDay.get(todayKey) ?? 0,
    weekPoints: byWeek.get(thisWeek) ?? 0,
    level: levelFor(totalPoints, { levelNames }),
    streak,
    longestStreak,
    bestDay,
    bestWeek,
    weekBars,
    earned,
    locked,
    celebrations,
    boost: boost
      ? { name: boost.name, multiplier: boost.multiplier, endDate: boost.endDate }
      : null,
    leaderboardOn,
    rewardsOn,
  };
}
