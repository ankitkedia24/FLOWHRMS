import "server-only";

import { getDb } from "@/lib/db";
import { getPolicy, getPolicyVersion } from "@/lib/policies";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { evaluateAccess } from "@/lib/authz/flags";
import type { AppSession } from "@/lib/auth/types";
import {
  anniversaryAward,
  applyDailyTaskCap,
  checkInAwards,
  checkOutAwards,
  completedServiceYears,
  currentStreak,
  hasBrokenRun,
  monthAwards,
  monthKey,
  monthTaskMilestones,
  normalizeScoring,
  onboardingAward,
  plannedLeaveAward,
  proofAwards,
  taskAwards,
  teamDayAward,
  weekKey,
  TASK_CAPPED_KINDS,
  type Award,
  type DayStanding,
  type ScoringPolicy,
} from "./scoring";
import { BADGES, detectBadges, type BadgeFacts } from "./badges";
import {
  mostImproved,
  previousSeasonBounds,
  questForWeek,
  questProgress,
  type QuestProgress,
} from "./seasons";
import { levelBadgeKey, levelFor } from "./levels";
import { notify } from "@/lib/notifications";
import { minutesInTimezone, workDateInTimezone } from "@/lib/attendance/policy";

/**
 * Awarding — the seam between recorded evidence and the points ledger.
 *
 * Called from inside the existing server actions at the moment an event
 * becomes final (the notifications pattern; no job runner). Every entry
 * point here is deliberately fail-quiet: a scoring hiccup must never make
 * a check-in or a task review fail — the evidence is the product, the
 * points are the motivation on top.
 *
 * Nothing is written unless the module is enabled AND a scoring
 * definition has been published (PERFORMANCE-MODULE.md §1.2: points only
 * count after publish). Duplicates are impossible at the database level
 * — the unique (tenant, member, kind, dedupeKey) index — so retries and
 * double-submissions cannot double-pay.
 */

interface ScoringState {
  policy: ScoringPolicy;
  version: number;
}

/** Null when the module is off or no definition has been published. */
async function scoringStateFor(session: AppSession): Promise<ScoringState | null> {
  const entitlements = await loadEntitlements(session.tenant.id, session.user.id);
  const moduleOn = evaluateAccess({
    session,
    entitlements,
    module: "PERFORMANCE",
  }).allowed;
  if (!moduleOn) return null;

  const raw = await getPolicy<unknown>(session.tenant.id, "performance");
  if (raw == null) return null; // not published yet — points do not count

  const version = await getPolicyVersion(session.tenant.id, "performance");
  return { policy: normalizeScoring(raw), version };
}

async function writeAwards(input: {
  session: AppSession;
  membershipId: string;
  workDate: Date;
  awards: readonly Award[];
  sourceType: string;
  sourceId: string | null;
  dedupeKeyFor: (award: Award) => string;
  version: number;
}): Promise<void> {
  if (input.awards.length === 0) return;
  await getDb().performanceEvent.createMany({
    data: input.awards.map((a) => ({
      tenantId: input.session.tenant.id,
      membershipId: input.membershipId,
      workDate: input.workDate,
      kind: a.kind,
      points: a.points,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      dedupeKey: input.dedupeKeyFor(a),
      policyVersion: input.version,
      note: a.note,
    })),
    // The unique index is the idempotency rule; a retried queue action or
    // a double-tap simply writes nothing the second time.
    skipDuplicates: true,
  });
}

/**
 * Day standings for streak maths, most recent day first.
 *
 * The transparent streak rule (shown verbatim on "How points work"):
 * every worked day you arrived on time extends the streak; arriving late
 * breaks it; days you didn't work — leave, weekly off — don't break it
 * and don't extend it. Without a working-day calendar (explicitly out of
 * V1, D-P3-03) "absent" and "day off" are indistinguishable, so the rule
 * is kind by design rather than wrong half the time.
 */
async function dayStandings(
  session: AppSession,
  membershipId: string,
  before: Date,
  days = 130,
): Promise<DayStanding[]> {
  const since = new Date(before.getTime() - days * 86_400_000);
  const records = await getDb().attendanceRecord.findMany({
    where: {
      tenantId: session.tenant.id,
      membershipId,
      workDate: { gte: since, lt: before },
      checkInAt: { not: null },
    },
    select: { workDate: true, lateMinutes: true, reviewStatus: true, exemptionStatus: true },
    orderBy: { workDate: "desc" },
  });

  const byDay = new Map<string, DayStanding>();
  for (const r of records) {
    const key = r.workDate.toISOString().slice(0, 10);
    const late = r.lateMinutes > 0 && r.exemptionStatus !== "EXEMPTED";
    const rejected = r.reviewStatus === "REJECTED";
    byDay.set(key, late || rejected ? "break" : "on_time");
  }

  // Walk day by day; unrecorded days read as "leave" (skipped) per the
  // rule above.
  const standings: DayStanding[] = [];
  for (let i = 1; i <= days; i++) {
    const day = new Date(before.getTime() - i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    standings.push(byDay.get(day) ?? "leave");
  }
  return standings;
}

/** Sum of today's already-awarded task-capped points. */
async function taskPointsToday(
  session: AppSession,
  membershipId: string,
  workDate: Date,
): Promise<number> {
  const rows = await getDb().performanceEvent.findMany({
    where: {
      tenantId: session.tenant.id,
      membershipId,
      workDate,
      kind: { in: [...TASK_CAPPED_KINDS] },
    },
    select: { points: true },
  });
  return rows.reduce((sum, r) => sum + r.points, 0);
}

// ------------------------------------------------------------- entry points

/**
 * A check-in became final: on time at the time (INSIDE / NOT_REQUIRED),
 * or an outside/unconfirmed one that review just APPROVED.
 */
export async function awardForCheckIn(input: {
  session: AppSession;
  membershipId: string;
  recordId: string;
  workDate: Date;
  effectiveAt: Date;
  lateMinutes: number;
  shiftStartMinutes: number;
  isFirstPunchOfDay: boolean;
  /** True on the retro path (review approval) — milestones don't re-fire. */
  retro?: boolean;
}): Promise<void> {
  try {
    const state = await scoringStateFor(input.session);
    if (!state) return;
    if (input.lateMinutes > 0) return; // late earns nothing, costs nothing

    const tz = input.session.tenant.timezone;
    const minuteOfDay = minutesInTimezone(input.effectiveAt, tz);
    const minutesBeforeShift = Math.max(0, input.shiftStartMinutes - minuteOfDay);

    let streakIncludingToday = 1;
    let hadEarlierBrokenRun = false;
    let onTimeDaysThisWeek = 1;

    // Streak and week maths only on the live path: a retro approval days
    // later cannot honestly reconstruct "the streak as it stood then",
    // and a milestone that fires on the wrong day reads as a lie on the
    // ledger. The base points are what review approval restores.
    if (!input.retro) {
      const standings = await dayStandings(
        input.session,
        input.membershipId,
        input.workDate,
      );
      streakIncludingToday = 1 + currentStreak(standings);
      hadEarlierBrokenRun = hasBrokenRun(standings, state.policy.comebackRunLength);

      const thisWeek = weekKey(input.workDate);
      let count = 1;
      for (let i = 0; i < standings.length; i++) {
        const day = new Date(input.workDate.getTime() - (i + 1) * 86_400_000);
        if (weekKey(day) !== thisWeek) break;
        if (standings[i] === "on_time") count += 1;
      }
      onTimeDaysThisWeek = count;
    }

    const awards = checkInAwards(state.policy, {
      onTime: true,
      minutesBeforeShift,
      isFirstPunchOfDay: input.isFirstPunchOfDay,
      streakIncludingToday,
      hadEarlierBrokenRun,
      onTimeDaysThisWeek,
    });

    const dayKey = input.workDate.toISOString().slice(0, 10);
    await writeAwards({
      session: input.session,
      membershipId: input.membershipId,
      workDate: input.workDate,
      awards: applyBoost(awards, await boostMultiplier(input.session, input.workDate)),
      sourceType: "attendance_record",
      sourceId: input.recordId,
      dedupeKeyFor: (a) =>
        a.kind === "perfect_week"
          ? weekKey(input.workDate) // one per week
          : a.kind === "on_time" || a.kind === "early_bird"
            ? input.recordId // one per record
            : dayKey, // milestones/comeback: one per day they landed
      version: state.version,
    });
    await afterAwards(input.session, input.membershipId, state, input.workDate, {
      checkIn: true,
      streak: streakIncludingToday,
    });
  } catch (error) {
    console.error("[performance] check-in award failed:", error);
  }
}

/** A check-out completed the day. */
export async function awardForCheckOut(input: {
  session: AppSession;
  membershipId: string;
  recordId: string;
  workDate: Date;
}): Promise<void> {
  try {
    const state = await scoringStateFor(input.session);
    if (!state) return;
    await writeAwards({
      session: input.session,
      membershipId: input.membershipId,
      workDate: input.workDate,
      awards: applyBoost(
        checkOutAwards(state.policy),
        await boostMultiplier(input.session, input.workDate),
      ),
      sourceType: "attendance_record",
      sourceId: input.recordId,
      dedupeKeyFor: () => input.recordId,
      version: state.version,
    });
    await afterAwards(input.session, input.membershipId, state, input.workDate);
  } catch (error) {
    console.error("[performance] check-out award failed:", error);
  }
}

/**
 * A task reached COMPLETED — directly, or via an approved proof. The
 * session may belong to the REVIEWER; points always go to the assignee.
 */
export async function awardForTaskCompletion(input: {
  session: AppSession;
  assigneeMembershipId: string;
  taskId: string;
  completedAt: Date;
  dueDate: Date | null;
  dueMinutes: number | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
  /** Facts about proof, when the completion came through review. */
  proof?: { firstTimeRight: boolean };
}): Promise<void> {
  try {
    const state = await scoringStateFor(input.session);
    if (!state) return;

    const tz = input.session.tenant.timezone;
    const workDate = workDateInTimezone(input.completedAt, tz);

    // Punctuality at DATE granularity, in the tenant's timezone — the same
    // precision the task screens show ("Due 20 Aug"). Composing an exact
    // due instant from a date column plus minutes would silently be off by
    // the timezone offset, and a scoring rule that is 5½ hours generous is
    // not a rule anyone can explain.
    let hoursBeforeDue: number | null = null;
    let onTime = true;
    if (input.dueDate) {
      const daysBeforeDue = Math.round(
        (input.dueDate.getTime() - workDate.getTime()) / 86_400_000,
      );
      onTime = daysBeforeDue >= 0;
      hoursBeforeDue = daysBeforeDue > 0 ? daysBeforeDue * 24 : null;
    }

    // First completed task of the day, before noon local time?
    const noonLocal = minutesInTimezone(input.completedAt, tz) < 12 * 60;
    const earlierToday = noonLocal
      ? await getDb().performanceEvent.count({
          where: {
            tenantId: input.session.tenant.id,
            membershipId: input.assigneeMembershipId,
            workDate,
            kind: "task_completed",
          },
        })
      : 1;

    const base = taskAwards(state.policy, {
      onTime,
      hoursBeforeDue,
      highPriority: input.priority === "HIGH",
      isFirstTaskBeforeNoon: noonLocal && earlierToday === 0,
    });
    const withProof = input.proof
      ? [...base, ...proofAwards(state.policy, input.proof)]
      : base;

    const alreadyToday = await taskPointsToday(
      input.session,
      input.assigneeMembershipId,
      workDate,
    );
    const capped = applyDailyTaskCap(state.policy, alreadyToday, withProof);

    await writeAwards({
      session: input.session,
      membershipId: input.assigneeMembershipId,
      workDate,
      awards: applyBoost(capped, await boostMultiplier(input.session, workDate)),
      sourceType: "task",
      sourceId: input.taskId,
      dedupeKeyFor: () => input.taskId, // every kind at most once per task
      version: state.version,
    });

    // Monthly task-volume milestones, keyed to the month so each pays once.
    const monthStart = new Date(Date.UTC(workDate.getUTCFullYear(), workDate.getUTCMonth(), 1));
    const completedThisMonth = await getDb().performanceEvent.count({
      where: {
        tenantId: input.session.tenant.id,
        membershipId: input.assigneeMembershipId,
        kind: "task_completed",
        workDate: { gte: monthStart },
      },
    });
    await writeAwards({
      session: input.session,
      membershipId: input.assigneeMembershipId,
      workDate,
      awards: monthTaskMilestones(state.policy, completedThisMonth),
      sourceType: "month",
      sourceId: null,
      dedupeKeyFor: () => monthKey(workDate),
      version: state.version,
    });

    await afterAwards(input.session, input.assigneeMembershipId, state, workDate);
  } catch (error) {
    console.error("[performance] task award failed:", error);
  }
}

// --------------------------------------------- aggregates + badges (P2)

/**
 * Double-points boost in force on a date, if any (P3 mechanics, applied
 * from the moment the table exists so a declared window never misses a
 * day). Returns the multiplier, 1 when no window covers the date.
 */
async function boostMultiplier(session: AppSession, workDate: Date): Promise<number> {
  const boost = await getDb().performanceBoost.findFirst({
    where: {
      tenantId: session.tenant.id,
      startDate: { lte: workDate },
      endDate: { gte: workDate },
    },
    orderBy: { multiplier: "desc" },
  });
  return boost ? Math.max(1, boost.multiplier) : 1;
}

/** Multiply awards for a boost window, saying so on the ledger line. */
function applyBoost(awards: readonly Award[], multiplier: number): Award[] {
  if (multiplier <= 1) return [...awards];
  return awards.map((a) => ({
    ...a,
    points: a.points * multiplier,
    note: `${a.note} (x${multiplier} day)`,
  }));
}

/**
 * Month awards for the PREVIOUS month, judged by the first award event
 * that arrives after it closed ("awarded by the event that completes
 * them" — nothing here runs on a clock). The dedupe key is the month, so
 * however many events race to judge it, it pays once.
 */
async function evaluatePreviousMonth(
  session: AppSession,
  membershipId: string,
  state: ScoringState,
  today: Date,
): Promise<void> {
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  const key = monthKey(monthStart);

  const already = await getDb().performanceEvent.findFirst({
    where: {
      tenantId: session.tenant.id,
      membershipId,
      kind: { in: ["perfect_month", "clean_month"] },
      dedupeKey: key,
    },
    select: { id: true },
  });
  if (already) return;

  const records = await getDb().attendanceRecord.findMany({
    where: {
      tenantId: session.tenant.id,
      membershipId,
      workDate: { gte: monthStart, lte: monthEnd },
      checkInAt: { not: null },
    },
    select: { lateMinutes: true, reviewStatus: true, exemptionStatus: true },
  });
  if (records.length === 0) return;

  const onTime = records.filter(
    (r) =>
      !(r.lateMinutes > 0 && r.exemptionStatus !== "EXEMPTED") &&
      r.reviewStatus !== "REJECTED",
  ).length;
  const exceptions = records.filter((r) => r.reviewStatus !== "NONE").length;

  const awards = monthAwards(state.policy, {
    workedDays: records.length,
    onTimeDays: onTime,
    exceptionDays: exceptions,
  });

  await writeAwards({
    session,
    membershipId,
    workDate: monthEnd,
    awards,
    sourceType: "month",
    sourceId: null,
    dedupeKeyFor: () => key,
    version: state.version,
  });
}

/**
 * Work anniversary, judged by the first award event on or after the date.
 * One award per completed year, keyed on the year count — a missed year
 * (nobody checked in near the date) is still collectable later, but the
 * same year can never pay twice.
 */
async function evaluateAnniversary(
  session: AppSession,
  membershipId: string,
  state: ScoringState,
  today: Date,
): Promise<void> {
  const membership = await getDb().tenantMembership.findUnique({
    where: { id: membershipId },
    select: { joinedOn: true },
  });
  if (!membership?.joinedOn) return;

  const years = completedServiceYears(membership.joinedOn, today);
  const award = anniversaryAward(state.policy, { completedYears: years });
  if (!award) return;

  await writeAwards({
    session,
    membershipId,
    workDate: today,
    awards: [award],
    sourceType: "anniversary",
    sourceId: null,
    dedupeKeyFor: () => `anniv-${years}`,
    version: state.version,
  });
}

/**
 * Team day: this check-in may have completed the department. Everyone in
 * it gets the award — including the members whose check-ins came earlier,
 * which is the point: the last arrival closes the loop for the whole team.
 */
async function evaluateTeamDay(
  session: AppSession,
  membershipId: string,
  state: ScoringState,
  workDate: Date,
): Promise<void> {
  if (!state.policy.rules.team_day.enabled) return;

  const me = await getDb().tenantMembership.findUnique({
    where: { id: membershipId },
    select: { departmentId: true },
  });
  if (!me?.departmentId) return;

  const members = await getDb().tenantMembership.findMany({
    where: {
      tenantId: session.tenant.id,
      departmentId: me.departmentId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const onTimeRecords = await getDb().attendanceRecord.findMany({
    where: {
      tenantId: session.tenant.id,
      membershipId: { in: members.map((m) => m.id) },
      workDate,
      checkInAt: { not: null },
      lateMinutes: 0,
      reviewStatus: { in: ["NONE", "APPROVED"] },
    },
    select: { membershipId: true },
  });
  const onTimeSet = new Set(onTimeRecords.map((r) => r.membershipId));

  const award = teamDayAward(state.policy, {
    departmentSize: members.length,
    onTimeToday: onTimeSet.size,
  });
  if (!award) return;

  const dayKey = workDate.toISOString().slice(0, 10);
  for (const member of members) {
    await writeAwards({
      session,
      membershipId: member.id,
      workDate,
      awards: [award],
      sourceType: "team_day",
      sourceId: null,
      dedupeKeyFor: () => dayKey,
      version: state.version,
    });
  }
}

/**
 * After any award lands: re-derive badges and level from the ledger, store
 * what is newly earned, and ring the bell once for each. The unique index
 * on employee_badges makes re-detection idempotent, so this can run after
 * every event without ever duplicating a moment.
 */
async function evaluateAchievements(
  session: AppSession,
  membershipId: string,
  state: ScoringState,
  currentStreakDays: number,
): Promise<void> {
  const db = getDb();

  const [total, byKind] = await Promise.all([
    db.performanceEvent.aggregate({
      where: { tenantId: session.tenant.id, membershipId },
      _sum: { points: true },
    }),
    db.performanceEvent.groupBy({
      by: ["kind"],
      where: { tenantId: session.tenant.id, membershipId },
      _count: true,
    }),
  ]);
  const count = (kind: string) => byKind.find((k) => k.kind === kind)?._count ?? 0;

  const facts: BadgeFacts = {
    totalPoints: total._sum.points ?? 0,
    currentStreak: currentStreakDays,
    tasksCompleted: count("task_completed"),
    earlyBirdCount: count("early_bird"),
    proofAcceptedCount: count("proof_accepted"),
    perfectMonths: count("perfect_month"),
  };

  const level = levelFor(facts.totalPoints, state.policy);
  const wanted = detectBadges(facts);
  // Level celebrations ride the same store; index 0 is the floor everyone
  // starts on, so only 1+ are moments.
  for (let i = 1; i <= level.index; i++) wanted.push(levelBadgeKey(i));
  if (wanted.length === 0) return;

  const existing = await db.employeeBadge.findMany({
    where: { tenantId: session.tenant.id, membershipId, badgeKey: { in: wanted } },
    select: { badgeKey: true },
  });
  const have = new Set(existing.map((b) => b.badgeKey));
  const fresh = wanted.filter((k) => !have.has(k));
  if (fresh.length === 0) return;

  await db.employeeBadge.createMany({
    data: fresh.map((badgeKey) => ({
      tenantId: session.tenant.id,
      membershipId,
      badgeKey,
    })),
    skipDuplicates: true,
  });

  // The bell — one notice per moment, to the person who earned it.
  const membership = await db.tenantMembership.findUnique({
    where: { id: membershipId },
    select: { userId: true },
  });
  if (!membership) return;
  for (const key of fresh) {
    const badge = BADGES.find((b) => b.key === key);
    const title = badge
      ? `Badge earned: ${badge.name}`
      : `Level up: ${state.policy.levelNames[Number(key.split("_")[1])] ?? "next level"}`;
    await notify.performanceMoment(session, membership.userId, title);
  }
}

/**
 * The follow-on pass every entry point calls after its own awards: month
 * close-outs, anniversaries, team day, then badges and level. Fail-quiet
 * as a whole — none of this may break the action that triggered it.
 */
async function afterAwards(
  session: AppSession,
  membershipId: string,
  state: ScoringState,
  workDate: Date,
  options: { checkIn?: boolean; streak?: number } = {},
): Promise<void> {
  try {
    const monthAlready = await getDb().performanceEvent.findFirst({
      where: {
        tenantId: session.tenant.id,
        membershipId,
        kind: { in: ["perfect_month", "clean_month"] },
        dedupeKey: monthKey(
          new Date(Date.UTC(workDate.getUTCFullYear(), workDate.getUTCMonth() - 1, 1)),
        ),
      },
      select: { id: true },
    });
    await evaluatePreviousMonth(session, membershipId, state, workDate);
    // Season close-out rides the same once-per-member-per-month trigger.
    if (!monthAlready) {
      await evaluateSeasonBadge(session, state, workDate);
    }
    await evaluateAnniversary(session, membershipId, state, workDate);
    if (options.checkIn) {
      await evaluateTeamDay(session, membershipId, state, workDate);
    }
    await evaluateQuest(session, membershipId, state, workDate);
    await evaluateAchievements(session, membershipId, state, options.streak ?? 0);
  } catch (error) {
    console.error("[performance] aggregate pass failed:", error);
  }
}

// ------------------------------------------ Amendment 2 entry points (P2)

/** Leave was APPROVED — was it planned well ahead? */
export async function awardForLeaveApproval(input: {
  session: AppSession;
  membershipId: string;
  leaveRequestId: string;
  requestedAt: Date;
  startDate: Date;
}): Promise<void> {
  try {
    const state = await scoringStateFor(input.session);
    if (!state) return;

    const daysAhead = Math.floor(
      (input.startDate.getTime() - input.requestedAt.getTime()) / 86_400_000,
    );
    const award = plannedLeaveAward(state.policy, { requestedDaysAhead: daysAhead });
    if (!award) return;

    const workDate = workDateInTimezone(new Date(), input.session.tenant.timezone);
    await writeAwards({
      session: input.session,
      membershipId: input.membershipId,
      workDate,
      awards: applyBoost([award], await boostMultiplier(input.session, workDate)),
      sourceType: "leave_request",
      sourceId: input.leaveRequestId,
      dedupeKeyFor: () => input.leaveRequestId,
      version: state.version,
    });
    await afterAwards(input.session, input.membershipId, state, workDate);
  } catch (error) {
    console.error("[performance] leave award failed:", error);
  }
}

/**
 * A document was VERIFIED — did that complete onboarding? One-time by
 * dedupe key; profile completeness is judged now, on the completing event.
 */
export async function awardForOnboarding(input: {
  session: AppSession;
  membershipId: string;
}): Promise<void> {
  try {
    const state = await scoringStateFor(input.session);
    if (!state) return;

    const db = getDb();
    const [membership, verifiedDocs] = await Promise.all([
      db.tenantMembership.findUnique({
        where: { id: input.membershipId },
        select: { designation: true, departmentId: true, branchId: true, shiftId: true },
      }),
      db.employeeDocument.count({
        where: {
          tenantId: input.session.tenant.id,
          membershipId: input.membershipId,
          status: "VERIFIED",
        },
      }),
    ]);
    if (!membership) return;

    const award = onboardingAward(state.policy, {
      hasVerifiedDocument: verifiedDocs > 0,
      profileComplete: Boolean(
        membership.designation &&
          membership.departmentId &&
          membership.branchId &&
          membership.shiftId,
      ),
    });
    if (!award) return;

    const workDate = workDateInTimezone(new Date(), input.session.tenant.timezone);
    await writeAwards({
      session: input.session,
      membershipId: input.membershipId,
      workDate,
      awards: [award],
      sourceType: "onboarding",
      sourceId: null,
      dedupeKeyFor: () => "onboarding", // once, ever
      version: state.version,
    });
    await afterAwards(input.session, input.membershipId, state, workDate);
  } catch (error) {
    console.error("[performance] onboarding award failed:", error);
  }
}

// ------------------------------------------------------- P3 mechanics

/**
 * This week's quest may have just been completed by this event. The bonus
 * pays once per quest per week (dedupe on quest + week); the pot is the
 * weekly_quest rule, switchable like everything else.
 */
async function evaluateQuest(
  session: AppSession,
  membershipId: string,
  state: ScoringState,
  workDate: Date,
): Promise<void> {
  const rule = state.policy.rules.weekly_quest;
  if (!rule.enabled || rule.points <= 0) return;

  const thisWeek = weekKey(workDate);
  const quest = questForWeek(thisWeek);

  // Week bounds: Monday of workDate's week, through workDate.
  const dayOfWeek = (workDate.getUTCDay() + 6) % 7;
  const monday = new Date(workDate.getTime() - dayOfWeek * 86_400_000);

  const db = getDb();
  let progress: QuestProgress;
  if (quest.metric === "on_time_days") {
    const onTime = await db.attendanceRecord.count({
      where: {
        tenantId: session.tenant.id,
        membershipId,
        workDate: { gte: monday, lte: workDate },
        checkInAt: { not: null },
        lateMinutes: 0,
        reviewStatus: { in: ["NONE", "APPROVED"] },
      },
    });
    progress = questProgress(quest, { onTimeDaysThisWeek: onTime, tasksCompletedThisWeek: 0 });
  } else {
    const tasks = await db.performanceEvent.count({
      where: {
        tenantId: session.tenant.id,
        membershipId,
        kind: "task_completed",
        workDate: { gte: monday, lte: workDate },
      },
    });
    progress = questProgress(quest, { onTimeDaysThisWeek: 0, tasksCompletedThisWeek: tasks });
  }
  if (!progress.done) return;

  await writeAwards({
    session,
    membershipId,
    workDate,
    awards: [
      {
        kind: "weekly_quest",
        points: rule.points,
        note: `Quest complete: ${quest.title}`,
      },
    ],
    sourceType: "quest",
    sourceId: null,
    dedupeKeyFor: () => `${quest.key}:${thisWeek}`,
    version: state.version,
  });
}

/**
 * The season badge: most improved of the season that just closed
 * (PERFORMANCE-MODULE.md §B — the one badge the wall shows locked until
 * seasons exist to judge it). Runs on the once-per-member month pass; the
 * badge store's unique index keeps it once-ever per person.
 */
async function evaluateSeasonBadge(
  session: AppSession,
  state: ScoringState,
  today: Date,
): Promise<void> {
  const db = getDb();
  const closed = previousSeasonBounds(today);
  const before = previousSeasonBounds(closed.start);

  const sum = async (start: Date, end: Date) =>
    db.performanceEvent.groupBy({
      by: ["membershipId"],
      where: {
        tenantId: session.tenant.id,
        workDate: { gte: start, lte: end },
        // The quest/aggregate kinds ride along; a season is simply the sum.
      },
      _sum: { points: true },
    });

  const [closedRows, beforeRows] = await Promise.all([
    sum(closed.start, closed.end),
    sum(before.start, before.end),
  ]);
  if (closedRows.length === 0 || beforeRows.length === 0) return;

  const current = closedRows.map((r) => ({
    membershipId: r.membershipId,
    name: "",
    departmentName: null,
    points: r._sum.points ?? 0,
  }));
  const previous = beforeRows.map((r) => ({
    membershipId: r.membershipId,
    name: "",
    departmentName: null,
    points: r._sum.points ?? 0,
  }));

  const winner = mostImproved(current, previous);
  if (!winner) return;

  const created = await db.employeeBadge.createMany({
    data: [
      {
        tenantId: session.tenant.id,
        membershipId: winner.membershipId,
        badgeKey: "comeback_season",
      },
    ],
    skipDuplicates: true,
  });
  if (created.count === 0) return;

  const member = await db.tenantMembership.findUnique({
    where: { id: winner.membershipId },
    select: { userId: true },
  });
  if (member) {
    await notify.performanceMoment(
      session,
      member.userId,
      "Badge earned: The Comeback",
      `Biggest climb of the season — ${winner.previousPoints} to ${winner.currentPoints} points.`,
    );
  }
}
