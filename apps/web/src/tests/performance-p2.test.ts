import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCORING,
  anniversaryAward,
  completedServiceYears,
  monthAwards,
  monthKey,
  monthTaskMilestones,
  normalizeScoring,
  onboardingAward,
  plannedLeaveAward,
  teamDayAward,
} from "@/lib/performance/scoring";
import { LEVEL_THRESHOLDS, levelBadgeKey, levelFor } from "@/lib/performance/levels";
import { BADGES, detectBadges, type BadgeFacts } from "@/lib/performance/badges";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

const NO_FACTS: BadgeFacts = {
  totalPoints: 0,
  currentStreak: 0,
  tasksCompleted: 0,
  earlyBirdCount: 0,
  proofAcceptedCount: 0,
  perfectMonths: 0,
};

describe("month awards", () => {
  it("pays perfect and clean together for a flawless month", () => {
    const awards = monthAwards(DEFAULT_SCORING, {
      workedDays: 24,
      onTimeDays: 24,
      exceptionDays: 0,
    });
    expect(awards.map((a) => a.kind).sort()).toEqual(["clean_month", "perfect_month"]);
    expect(awards.every((a) => a.points > 0)).toBe(true);
  });

  it("refuses a month with too few worked days — one worked day is not a perfect month", () => {
    expect(
      monthAwards(DEFAULT_SCORING, { workedDays: 1, onTimeDays: 1, exceptionDays: 0 }),
    ).toEqual([]);
    expect(
      monthAwards(DEFAULT_SCORING, {
        workedDays: DEFAULT_SCORING.monthMinDays - 1,
        onTimeDays: DEFAULT_SCORING.monthMinDays - 1,
        exceptionDays: 0,
      }),
    ).toEqual([]);
  });

  it("one late day kills perfect but not clean; one exception kills clean but not perfect", () => {
    const late = monthAwards(DEFAULT_SCORING, {
      workedDays: 24,
      onTimeDays: 23,
      exceptionDays: 0,
    });
    expect(late.map((a) => a.kind)).toEqual(["clean_month"]);

    const exception = monthAwards(DEFAULT_SCORING, {
      workedDays: 24,
      onTimeDays: 24,
      exceptionDays: 1,
    });
    expect(exception.map((a) => a.kind)).toEqual(["perfect_month"]);
  });

  it("respects the individual switches", () => {
    const policy = normalizeScoring({
      ...DEFAULT_SCORING,
      rules: {
        ...DEFAULT_SCORING.rules,
        perfect_month: { enabled: false, points: 100 },
      },
    });
    const awards = monthAwards(policy, { workedDays: 24, onTimeDays: 24, exceptionDays: 0 });
    expect(awards.map((a) => a.kind)).toEqual(["clean_month"]);
  });

  it("month keys are stable dedupe handles", () => {
    expect(monthKey(d("2026-08-01"))).toBe("2026-08");
    expect(monthKey(d("2026-12-31"))).toBe("2026-12");
  });
});

describe("monthly task volume", () => {
  it("returns every reached milestone — the ledger dedupe keeps them one-time", () => {
    expect(monthTaskMilestones(DEFAULT_SCORING, 9)).toEqual([]);
    expect(monthTaskMilestones(DEFAULT_SCORING, 10).map((a) => a.kind)).toEqual([
      "month_tasks_10",
    ]);
    expect(monthTaskMilestones(DEFAULT_SCORING, 60).map((a) => a.kind)).toEqual([
      "month_tasks_10",
      "month_tasks_25",
      "month_tasks_50",
    ]);
  });
});

describe("team day", () => {
  it("pays only when the WHOLE department is on time", () => {
    expect(
      teamDayAward(DEFAULT_SCORING, { departmentSize: 5, onTimeToday: 5 })?.kind,
    ).toBe("team_day");
    expect(teamDayAward(DEFAULT_SCORING, { departmentSize: 5, onTimeToday: 4 })).toBeNull();
  });

  it("a department of one is just a person having a morning", () => {
    expect(teamDayAward(DEFAULT_SCORING, { departmentSize: 1, onTimeToday: 1 })).toBeNull();
  });
});

describe("Amendment 2 sources", () => {
  it("planned leave needs the configured notice", () => {
    expect(plannedLeaveAward(DEFAULT_SCORING, { requestedDaysAhead: 2 })).toBeNull();
    const a = plannedLeaveAward(DEFAULT_SCORING, { requestedDaysAhead: 3 });
    expect(a?.kind).toBe("planned_leave");
    expect(a?.note).toContain("3 days ahead");
  });

  it("onboarding needs BOTH a verified document and a complete profile", () => {
    expect(
      onboardingAward(DEFAULT_SCORING, { hasVerifiedDocument: true, profileComplete: false }),
    ).toBeNull();
    expect(
      onboardingAward(DEFAULT_SCORING, { hasVerifiedDocument: false, profileComplete: true }),
    ).toBeNull();
    expect(
      onboardingAward(DEFAULT_SCORING, { hasVerifiedDocument: true, profileComplete: true })
        ?.kind,
    ).toBe("onboarding_complete");
  });

  it("service years respect the anniversary date, not the year number", () => {
    expect(completedServiceYears(d("2024-08-21"), d("2026-08-20"))).toBe(1);
    expect(completedServiceYears(d("2024-08-21"), d("2026-08-21"))).toBe(2);
    expect(completedServiceYears(d("2026-01-01"), d("2026-06-01"))).toBe(0);
  });

  it("no anniversary award before the first year completes", () => {
    expect(anniversaryAward(DEFAULT_SCORING, { completedYears: 0 })).toBeNull();
    const a = anniversaryAward(DEFAULT_SCORING, { completedYears: 3 });
    expect(a?.note).toContain("3 years");
  });
});

describe("levels", () => {
  it("thresholds climb and never reset", () => {
    expect(levelFor(0, DEFAULT_SCORING).index).toBe(0);
    expect(levelFor(499, DEFAULT_SCORING).index).toBe(0);
    expect(levelFor(500, DEFAULT_SCORING).index).toBe(1);
    expect(levelFor(10_000, DEFAULT_SCORING).index).toBe(4);
    expect(levelFor(999_999, DEFAULT_SCORING).index).toBe(4);
  });

  it("progress runs 0→1 inside a level and pins at 1 on top", () => {
    const mid = levelFor(1000, DEFAULT_SCORING); // silver: 500–1500
    expect(mid.progress).toBeCloseTo(0.5);
    expect(mid.pointsToNext).toBe(500);
    const top = levelFor(20_000, DEFAULT_SCORING);
    expect(top.progress).toBe(1);
    expect(top.pointsToNext).toBe(0);
    expect(top.next).toBeNull();
  });

  it("tenant names apply; broken input falls back per-slot", () => {
    const policy = normalizeScoring({ levelNames: ["Copper", "", "Gold", 42, "Boss"] });
    expect(policy.levelNames).toEqual(["Copper", "Silver", "Gold", "Platinum", "Boss"]);
    expect(levelFor(0, policy).name).toBe("Copper");
  });

  it("level badge keys line up with thresholds", () => {
    expect(LEVEL_THRESHOLDS.length).toBe(5);
    expect(levelBadgeKey(2)).toBe("level_2");
  });
});

describe("badges", () => {
  it("nothing is earned from nothing", () => {
    expect(detectBadges(NO_FACTS)).toEqual([]);
  });

  it("first points earn First Steps", () => {
    expect(detectBadges({ ...NO_FACTS, totalPoints: 10 })).toContain("first_steps");
  });

  it("streak and volume badges trigger at their thresholds", () => {
    const facts = { ...NO_FACTS, totalPoints: 1, currentStreak: 30, tasksCompleted: 50 };
    const earned = detectBadges(facts);
    expect(earned).toContain("streak_7");
    expect(earned).toContain("streak_30");
    expect(earned).not.toContain("streak_100");
    expect(earned).toContain("tasks_10");
    expect(earned).toContain("tasks_50");
    expect(earned).not.toContain("tasks_250");
  });

  it("the season badge is never self-detected — P3 awards it", () => {
    const everything = {
      totalPoints: 1_000_000,
      currentStreak: 400,
      tasksCompleted: 10_000,
      earlyBirdCount: 10_000,
      proofAcceptedCount: 10_000,
      perfectMonths: 12,
    };
    expect(detectBadges(everything)).not.toContain("comeback_season");
  });

  it("every catalog badge has locked-state copy — a locked badge with no instructions is a taunt", () => {
    for (const badge of BADGES) {
      expect(badge.howToEarn.length).toBeGreaterThan(10);
      expect(badge.earnedLine.length).toBeGreaterThan(5);
    }
  });
});

describe("policy compatibility", () => {
  it("a v1 policy document (15 rules, no new thresholds) normalizes cleanly", () => {
    const v1 = {
      rules: { on_time: { enabled: true, points: 12 } },
      earlyBirdMinutes: 20,
    };
    const policy = normalizeScoring(v1);
    expect(policy.rules.on_time.points).toBe(12);
    expect(policy.rules.perfect_month.enabled).toBe(true);
    expect(policy.monthMinDays).toBe(20);
    expect(policy.levelNames[0]).toBe("Bronze");
  });
});
