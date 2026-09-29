/**
 * Rewards flow — integration against the real database (the sample
 * tenant), with only the request-bound layers mocked: session resolution,
 * cache revalidation, notifications, audit, and the tile queue (captured
 * for assertion rather than written).
 *
 * What this proves that unit tests cannot: the advisory-lock transaction
 * actually serialises double-spends, holds actually move the balance,
 * rejection actually returns points by arithmetic, and approval actually
 * consumes stock atomically.
 *
 * Skips itself when no database is configured, so CI without secrets
 * stays green.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const HAS_DB = Boolean(process.env.DATABASE_URL);

// ---- request-bound layers, mocked
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/lib/notifications", () => ({
  notify: { performanceMoment: vi.fn() },
}));

const raised: Array<{ kind: string; subjectId: string }> = [];
vi.mock("@/lib/actions/service", () => ({
  raiseActionRequest: vi.fn(async (input: { kind: string; subjectId: string }) => {
    raised.push({ kind: input.kind, subjectId: input.subjectId });
  }),
  resolveActionRequest: vi.fn(async () => {}),
}));

// The session under test — swapped per role by the tests.
let sessionMembershipId = "";
let sessionTenant = { id: "", slug: "", name: "", timezone: "Asia/Kolkata" };
vi.mock("@/lib/authz/guard", () => ({
  checkAccess: vi.fn(async () => ({
    session: {
      user: { id: sessionUserId, displayName: "Test Person", email: null, isPlatformAdmin: false },
      tenant: sessionTenant,
      membership: { id: sessionMembershipId, roleKey: "EMPLOYEE", roleName: "Employee", employeeCode: null },
      permissions: new Set(),
      source: "supabase",
    },
    decision: { allowed: true },
  })),
}));
let sessionUserId = "";

import { getDb } from "@/lib/db";
import {
  cancelRedemptionAction,
  decideRedemptionAction,
  redeemRewardAction,
} from "@/lib/performance/reward-actions";
import { availablePoints } from "@/lib/performance/rewards";

const d = describe.skipIf(!HAS_DB);

d("rewards flow (integration, sample tenant)", () => {
  const db = HAS_DB ? getDb() : (null as never);
  let tenantId = "";
  let membershipId = "";
  let rewardId = "";
  let expensiveRewardId = "";
  const createdRedemptions: string[] = [];

  async function balance(): Promise<number> {
    const [earned, held] = await Promise.all([
      db.performanceEvent.aggregate({
        where: { tenantId, membershipId },
        _sum: { points: true },
      }),
      db.rewardRedemption.aggregate({
        where: { tenantId, membershipId, status: { in: ["PENDING", "APPROVED"] } },
        _sum: { points: true },
      }),
    ]);
    return availablePoints(earned._sum.points ?? 0, held._sum.points ?? 0);
  }

  beforeAll(async () => {
    const tenant = await db.tenant.findUniqueOrThrow({
      where: { slug: "sunrise-traders-sample" },
    });
    tenantId = tenant.id;
    sessionTenant = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      timezone: tenant.timezone,
    };

    // A member with points to spend.
    const rows = await db.performanceEvent.groupBy({
      by: ["membershipId"],
      where: { tenantId },
      _sum: { points: true },
      orderBy: { _sum: { points: "desc" } },
      take: 1,
    });
    membershipId = rows[0].membershipId;
    sessionMembershipId = membershipId;
    const membership = await db.tenantMembership.findUniqueOrThrow({
      where: { id: membershipId },
    });
    sessionUserId = membership.userId;

    // Test rewards of our own, so the sample store is untouched.
    const cheap = await db.reward.create({
      data: { tenantId, name: "[test] chai voucher", pointCost: 10, stock: 1 },
    });
    rewardId = cheap.id;
    const expensive = await db.reward.create({
      data: { tenantId, name: "[test] the moon", pointCost: 10_000_000, stock: null },
    });
    expensiveRewardId = expensive.id;
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db.rewardRedemption.deleteMany({
      where: { tenantId, rewardId: { in: [rewardId, expensiveRewardId] } },
    });
    await db.reward.deleteMany({
      where: { id: { in: [rewardId, expensiveRewardId] } },
    });
  });

  it("redeeming holds the points and raises the decision tile", async () => {
    const before = await balance();
    const result = await redeemRewardAction({ rewardId });
    expect(result.ok).toBe(true);

    const after = await balance();
    expect(after).toBe(before - 10);

    const redemption = await db.rewardRedemption.findFirstOrThrow({
      where: { tenantId, rewardId, status: "PENDING" },
    });
    createdRedemptions.push(redemption.id);
    expect(raised).toContainEqual({
      kind: "REWARD_REDEMPTION",
      subjectId: redemption.id,
    });
  });

  it("refuses what the balance cannot cover", async () => {
    const result = await redeemRewardAction({ rewardId: expensiveRewardId });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("more points");
  });

  it("cancelling returns the points by arithmetic — no refund write", async () => {
    const before = await balance();
    const result = await cancelRedemptionAction({
      redemptionId: createdRedemptions[0],
    });
    expect(result.ok).toBe(true);
    expect(await balance()).toBe(before + 10);

    const row = await db.rewardRedemption.findUniqueOrThrow({
      where: { id: createdRedemptions[0] },
    });
    expect(row.status).toBe("CANCELLED");
  });

  it("rejection needs a reason, returns points, and keeps it verbatim", async () => {
    const redo = await redeemRewardAction({ rewardId });
    expect(redo.ok).toBe(true);
    const redemption = await db.rewardRedemption.findFirstOrThrow({
      where: { tenantId, rewardId, status: "PENDING" },
    });

    const noReason = await decideRedemptionAction({
      redemptionId: redemption.id,
      decision: "REJECTED",
    });
    expect(noReason.ok).toBe(false);

    const before = await balance();
    const rejected = await decideRedemptionAction({
      redemptionId: redemption.id,
      decision: "REJECTED",
      reason: "Out of vouchers this month.",
    });
    expect(rejected.ok).toBe(true);
    expect(await balance()).toBe(before + 10);

    const row = await db.rewardRedemption.findUniqueOrThrow({
      where: { id: redemption.id },
    });
    expect(row.decisionReason).toBe("Out of vouchers this month.");
  });

  it("approval consumes stock atomically and a second approval cannot", async () => {
    const first = await redeemRewardAction({ rewardId });
    expect(first.ok).toBe(true);
    const redemption = await db.rewardRedemption.findFirstOrThrow({
      where: { tenantId, rewardId, status: "PENDING" },
    });

    const approved = await decideRedemptionAction({
      redemptionId: redemption.id,
      decision: "APPROVED",
    });
    expect(approved.ok).toBe(true);

    const reward = await db.reward.findUniqueOrThrow({ where: { id: rewardId } });
    expect(reward.stock).toBe(0);

    // The store now refuses further redemptions of it (stock exhausted).
    const again = await redeemRewardAction({ rewardId });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toContain("stock");
  });

  it("two simultaneous redemptions cannot spend the same points twice", async () => {
    // A reward priced so ONE fits the balance but TWO cannot.
    const bal = await balance();
    const big = await db.reward.create({
      data: {
        tenantId,
        name: "[test] almost everything",
        pointCost: Math.max(1, bal - 5),
        stock: null,
      },
    });
    try {
      const [a, b] = await Promise.all([
        redeemRewardAction({ rewardId: big.id }),
        redeemRewardAction({ rewardId: big.id }),
      ]);
      const successes = [a, b].filter((r) => r.ok).length;
      expect(successes).toBe(1); // the advisory lock serialised them
      expect(await balance()).toBeGreaterThanOrEqual(0);
    } finally {
      await db.rewardRedemption.deleteMany({ where: { tenantId, rewardId: big.id } });
      await db.reward.delete({ where: { id: big.id } });
    }
  });
});
