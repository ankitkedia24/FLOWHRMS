"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { raiseActionRequest, resolveActionRequest } from "@/lib/actions/service";
import { availablePoints, canRedeem, HOLDING_STATUSES } from "./rewards";

/**
 * The rewards store (PERFORMANCE-MODULE.md §D).
 *
 * Redemption raises an ACTION TILE — the existing approve/reject/snooze
 * queue — for whoever holds the deciding permission. Approving records
 * that the reward was handed over; rejecting returns the points
 * automatically (the hold stops counting) with the reason shown to the
 * employee word for word.
 *
 * The double-spend problem is closed with a per-person advisory lock
 * inside the redemption transaction: two simultaneous redemptions
 * serialize, and the second sees the first's hold before deciding.
 */

export type ActionResult =
  | { ok: true; message: string; detail?: string }
  | { ok: false; error: string };

async function earnedAndHeld(
  tenantId: string,
  membershipId: string,
): Promise<{ earned: number; held: number }> {
  const db = getDb();
  const [earned, held] = await Promise.all([
    db.performanceEvent.aggregate({
      where: { tenantId, membershipId },
      _sum: { points: true },
    }),
    db.rewardRedemption.aggregate({
      where: { tenantId, membershipId, status: { in: [...HOLDING_STATUSES] } },
      _sum: { points: true },
    }),
  ]);
  return { earned: earned._sum.points ?? 0, held: held._sum.points ?? 0 };
}

// ------------------------------------------------------------ admin: store

const rewardSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional(),
  pointCost: z.number().int().min(1).max(1_000_000),
  stock: z.number().int().min(0).max(100_000).nullable(),
});

export async function createRewardAction(
  input: z.input<typeof rewardSchema>,
): Promise<ActionResult> {
  const parsed = rewardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the reward's name, cost and stock." };

  const { session, decision } = await checkAccess({
    module: "PERFORMANCE",
    feature: "rewards",
    permission: "settings.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const reward = await getDb().reward.create({
    data: {
      tenantId: session.tenant.id,
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      pointCost: parsed.data.pointCost,
      stock: parsed.data.stock,
    },
  });

  await recordAuditEvent(session, {
    action: "reward.created",
    entityType: "reward",
    entityId: reward.id,
    metadata: { name: reward.name, pointCost: reward.pointCost, stock: reward.stock },
  });

  revalidatePath("/admin/performance/rewards");
  revalidatePath("/performance/rewards");
  return { ok: true, message: `"${reward.name}" is in the store.` };
}

const retireSchema = z.object({ rewardId: z.string().uuid() });

/** Retire (never delete): history keeps pointing at something real. */
export async function retireRewardAction(
  input: z.input<typeof retireSchema>,
): Promise<ActionResult> {
  const parsed = retireSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That reward could not be read." };

  const { session, decision } = await checkAccess({
    module: "PERFORMANCE",
    feature: "rewards",
    permission: "settings.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const updated = await getDb().reward.updateMany({
    where: { id: parsed.data.rewardId, tenantId: session.tenant.id },
    data: { isActive: false },
  });
  if (updated.count === 0) return { ok: false, error: "That reward is already gone." };

  await recordAuditEvent(session, {
    action: "reward.retired",
    entityType: "reward",
    entityId: parsed.data.rewardId,
  });

  revalidatePath("/admin/performance/rewards");
  revalidatePath("/performance/rewards");
  return { ok: true, message: "Retired. Pending redemptions still need deciding." };
}

// -------------------------------------------------------- employee: redeem

const redeemSchema = z.object({ rewardId: z.string().uuid() });

export async function redeemRewardAction(
  input: z.input<typeof redeemSchema>,
): Promise<ActionResult> {
  const parsed = redeemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That reward could not be read." };

  const { session, decision } = await checkAccess({
    module: "PERFORMANCE",
    feature: "rewards",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const tenantId = session.tenant.id;
  const membershipId = session.membership.id;

  let redemptionId: string | null = null;
  let rewardName = "";
  let cost = 0;
  try {
    await db.$transaction(async (tx) => {
      // One person's redemptions serialize here. Without this, two
      // simultaneous requests both read the same balance and both pass.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${membershipId}))`;

      const reward = await tx.reward.findFirst({
        where: { id: parsed.data.rewardId, tenantId },
      });
      if (!reward) throw new Error("That reward is not in the store.");

      const [earned, held, pendingForReward] = await Promise.all([
        tx.performanceEvent.aggregate({
          where: { tenantId, membershipId },
          _sum: { points: true },
        }),
        tx.rewardRedemption.aggregate({
          where: { tenantId, membershipId, status: { in: [...HOLDING_STATUSES] } },
          _sum: { points: true },
        }),
        tx.rewardRedemption.count({
          where: { tenantId, rewardId: reward.id, status: "PENDING" },
        }),
      ]);

      const check = canRedeem({
        rewardActive: reward.isActive,
        pointCost: reward.pointCost,
        available: availablePoints(
          earned._sum.points ?? 0,
          held._sum.points ?? 0,
        ),
        stock: reward.stock,
        pendingForReward,
      });
      if (!check.ok) throw new Error(check.reason);

      const redemption = await tx.rewardRedemption.create({
        data: {
          tenantId,
          rewardId: reward.id,
          membershipId,
          points: reward.pointCost,
          rewardName: reward.name,
        },
      });
      redemptionId = redemption.id;
      rewardName = reward.name;
      cost = reward.pointCost;
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "That didn't go through. Try again.",
    };
  }

  // The decision tile, through the same queue as every other approval.
  await raiseActionRequest({
    tenantId,
    kind: "REWARD_REDEMPTION",
    subjectType: "reward_redemption",
    subjectId: redemptionId!,
    aboutMembershipId: membershipId,
    title: `${session.user.displayName} — reward to hand over`,
    body: `${rewardName} · ${cost.toLocaleString("en-IN")} points`,
    href: "/admin/performance/rewards",
    actorUserId: session.user.id,
  });

  await recordAuditEvent(session, {
    action: "reward.redeemed",
    entityType: "reward_redemption",
    entityId: redemptionId!,
    metadata: { reward: rewardName, points: cost },
  });

  revalidatePath("/performance/rewards");
  revalidatePath("/admin/performance/rewards");
  return {
    ok: true,
    message: `${cost.toLocaleString("en-IN")} points spent on "${rewardName}".`,
    detail: "Your admin confirms the hand-over. If it's refused, the points come straight back.",
  };
}

const cancelSchema = z.object({ redemptionId: z.string().uuid() });

/** Change of mind while it's still pending. The hold stops counting. */
export async function cancelRedemptionAction(
  input: z.input<typeof cancelSchema>,
): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That request could not be read." };

  const { session, decision } = await checkAccess({
    module: "PERFORMANCE",
    feature: "rewards",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const updated = await db.rewardRedemption.updateMany({
    where: {
      id: parsed.data.redemptionId,
      tenantId: session.tenant.id,
      membershipId: session.membership.id, // only your own
      status: "PENDING", // only before anyone decided
    },
    data: { status: "CANCELLED", decidedAt: new Date() },
  });
  if (updated.count === 0) {
    return { ok: false, error: "Too late to cancel — it's already been decided." };
  }

  await resolveActionRequest({
    tenantId: session.tenant.id,
    subjectType: "reward_redemption",
    subjectId: parsed.data.redemptionId,
    resolvedByUserId: session.user.id,
    resolution: "cancelled",
  });

  await recordAuditEvent(session, {
    action: "reward.redemption_cancelled",
    entityType: "reward_redemption",
    entityId: parsed.data.redemptionId,
  });

  revalidatePath("/performance/rewards");
  revalidatePath("/admin/performance/rewards");
  return { ok: true, message: "Cancelled. The points are back." };
}

// ------------------------------------------------------- admin: fulfilment

const decideSchema = z.object({
  redemptionId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().max(300).optional(),
});

export async function decideRedemptionAction(
  input: z.input<typeof decideSchema>,
): Promise<ActionResult> {
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That decision could not be read." };

  const { session, decision } = await checkAccess({
    module: "PERFORMANCE",
    feature: "rewards",
    permission: "employees.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  if (parsed.data.decision === "REJECTED" && !parsed.data.reason?.trim()) {
    return {
      ok: false,
      error: "A rejection needs a reason — the employee reads it word for word.",
    };
  }

  const db = getDb();
  const tenantId = session.tenant.id;

  const redemption = await db.rewardRedemption.findFirst({
    where: { id: parsed.data.redemptionId, tenantId },
    include: { reward: true, membership: { include: { user: true } } },
  });
  if (!redemption) return { ok: false, error: "That redemption is not here." };
  if (redemption.status !== "PENDING") {
    return { ok: false, error: "Already decided." };
  }

  if (parsed.data.decision === "APPROVED") {
    // Stock is consumed by the hand-over, atomically: the guarded update
    // fails when the last one went to somebody else a moment ago.
    if (redemption.reward.stock !== null) {
      const taken = await db.reward.updateMany({
        where: { id: redemption.rewardId, tenantId, stock: { gt: 0 } },
        data: { stock: { decrement: 1 } },
      });
      if (taken.count === 0) {
        return {
          ok: false,
          error: "Out of stock — the last one was just handed to someone else. Reject with that reason.",
        };
      }
    }
  }

  await db.rewardRedemption.update({
    where: { id: redemption.id },
    data: {
      status: parsed.data.decision,
      decidedById: session.user.id,
      decidedAt: new Date(),
      decisionReason: parsed.data.reason?.trim() || null,
    },
  });

  await resolveActionRequest({
    tenantId,
    subjectType: "reward_redemption",
    subjectId: redemption.id,
    resolvedByUserId: session.user.id,
    resolution: parsed.data.decision,
  });

  await recordAuditEvent(session, {
    action: `reward.redemption_${parsed.data.decision.toLowerCase()}`,
    entityType: "reward_redemption",
    entityId: redemption.id,
    reason: parsed.data.reason?.trim(),
    metadata: { reward: redemption.rewardName, points: redemption.points },
  });

  await notify.performanceMoment(
    session,
    redemption.membership.userId,
    parsed.data.decision === "APPROVED"
      ? `Reward handed over: ${redemption.rewardName}`
      : `Reward refused: ${redemption.rewardName}`,
    parsed.data.decision === "APPROVED"
      ? undefined
      : `${parsed.data.reason?.trim()} — your ${redemption.points.toLocaleString("en-IN")} points are back.`,
  );

  revalidatePath("/performance/rewards");
  revalidatePath("/admin/performance/rewards");
  return {
    ok: true,
    message:
      parsed.data.decision === "APPROVED"
        ? `Recorded as handed over to ${redemption.membership.user.displayName}.`
        : `Refused. ${redemption.membership.user.displayName} sees your reason and has the points back.`,
  };
}

// ----------------------------------------------------------- shared loads

export async function loadMyBalance(
  tenantId: string,
  membershipId: string,
): Promise<{ earned: number; held: number; available: number }> {
  const { earned, held } = await earnedAndHeld(tenantId, membershipId);
  return { earned, held, available: availablePoints(earned, held) };
}
