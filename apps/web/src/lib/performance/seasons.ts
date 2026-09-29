import { monthKey } from "./scoring";

/**
 * Season and leaderboard maths — pure, no I/O (PERFORMANCE-MODULE.md §C).
 *
 * A season is a calendar month in the tenant's timezone. Standings are
 * computed from ledger rows, which means history is browsable for free:
 * any past month's board is just the same fold over older rows, and no
 * job ever has to "close" a season.
 *
 * The design rules this file enforces by shape:
 * - The bottom of the table is never a wall of shame: below the podium a
 *   person gets their own rank, the neighbours either side, and the GAP
 *   to the next rank — "120 points to #7" is a goal; a raw rank is a
 *   shrug (§1.7).
 * - Most Improved is a first-class result computed against the person's
 *   OWN previous season, so a small team's newcomer can beat the top
 *   scorer to it.
 * - Ties share a rank (standard competition ranking), because two people
 *   on 300 points are equals and inventing an order between them would be
 *   the leaderboard lying.
 */

export interface SeasonEntry {
  membershipId: string;
  name: string;
  departmentName: string | null;
  points: number;
}

export interface RankedEntry extends SeasonEntry {
  rank: number;
}

/** Standard competition ranking: equal points share a rank (1,2,2,4). */
export function rankSeason(entries: readonly SeasonEntry[]): RankedEntry[] {
  const sorted = [...entries].sort(
    (a, b) => b.points - a.points || a.name.localeCompare(b.name),
  );
  let lastPoints = Number.NaN;
  let lastRank = 0;
  return sorted.map((entry, i) => {
    const rank = entry.points === lastPoints ? lastRank : i + 1;
    lastPoints = entry.points;
    lastRank = rank;
    return { ...entry, rank };
  });
}

export interface Neighbourhood {
  /** Up to three: the rows just above, yourself, just below. */
  rows: RankedEntry[];
  /** Points to the next rank up; null when you lead. */
  pointsToNext: number | null;
  yourRank: number;
}

/** Your own slice of the board, with the climb stated as a number. */
export function neighbourhoodFor(
  ranked: readonly RankedEntry[],
  membershipId: string,
): Neighbourhood | null {
  const index = ranked.findIndex((e) => e.membershipId === membershipId);
  if (index === -1) return null;
  const rows = ranked.slice(Math.max(0, index - 1), index + 2);
  const me = ranked[index];
  // The nearest STRICTLY higher score — with ties, the row above may be
  // an equal, and "0 points to overtake an equal" would be nonsense.
  let pointsToNext: number | null = null;
  for (let i = index - 1; i >= 0; i--) {
    if (ranked[i].points > me.points) {
      pointsToNext = ranked[i].points - me.points;
      break;
    }
  }
  return { rows: [...rows], pointsToNext, yourRank: me.rank };
}

export interface Improvement {
  membershipId: string;
  name: string;
  previousPoints: number;
  currentPoints: number;
  climb: number;
}

/**
 * Most improved: biggest climb against their OWN previous season. People
 * with no previous season are excluded — a first month is a debut, not an
 * improvement, and letting debuts win would make the card a welcome mat.
 */
export function mostImproved(
  current: readonly SeasonEntry[],
  previous: readonly SeasonEntry[],
): Improvement | null {
  const previousById = new Map(previous.map((e) => [e.membershipId, e.points]));
  let best: Improvement | null = null;
  for (const entry of current) {
    const before = previousById.get(entry.membershipId);
    if (before === undefined || before <= 0) continue;
    const climb = entry.points - before;
    if (climb <= 0) continue;
    if (!best || climb > best.climb) {
      best = {
        membershipId: entry.membershipId,
        name: entry.name,
        previousPoints: before,
        currentPoints: entry.points,
        climb,
      };
    }
  }
  return best;
}

export interface DepartmentRow {
  departmentName: string;
  members: number;
  totalPoints: number;
  /** The board metric: average per member, so small teams can win (§C). */
  averagePoints: number;
}

export function departmentBoard(entries: readonly SeasonEntry[]): DepartmentRow[] {
  const byDept = new Map<string, { members: number; total: number }>();
  for (const entry of entries) {
    if (!entry.departmentName) continue;
    const row = byDept.get(entry.departmentName) ?? { members: 0, total: 0 };
    row.members += 1;
    row.total += entry.points;
    byDept.set(entry.departmentName, row);
  }
  return [...byDept.entries()]
    .map(([departmentName, { members, total }]) => ({
      departmentName,
      members,
      totalPoints: total,
      averagePoints: Math.round(total / members),
    }))
    .sort((a, b) => b.averagePoints - a.averagePoints);
}

// ----------------------------------------------------------------- quests

export interface QuestDefinition {
  key: string;
  title: string;
  /** What counts toward the goal. */
  metric: "on_time_days" | "tasks_completed";
  target: number;
  bonus: number;
}

/**
 * The rotating weekly quests. Two templates alternate by ISO week parity —
 * deterministic, so every device shows the same quest with no state to
 * sync, and "rotating" stays true without a scheduler.
 */
export const QUESTS: readonly QuestDefinition[] = [
  {
    key: "quest_on_time_5",
    title: "On time 5 days this week",
    metric: "on_time_days",
    target: 5,
    bonus: 30,
  },
  {
    key: "quest_tasks_8",
    title: "8 tasks done this week",
    metric: "tasks_completed",
    target: 8,
    bonus: 30,
  },
];

/** This week's quest, chosen by ISO week parity. */
export function questForWeek(isoWeekKey: string): QuestDefinition {
  const week = Number(isoWeekKey.split("-W")[1] ?? 0);
  return QUESTS[week % QUESTS.length];
}

export interface QuestProgress {
  quest: QuestDefinition;
  progress: number;
  done: boolean;
}

export function questProgress(
  quest: QuestDefinition,
  facts: { onTimeDaysThisWeek: number; tasksCompletedThisWeek: number },
): QuestProgress {
  const progress =
    quest.metric === "on_time_days"
      ? facts.onTimeDaysThisWeek
      : facts.tasksCompletedThisWeek;
  return { quest, progress: Math.min(progress, quest.target), done: progress >= quest.target };
}

// ---------------------------------------------------------------- helpers

/** The month key for "this season" given a tenant-local date. */
export function seasonKey(today: Date): string {
  return monthKey(today);
}

/** First/last day (UTC date-only) of the season a date falls in. */
export function seasonBounds(today: Date): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
    end: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)),
  };
}

/** The season before the one a date falls in. */
export function previousSeasonBounds(today: Date): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)),
    end: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)),
  };
}
