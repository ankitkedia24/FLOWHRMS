import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCORING,
  RULE_KEYS,
  applyDailyTaskCap,
  checkInAwards,
  checkOutAwards,
  currentStreak,
  hasBrokenRun,
  normalizeScoring,
  proofAwards,
  taskAwards,
  weekKey,
  type CheckInFacts,
  type DayStanding,
  type ScoringPolicy,
} from "@/lib/performance/scoring";

/**
 * The scoring engine's promises, asserted: evidence only, every rule
 * individually switchable, never a fine, transparent caps, and streaks
 * that respect approved leave.
 */

const baseFacts: CheckInFacts = {
  onTime: true,
  minutesBeforeShift: 0,
  isFirstPunchOfDay: true,
  streakIncludingToday: 1,
  hadEarlierBrokenRun: false,
  onTimeDaysThisWeek: 1,
};

function policyWith(overrides: Partial<ScoringPolicy["rules"]>): ScoringPolicy {
  return normalizeScoring({
    ...DEFAULT_SCORING,
    rules: { ...DEFAULT_SCORING.rules, ...overrides },
  });
}

describe("rewards, never fines", () => {
  it("no rule can produce negative points, even from hostile input", () => {
    const policy = normalizeScoring({
      rules: Object.fromEntries(RULE_KEYS.map((k) => [k, { enabled: true, points: -50 }])),
    });
    for (const key of RULE_KEYS) {
      expect(policy.rules[key].points).toBeGreaterThanOrEqual(0);
    }
  });

  it("a bad day simply earns nothing", () => {
    expect(checkInAwards(DEFAULT_SCORING, { ...baseFacts, onTime: false })).toEqual([]);
  });
});

describe("every rule is its own switch (owner requirement)", () => {
  it("a disabled rule earns nothing while its neighbours still pay", () => {
    const policy = policyWith({ on_time: { enabled: false, points: 10 } });
    const awards = checkInAwards(policy, {
      ...baseFacts,
      minutesBeforeShift: 20,
    });
    expect(awards.map((a) => a.kind)).toEqual(["early_bird"]);
  });

  it("a rule set to zero points is silent, not a zero-line on the ledger", () => {
    const policy = policyWith({ on_time: { enabled: true, points: 0 } });
    expect(checkInAwards(policy, baseFacts)).toEqual([]);
  });

  it("thresholds are editable and respected", () => {
    const policy = normalizeScoring({ ...DEFAULT_SCORING, earlyBirdMinutes: 30 });
    expect(
      checkInAwards(policy, { ...baseFacts, minutesBeforeShift: 20 }).map((a) => a.kind),
    ).toEqual(["on_time"]);
    expect(
      checkInAwards(policy, { ...baseFacts, minutesBeforeShift: 30 }).map((a) => a.kind),
    ).toEqual(["on_time", "early_bird"]);
  });

  it("normalizes rubbish back to defaults", () => {
    const policy = normalizeScoring({
      rules: { on_time: { enabled: "yes", points: "many" } },
      earlyBirdMinutes: -5,
      dailyTaskCap: 99_999_999,
    });
    expect(policy.rules.on_time).toEqual(DEFAULT_SCORING.rules.on_time);
    expect(policy.earlyBirdMinutes).toBe(1);
    expect(policy.dailyTaskCap).toBe(10_000);
  });
});

describe("check-in awards", () => {
  it("pays the base rule for a plain on-time day", () => {
    const awards = checkInAwards(DEFAULT_SCORING, baseFacts);
    expect(awards).toEqual([{ kind: "on_time", points: 10, note: "On-time check-in" }]);
  });

  it("only the day's first punch can score", () => {
    expect(
      checkInAwards(DEFAULT_SCORING, { ...baseFacts, isFirstPunchOfDay: false }),
    ).toEqual([]);
  });

  it("pays streak milestones exactly at 7, 30 and 100", () => {
    for (const [streak, kind, points] of [
      [7, "streak_7", 20],
      [30, "streak_30", 100],
      [100, "streak_100", 500],
    ] as const) {
      const awards = checkInAwards(DEFAULT_SCORING, {
        ...baseFacts,
        streakIncludingToday: streak,
      });
      expect(awards.map((a) => a.kind)).toContain(kind);
      expect(awards.find((a) => a.kind === kind)?.points).toBe(points);
      // ...and not at the day after, or milestones would pay daily.
      expect(
        checkInAwards(DEFAULT_SCORING, {
          ...baseFacts,
          streakIncludingToday: streak + 1,
        }).map((a) => a.kind),
      ).not.toContain(kind);
    }
  });

  it("pays the comeback only when a run had previously broken", () => {
    const atRun = { ...baseFacts, streakIncludingToday: 5 };
    expect(
      checkInAwards(DEFAULT_SCORING, { ...atRun, hadEarlierBrokenRun: true }).map((a) => a.kind),
    ).toContain("comeback");
    expect(
      checkInAwards(DEFAULT_SCORING, { ...atRun, hadEarlierBrokenRun: false }).map((a) => a.kind),
    ).not.toContain("comeback");
  });

  it("pays the perfect week exactly when the threshold day lands", () => {
    expect(
      checkInAwards(DEFAULT_SCORING, { ...baseFacts, onTimeDaysThisWeek: 6 }).map((a) => a.kind),
    ).toContain("perfect_week");
    expect(
      checkInAwards(DEFAULT_SCORING, { ...baseFacts, onTimeDaysThisWeek: 5 }).map((a) => a.kind),
    ).not.toContain("perfect_week");
  });

  it("check-out completes the day", () => {
    expect(checkOutAwards(DEFAULT_SCORING)).toEqual([
      { kind: "full_day", points: 5, note: "Full day recorded" },
    ]);
  });
});

describe("streaks respect approved leave", () => {
  const days = (s: string): DayStanding[] =>
    // "o" on time, "l" leave, "x" break — most recent first.
    [...s].map((c) => (c === "o" ? "on_time" : c === "l" ? "leave" : "break"));

  it("counts consecutive on-time days", () => {
    expect(currentStreak(days("ooo"))).toBe(3);
    expect(currentStreak(days("ooxo"))).toBe(2);
    expect(currentStreak(days("x"))).toBe(0);
  });

  it("leave pauses a streak, never breaks it", () => {
    expect(currentStreak(days("oolloo"))).toBe(4);
    expect(currentStreak(days("looo"))).toBe(3);
  });

  it("detects a previously broken qualifying run", () => {
    // oldest→newest reading right-to-left: 5 on-time, a break, then today.
    expect(hasBrokenRun(days("oxooooo"), 5)).toBe(true);
    expect(hasBrokenRun(days("oxoo"), 5)).toBe(false);
    // leave inside the old run does not stop it qualifying
    expect(hasBrokenRun(days("oxoolooo"), 5)).toBe(true);
  });
});

describe("task and proof awards", () => {
  it("stacks completion, punctuality, priority and momentum", () => {
    const awards = taskAwards(DEFAULT_SCORING, {
      onTime: true,
      hoursBeforeDue: 30,
      highPriority: true,
      isFirstTaskBeforeNoon: true,
    });
    expect(awards.map((a) => a.kind)).toEqual([
      "task_completed",
      "task_on_time",
      "task_early",
      "task_priority",
      "first_task_before_noon",
    ]);
    expect(awards.reduce((s, a) => s + a.points, 0)).toBe(27);
  });

  it("a task without a due date is complete, not late and not early", () => {
    const awards = taskAwards(DEFAULT_SCORING, {
      onTime: true,
      hoursBeforeDue: null,
      highPriority: false,
      isFirstTaskBeforeNoon: false,
    });
    expect(awards.map((a) => a.kind)).toEqual(["task_completed", "task_on_time"]);
  });

  it("first-time-right proof earns on top of acceptance", () => {
    expect(proofAwards(DEFAULT_SCORING, { firstTimeRight: true }).map((a) => a.kind)).toEqual([
      "proof_accepted",
      "proof_first_time",
    ]);
    expect(proofAwards(DEFAULT_SCORING, { firstTimeRight: false }).map((a) => a.kind)).toEqual([
      "proof_accepted",
    ]);
  });
});

describe("the daily task cap is transparent", () => {
  const fullTask = () =>
    taskAwards(DEFAULT_SCORING, {
      onTime: true,
      hoursBeforeDue: null,
      highPriority: false,
      isFirstTaskBeforeNoon: false,
    }); // task_completed 10 + task_on_time 5 = 15

  it("truncates whole awards, never splits one", () => {
    // 45 already used; cap 50. task_completed (+10) does not fit and is
    // dropped whole; nothing shows as a partial award.
    const kept = applyDailyTaskCap(DEFAULT_SCORING, 45, fullTask());
    expect(kept.map((a) => a.kind)).toEqual(["task_on_time"]);
  });

  it("stops all task points at the cap", () => {
    expect(applyDailyTaskCap(DEFAULT_SCORING, 50, fullTask())).toEqual([]);
  });

  it("never caps attendance awards", () => {
    const kept = applyDailyTaskCap(DEFAULT_SCORING, 50, [
      { kind: "on_time", points: 10, note: "On-time check-in" },
    ]);
    expect(kept).toHaveLength(1);
  });

  it("cap 0 disables the cap entirely", () => {
    const policy = normalizeScoring({ ...DEFAULT_SCORING, dailyTaskCap: 0 });
    expect(applyDailyTaskCap(policy, 9_999, fullTask())).toHaveLength(2);
  });
});

describe("week keys", () => {
  it("gives stable Monday-based ISO keys for aggregate dedupe", () => {
    expect(weekKey(new Date(Date.UTC(2026, 7, 17)))).toBe("2026-W34"); // Mon
    expect(weekKey(new Date(Date.UTC(2026, 7, 23)))).toBe("2026-W34"); // Sun
    expect(weekKey(new Date(Date.UTC(2026, 7, 24)))).toBe("2026-W35"); // next Mon
    expect(weekKey(new Date(Date.UTC(2026, 0, 1)))).toBe("2026-W01");
  });
});
