import type { ScoringPolicy } from "./scoring";

/**
 * Lifetime levels — pure maths, no I/O (PERFORMANCE-MODULE.md §B).
 *
 * Thresholds live here in code, like the badge catalog and the feature
 * catalog: they are product design, not tenant configuration. What a
 * tenant CAN change is the names — "Bronze" means nothing in some shops
 * and everything in others — via the scoring policy's levelNames.
 *
 * Levels climb on lifetime points and NEVER reset or fall. Spending
 * points in the rewards store (P4) does not touch them: the level is a
 * record of everything earned, and taking it away because someone
 * redeemed a reward would punish exactly the engagement the module
 * exists to create.
 */

/** Lifetime points needed to ENTER each level. Index 0 = the floor. */
export const LEVEL_THRESHOLDS = [0, 500, 1500, 4000, 10_000] as const;

export const LEVEL_COUNT = LEVEL_THRESHOLDS.length;

export interface LevelStanding {
  /** 0-based level index. */
  index: number;
  /** The tenant's name for it. */
  name: string;
  /** Points where this level begins. */
  floor: number;
  /** Points where the next level begins; null at the top. */
  next: number | null;
  /** 0–1 progress from floor to next; 1 at the top level. */
  progress: number;
  /** Points still needed for the next level; 0 at the top. */
  pointsToNext: number;
}

export function levelFor(
  lifetimePoints: number,
  policy: Pick<ScoringPolicy, "levelNames">,
): LevelStanding {
  const points = Math.max(0, lifetimePoints);
  let index = 0;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i]) {
      index = i;
      break;
    }
  }
  const floor = LEVEL_THRESHOLDS[index];
  const next = index + 1 < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[index + 1] : null;
  return {
    index,
    name: policy.levelNames[index] ?? `Level ${index + 1}`,
    floor,
    next,
    progress: next === null ? 1 : Math.min(1, (points - floor) / (next - floor)),
    pointsToNext: next === null ? 0 : Math.max(0, next - points),
  };
}

/** Badge-store key for a level celebration ("level_1".."level_4"). */
export function levelBadgeKey(index: number): string {
  return `level_${index}`;
}
