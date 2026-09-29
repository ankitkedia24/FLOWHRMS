/**
 * Badge catalog and detection — pure logic, no I/O (PERFORMANCE-MODULE.md §B).
 *
 * Definitions live in code like the feature catalog: a badge is a product
 * promise ("this is what dedication looks like here"), not tenant
 * configuration. What is earned is stored per person in employee_badges;
 * what a badge MEANS is stated here once, including the locked-state copy
 * that tells someone exactly how to earn it.
 *
 * Every predicate reads recorded facts — ledger counts and the computed
 * streak — never opinions. The "comeback_season" badge is defined here so
 * the wall can show it locked, but it is awarded by the season close-out
 * (P3): "most improved of a season" cannot be judged before seasons exist.
 */

export interface BadgeFacts {
  /** Lifetime points earned (spending does not reduce this). */
  totalPoints: number;
  /** Consecutive on-time days, as of the latest award. */
  currentStreak: number;
  /** Lifetime count of task_completed awards. */
  tasksCompleted: number;
  /** Lifetime count of early_bird awards. */
  earlyBirdCount: number;
  /** Lifetime count of proof_accepted awards. */
  proofAcceptedCount: number;
  /** Lifetime count of perfect_month awards. */
  perfectMonths: number;
}

export interface BadgeDefinition {
  key: string;
  name: string;
  /** Shown under the badge once earned. */
  earnedLine: string;
  /** Shown greyed on the wall with exactly how to earn it. */
  howToEarn: string;
  /** Null = not self-detectable (awarded elsewhere, e.g. season close). */
  earned: ((facts: BadgeFacts) => boolean) | null;
}

export const BADGES: readonly BadgeDefinition[] = [
  {
    key: "first_steps",
    name: "First Steps",
    earnedLine: "Your first points on the board.",
    howToEarn: "Earn your first points — one on-time check-in does it.",
    earned: (f) => f.totalPoints > 0,
  },
  {
    key: "streak_7",
    name: "One Week Strong",
    earnedLine: "Seven on-time days in a row.",
    howToEarn: "Arrive on time 7 working days in a row.",
    earned: (f) => f.currentStreak >= 7,
  },
  {
    key: "streak_30",
    name: "The Regular",
    earnedLine: "Thirty on-time days in a row.",
    howToEarn: "Arrive on time 30 working days in a row.",
    earned: (f) => f.currentStreak >= 30,
  },
  {
    key: "streak_100",
    name: "Iron Streak",
    earnedLine: "One hundred on-time days in a row.",
    howToEarn: "Arrive on time 100 working days in a row.",
    earned: (f) => f.currentStreak >= 100,
  },
  {
    key: "tasks_10",
    name: "Getting Things Done",
    earnedLine: "Ten tasks completed.",
    howToEarn: "Complete 10 tasks.",
    earned: (f) => f.tasksCompleted >= 10,
  },
  {
    key: "tasks_50",
    name: "Workhorse",
    earnedLine: "Fifty tasks completed.",
    howToEarn: "Complete 50 tasks.",
    earned: (f) => f.tasksCompleted >= 50,
  },
  {
    key: "tasks_250",
    name: "Backbone of the Team",
    earnedLine: "Two hundred and fifty tasks completed.",
    howToEarn: "Complete 250 tasks.",
    earned: (f) => f.tasksCompleted >= 250,
  },
  {
    key: "perfect_month",
    name: "Perfect Month",
    earnedLine: "Every worked day on time, a whole month.",
    howToEarn: "Finish a month with every worked day on time.",
    earned: (f) => f.perfectMonths >= 1,
  },
  {
    key: "early_bird_20",
    name: "Early Bird",
    earnedLine: "Twenty early arrivals.",
    howToEarn: "Check in well before shift start 20 times.",
    earned: (f) => f.earlyBirdCount >= 20,
  },
  {
    key: "proof_master_25",
    name: "Proof Master",
    earnedLine: "Twenty-five proofs accepted.",
    howToEarn: "Have task proof accepted 25 times.",
    earned: (f) => f.proofAcceptedCount >= 25,
  },
  {
    key: "comeback_season",
    name: "The Comeback",
    earnedLine: "Most improved of a season.",
    howToEarn: "Climb the most against your own previous season.",
    earned: null, // awarded by the season close-out (P3)
  },
];

/** Catalog keys that may appear on the badge wall. */
export const BADGE_KEYS: readonly string[] = BADGES.map((b) => b.key);

/** Which catalog badges these facts have earned (self-detectable only). */
export function detectBadges(facts: BadgeFacts): string[] {
  return BADGES.filter((b) => b.earned !== null && b.earned(facts)).map((b) => b.key);
}
