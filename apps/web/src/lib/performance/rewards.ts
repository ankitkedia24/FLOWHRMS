/**
 * Rewards — pure maths for the store (PERFORMANCE-MODULE.md §D).
 *
 * The one invariant everything else hangs off: the balance is earned
 * minus held, where PENDING and APPROVED redemptions hold points. A
 * rejection or cancellation returns the points by ARITHMETIC — the hold
 * simply stops counting — so there is no compensating write to forget,
 * and no way for a refund bug to exist.
 *
 * Points are never money (D-P3-01): a reward records fulfilment of a
 * thing the tenant offered; cash goes through audited payroll
 * adjustments. Nothing in this module can touch a payroll figure.
 */

export const HOLDING_STATUSES = ["PENDING", "APPROVED"] as const;

/** Points available to spend right now. Never negative. */
export function availablePoints(earned: number, held: number): number {
  return Math.max(0, earned - held);
}

export interface RedeemCheck {
  ok: boolean;
  reason?: string;
}

/** Can this redemption be requested? Pure — the action re-checks in a
 *  transaction, but the screen uses this for an honest disabled state. */
export function canRedeem(input: {
  rewardActive: boolean;
  pointCost: number;
  available: number;
  /** Remaining stock, null = unlimited. */
  stock: number | null;
  /** Pending redemptions already queued against this reward, everyone's. */
  pendingForReward: number;
}): RedeemCheck {
  if (!input.rewardActive) {
    return { ok: false, reason: "This reward has been retired." };
  }
  if (input.stock !== null && input.stock - input.pendingForReward <= 0) {
    return { ok: false, reason: "Out of stock right now." };
  }
  if (input.pointCost > input.available) {
    return {
      ok: false,
      reason: `Needs ${input.pointCost - input.available} more points.`,
    };
  }
  return { ok: true };
}
