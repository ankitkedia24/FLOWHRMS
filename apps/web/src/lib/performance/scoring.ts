/**
 * Performance scoring — pure logic, no I/O (PERFORMANCE-MODULE.md).
 *
 * The whole module rests on four promises this file keeps by construction:
 *
 * 1. Points derive only from attendance and task evidence — every award
 *    function here takes recorded facts, never opinions.
 * 2. Every rule is individually customizable: its own on/off switch, its
 *    own points, its own thresholds. Companies differ; the module bends.
 * 3. Rewards, never fines — nothing in this file can return negative
 *    points. A bad day earns nothing; it never costs.
 * 4. Transparent by default — each award carries the plain-words line the
 *    ledger will show, written at award time so it cannot drift.
 */

// ------------------------------------------------------------------- rules

export const RULE_KEYS = [
  "on_time",
  "full_day",
  "early_bird",
  "task_completed",
  "task_on_time",
  "task_early",
  "task_priority",
  "proof_accepted",
  "proof_first_time",
  "first_task_before_noon",
  "perfect_week",
  "streak_7",
  "streak_30",
  "streak_100",
  "comeback",
  // Aggregate awards (P2) — granted by the event that completes them.
  "perfect_month",
  "clean_month",
  "month_tasks_10",
  "month_tasks_25",
  "month_tasks_50",
  "team_day",
  // Amendment 2 sources (P2) — still evidence, never opinion.
  "planned_leave",
  "onboarding_complete",
  "work_anniversary",
  // Weekly quest bonus (P3) — the pot for whichever quest this week runs.
  "weekly_quest",
] as const;

export type RuleKey = (typeof RULE_KEYS)[number];

export interface ScoringRule {
  enabled: boolean;
  points: number;
}

export interface ScoringPolicy {
  rules: Record<RuleKey, ScoringRule>;
  /** Check-in this many minutes before shift start = early bird. */
  earlyBirdMinutes: number;
  /** Task completed this many hours before due = task_early. */
  taskEarlyHours: number;
  /** On-time days within one week that make it a perfect week. */
  perfectWeekDays: number;
  /** Consecutive on-time days that count as a comeback run. */
  comebackRunLength: number;
  /** Most task-derived points one person can earn per day (anti-farming). */
  dailyTaskCap: number;
  /** Worked days a month needs before month awards can fire. Without a
   *  working-day calendar (D-P3-03) this is what stops one worked day
   *  from being a "perfect month". */
  monthMinDays: number;
  /** Leave requested at least this many days ahead counts as planned. */
  plannedLeaveDays: number;
  /** Level names, Bronze→Diamond. Tenant-editable words; the thresholds
   *  live in code (levels.ts) like the badge catalog. */
  levelNames: [string, string, string, string, string];
}

export const DEFAULT_SCORING: ScoringPolicy = {
  rules: {
    on_time: { enabled: true, points: 10 },
    full_day: { enabled: true, points: 5 },
    early_bird: { enabled: true, points: 5 },
    task_completed: { enabled: true, points: 10 },
    task_on_time: { enabled: true, points: 5 },
    task_early: { enabled: true, points: 5 },
    task_priority: { enabled: true, points: 5 },
    proof_accepted: { enabled: true, points: 5 },
    proof_first_time: { enabled: true, points: 5 },
    first_task_before_noon: { enabled: true, points: 2 },
    perfect_week: { enabled: true, points: 25 },
    streak_7: { enabled: true, points: 20 },
    streak_30: { enabled: true, points: 100 },
    streak_100: { enabled: true, points: 500 },
    comeback: { enabled: true, points: 15 },
    perfect_month: { enabled: true, points: 100 },
    clean_month: { enabled: true, points: 50 },
    month_tasks_10: { enabled: true, points: 20 },
    month_tasks_25: { enabled: true, points: 50 },
    month_tasks_50: { enabled: true, points: 100 },
    team_day: { enabled: true, points: 5 },
    planned_leave: { enabled: true, points: 10 },
    onboarding_complete: { enabled: true, points: 25 },
    work_anniversary: { enabled: true, points: 50 },
    weekly_quest: { enabled: true, points: 30 },
  },
  earlyBirdMinutes: 15,
  taskEarlyHours: 24,
  perfectWeekDays: 6,
  comebackRunLength: 5,
  dailyTaskCap: 50,
  monthMinDays: 20,
  plannedLeaveDays: 3,
  levelNames: ["Bronze", "Silver", "Gold", "Platinum", "Diamond"],
};

/** Ledger copy per rule — written once here so screens cannot drift. */
export const RULE_LABELS: Record<RuleKey, string> = {
  on_time: "On-time check-in",
  full_day: "Full day recorded",
  early_bird: "Early bird check-in",
  task_completed: "Task completed",
  task_on_time: "Task done on time",
  task_early: "Task done well ahead",
  task_priority: "High-priority task",
  proof_accepted: "Proof accepted",
  proof_first_time: "Proof accepted first time",
  first_task_before_noon: "First task before noon",
  perfect_week: "Perfect week",
  streak_7: "7-day streak",
  streak_30: "30-day streak",
  streak_100: "100-day streak",
  comeback: "Comeback — back on track",
  perfect_month: "Perfect month",
  clean_month: "Clean month — no exceptions",
  month_tasks_10: "10 tasks this month",
  month_tasks_25: "25 tasks this month",
  month_tasks_50: "50 tasks this month",
  team_day: "Team day — whole department on time",
  planned_leave: "Leave planned ahead",
  onboarding_complete: "Onboarding complete",
  work_anniversary: "Work anniversary",
  weekly_quest: "Weekly quest completed",
};

/**
 * Untrusted input → a policy the maths can live with. Unknown rules are
 * dropped, missing ones get defaults, points are clamped to 0–10,000
 * whole points (negative points are fines, and fines are banned).
 */
export function normalizeScoring(raw: unknown): ScoringPolicy {
  const input = (raw ?? {}) as Partial<ScoringPolicy> & {
    rules?: Partial<Record<string, Partial<ScoringRule>>>;
  };

  const clampPoints = (value: unknown, fallback: number): number => {
    const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
    return Math.min(10_000, Math.max(0, n));
  };
  const clampInt = (value: unknown, fallback: number, min: number, max: number): number => {
    const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
    return Math.min(max, Math.max(min, n));
  };

  const rules = {} as Record<RuleKey, ScoringRule>;
  for (const key of RULE_KEYS) {
    const fallback = DEFAULT_SCORING.rules[key];
    const given = input.rules?.[key];
    rules[key] = {
      enabled: typeof given?.enabled === "boolean" ? given.enabled : fallback.enabled,
      points: clampPoints(given?.points, fallback.points),
    };
  }

  return {
    rules,
    earlyBirdMinutes: clampInt(input.earlyBirdMinutes, DEFAULT_SCORING.earlyBirdMinutes, 1, 240),
    taskEarlyHours: clampInt(input.taskEarlyHours, DEFAULT_SCORING.taskEarlyHours, 1, 168),
    perfectWeekDays: clampInt(input.perfectWeekDays, DEFAULT_SCORING.perfectWeekDays, 2, 7),
    comebackRunLength: clampInt(input.comebackRunLength, DEFAULT_SCORING.comebackRunLength, 2, 30),
    dailyTaskCap: clampInt(input.dailyTaskCap, DEFAULT_SCORING.dailyTaskCap, 0, 10_000),
    monthMinDays: clampInt(input.monthMinDays, DEFAULT_SCORING.monthMinDays, 1, 31),
    plannedLeaveDays: clampInt(input.plannedLeaveDays, DEFAULT_SCORING.plannedLeaveDays, 1, 60),
    levelNames: normalizeLevelNames(input.levelNames),
  };
}

/** Five non-empty names, or the defaults where the input falls short. */
function normalizeLevelNames(raw: unknown): [string, string, string, string, string] {
  const given = Array.isArray(raw) ? raw : [];
  return DEFAULT_SCORING.levelNames.map((fallback, i) => {
    const v = given[i];
    return typeof v === "string" && v.trim().length > 0 && v.trim().length <= 30
      ? v.trim()
      : fallback;
  }) as [string, string, string, string, string];
}

// ------------------------------------------------------------------ awards

/** One award the ledger will record. */
export interface Award {
  kind: RuleKey;
  points: number;
  note: string;
}

/** An enabled rule with points becomes an award; anything else is nothing. */
function award(policy: ScoringPolicy, kind: RuleKey, note?: string): Award | null {
  const rule = policy.rules[kind];
  if (!rule.enabled || rule.points <= 0) return null;
  return { kind, points: rule.points, note: note ?? RULE_LABELS[kind] };
}

// --------------------------------------------------------------- streaks

export type DayStanding =
  | "on_time" // checked in, not late
  | "leave" // approved leave — pauses a streak, never breaks it
  | "break"; // late, absent, or anything else

/**
 * Consecutive on-time days ending with (and including) the most recent
 * entry. `days` is ordered MOST RECENT FIRST. Leave days are skipped, not
 * broken on — punishing sanctioned absence teaches people not to take
 * leave (PERFORMANCE-MODULE.md §1.8).
 */
export function currentStreak(days: readonly DayStanding[]): number {
  let streak = 0;
  for (const day of days) {
    if (day === "on_time") streak += 1;
    else if (day === "leave") continue;
    else break;
  }
  return streak;
}

/** Had this person ever built a streak of `runLength` that later broke? */
export function hasBrokenRun(
  days: readonly DayStanding[],
  runLength: number,
): boolean {
  // Walk oldest→newest counting runs that were interrupted by a break.
  let run = 0;
  let sawQualifyingRunBeforeABreak = false;
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i];
    if (day === "on_time") run += 1;
    else if (day === "leave") continue;
    else {
      if (run >= runLength) sawQualifyingRunBeforeABreak = true;
      run = 0;
    }
  }
  return sawQualifyingRunBeforeABreak;
}

// ----------------------------------------------------------- check-in etc.

export interface CheckInFacts {
  /** Not late after grace, and location did not need review (or review approved). */
  onTime: boolean;
  /** Minutes before shift start the check-in happened (0 if after). */
  minutesBeforeShift: number;
  /** Only the day's first punch can score (multiple-punch rule). */
  isFirstPunchOfDay: boolean;
  /** Streak INCLUDING today, computed from attendance + approved leave. */
  streakIncludingToday: number;
  /** True when a run of `comebackRunLength` had previously been broken. */
  hadEarlierBrokenRun: boolean;
  /** On-time days in the current week, INCLUDING today. */
  onTimeDaysThisWeek: number;
}

/** Everything a finalised check-in can earn. */
export function checkInAwards(policy: ScoringPolicy, facts: CheckInFacts): Award[] {
  if (!facts.onTime || !facts.isFirstPunchOfDay) return [];

  const awards: Award[] = [];
  const push = (a: Award | null) => a && awards.push(a);

  push(award(policy, "on_time"));

  if (facts.minutesBeforeShift >= policy.earlyBirdMinutes) {
    push(
      award(
        policy,
        "early_bird",
        `Early bird — ${facts.minutesBeforeShift} min before shift`,
      ),
    );
  }

  if (facts.streakIncludingToday === 7) push(award(policy, "streak_7"));
  if (facts.streakIncludingToday === 30) push(award(policy, "streak_30"));
  if (facts.streakIncludingToday === 100) push(award(policy, "streak_100"));

  if (
    facts.streakIncludingToday === policy.comebackRunLength &&
    facts.hadEarlierBrokenRun
  ) {
    push(award(policy, "comeback"));
  }

  if (facts.onTimeDaysThisWeek === policy.perfectWeekDays) {
    push(
      award(
        policy,
        "perfect_week",
        `Perfect week — on time ${policy.perfectWeekDays} days`,
      ),
    );
  }

  return awards;
}

/** A recorded check-out completes the day. */
export function checkOutAwards(policy: ScoringPolicy): Award[] {
  const a = award(policy, "full_day");
  return a ? [a] : [];
}

// ------------------------------------------------------------------- tasks

export interface TaskFacts {
  /** Completed on/before the due date (true when no due date is set). */
  onTime: boolean;
  /** Hours between completion and the due moment; null without a due date. */
  hoursBeforeDue: number | null;
  highPriority: boolean;
  /** This is the first task the person completed today, before noon local. */
  isFirstTaskBeforeNoon: boolean;
}

/** Everything a completed task can earn (cap applied separately). */
export function taskAwards(policy: ScoringPolicy, facts: TaskFacts): Award[] {
  const awards: Award[] = [];
  const push = (a: Award | null) => a && awards.push(a);

  push(award(policy, "task_completed"));
  if (facts.onTime) push(award(policy, "task_on_time"));
  if (facts.hoursBeforeDue != null && facts.hoursBeforeDue >= policy.taskEarlyHours) {
    push(award(policy, "task_early"));
  }
  if (facts.highPriority) push(award(policy, "task_priority"));
  if (facts.isFirstTaskBeforeNoon) push(award(policy, "first_task_before_noon"));

  return awards;
}

export interface ProofFacts {
  /** No earlier "details requested" round on this task's proofs. */
  firstTimeRight: boolean;
}

/** Accepted proof earns on top of the task itself. */
export function proofAwards(policy: ScoringPolicy, facts: ProofFacts): Award[] {
  const awards: Award[] = [];
  const push = (a: Award | null) => a && awards.push(a);
  push(award(policy, "proof_accepted"));
  if (facts.firstTimeRight) push(award(policy, "proof_first_time"));
  return awards;
}

/** Which rule kinds count against the daily task cap. */
export const TASK_CAPPED_KINDS: readonly RuleKey[] = [
  "task_completed",
  "task_on_time",
  "task_early",
  "task_priority",
  "proof_accepted",
  "proof_first_time",
  "first_task_before_noon",
];

/**
 * The transparent anti-farming rule: task-derived points stop at the
 * daily cap. Awards are truncated in order; a partially fitting award is
 * NOT split — a person sees whole rules earn or not earn, never "+3 of
 * +5", which would be impossible to explain on the ledger.
 */
export function applyDailyTaskCap(
  policy: ScoringPolicy,
  taskPointsAlreadyToday: number,
  awards: readonly Award[],
): Award[] {
  if (policy.dailyTaskCap <= 0) return [...awards];
  let used = taskPointsAlreadyToday;
  const kept: Award[] = [];
  for (const a of awards) {
    if (!TASK_CAPPED_KINDS.includes(a.kind)) {
      kept.push(a);
      continue;
    }
    if (used + a.points <= policy.dailyTaskCap) {
      kept.push(a);
      used += a.points;
    }
  }
  return kept;
}

// ---------------------------------------------------------------- periods

/** "2026-W34" — the dedupe key for week-scoped aggregates. Monday-based. */
export function weekKey(date: Date): string {
  // ISO week number, computed in UTC on a date-only value.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // nearest Thursday decides the year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---------------------------------------------------- aggregates (P2)

/** "2026-08" — the dedupe key for month-scoped aggregates. */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface MonthFacts {
  /** Days in the month with a recorded check-in. */
  workedDays: number;
  /** Of those, days that were on time (not late, review not refused). */
  onTimeDays: number;
  /** Days that raised a location exception, whatever its outcome. */
  exceptionDays: number;
}

/**
 * Month awards, judged once the month is over.
 *
 * "Perfect" and "clean" both require at least `monthMinDays` worked days:
 * without a working-day calendar (D-P3-03) a month with one attendance is
 * indistinguishable from a month of leave, and awarding it would make the
 * rule a joke. The threshold is editable and stated on "How points work".
 */
export function monthAwards(policy: ScoringPolicy, facts: MonthFacts): Award[] {
  if (facts.workedDays < policy.monthMinDays) return [];
  const awards: Award[] = [];
  const push = (a: Award | null) => a && awards.push(a);
  if (facts.onTimeDays === facts.workedDays) push(award(policy, "perfect_month"));
  if (facts.exceptionDays === 0) push(award(policy, "clean_month"));
  return awards;
}

/** Which monthly task-volume milestones a count has reached. */
export function monthTaskMilestones(
  policy: ScoringPolicy,
  completedThisMonth: number,
): Award[] {
  const awards: Award[] = [];
  const push = (a: Award | null) => a && awards.push(a);
  if (completedThisMonth >= 10) push(award(policy, "month_tasks_10"));
  if (completedThisMonth >= 25) push(award(policy, "month_tasks_25"));
  if (completedThisMonth >= 50) push(award(policy, "month_tasks_50"));
  return awards;
}

/**
 * Team day: the whole department on time on the same day. Needs at least
 * two people — a department of one is just a person having a morning.
 */
export function teamDayAward(
  policy: ScoringPolicy,
  facts: { departmentSize: number; onTimeToday: number },
): Award | null {
  if (facts.departmentSize < 2) return null;
  if (facts.onTimeToday < facts.departmentSize) return null;
  return award(policy, "team_day");
}

// ------------------------------------------- Amendment 2 sources (P2)

/** Leave approved after being requested well ahead. */
export function plannedLeaveAward(
  policy: ScoringPolicy,
  facts: { requestedDaysAhead: number },
): Award | null {
  if (facts.requestedDaysAhead < policy.plannedLeaveDays) return null;
  return award(
    policy,
    "planned_leave",
    `Leave planned ${facts.requestedDaysAhead} days ahead`,
  );
}

/** Documents verified and profile filled in — once, ever. */
export function onboardingAward(
  policy: ScoringPolicy,
  facts: { hasVerifiedDocument: boolean; profileComplete: boolean },
): Award | null {
  if (!facts.hasVerifiedDocument || !facts.profileComplete) return null;
  return award(policy, "onboarding_complete");
}

/**
 * Completed years of service as of a given day. The anniversary itself is
 * judged at date granularity in the caller's timezone-resolved dates.
 */
export function completedServiceYears(joinedOn: Date, today: Date): number {
  let years = today.getUTCFullYear() - joinedOn.getUTCFullYear();
  const anniversaryPassed =
    today.getUTCMonth() > joinedOn.getUTCMonth() ||
    (today.getUTCMonth() === joinedOn.getUTCMonth() &&
      today.getUTCDate() >= joinedOn.getUTCDate());
  if (!anniversaryPassed) years -= 1;
  return Math.max(0, years);
}

export function anniversaryAward(
  policy: ScoringPolicy,
  facts: { completedYears: number },
): Award | null {
  if (facts.completedYears < 1) return null;
  const a = award(policy, "work_anniversary");
  if (!a) return null;
  return {
    ...a,
    note: `Work anniversary — ${facts.completedYears} year${facts.completedYears === 1 ? "" : "s"} completed`,
  };
}
