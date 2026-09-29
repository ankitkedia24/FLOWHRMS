import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Gift } from "lucide-react";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { getDb } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { availablePoints, canRedeem, HOLDING_STATUSES } from "@/lib/performance/rewards";
import { CancelRedemptionButton, RedeemButton } from "./RedeemButton";

export const metadata: Metadata = { title: "Rewards" };

const STATUS_LABEL = {
  PENDING: { label: "Waiting for hand-over", tone: "warning" as const },
  APPROVED: { label: "Handed over", tone: "success" as const },
  REJECTED: { label: "Refused — points returned", tone: "error" as const },
  CANCELLED: { label: "Cancelled — points returned", tone: "neutral" as const },
};

/**
 * The rewards store (PERFORMANCE-MODULE.md §D): what the company offers,
 * what it costs, and your own history — including exactly why anything
 * was refused, in the decider's words.
 *
 * The balance shown is earned minus held: pending and handed-over spends
 * hold points; refusals and cancellations return them by arithmetic.
 */
export default async function RewardsPage() {
  const { session, decision } = await checkAccess({
    module: "PERFORMANCE",
    feature: "rewards",
  });
  if (!decision.allowed) redirect("/performance");

  if (devFixtureOffline()) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-heading text-h1 text-text-primary">Rewards</h1>
        <Card flush>
          <EmptyState warm title="No store yet." body="Connect a database to see rewards." />
        </Card>
      </div>
    );
  }

  const db = getDb();
  const tenantId = session.tenant.id;
  const membershipId = session.membership.id;

  const [rewards, mine, earned, held, pendingByReward] = await Promise.all([
    db.reward.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { pointCost: "asc" }],
    }),
    db.rewardRedemption.findMany({
      where: { tenantId, membershipId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.performanceEvent.aggregate({
      where: { tenantId, membershipId },
      _sum: { points: true },
    }),
    db.rewardRedemption.aggregate({
      where: { tenantId, membershipId, status: { in: [...HOLDING_STATUSES] } },
      _sum: { points: true },
    }),
    db.rewardRedemption.groupBy({
      by: ["rewardId"],
      where: { tenantId, status: "PENDING" },
      _count: true,
    }),
  ]);

  const available = availablePoints(earned._sum.points ?? 0, held._sum.points ?? 0);
  const pendingFor = (rewardId: string) =>
    pendingByReward.find((p) => p.rewardId === rewardId)?._count ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">Rewards</h1>
        <Link
          href="/performance"
          className="text-label text-brand-primary underline-offset-2 hover:underline"
        >
          My Performance
        </Link>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-caption text-text-secondary">Points to spend</p>
            <p className="font-mono text-data-xl font-semibold text-text-primary tabular-nums">
              {available.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-caption text-text-secondary">
              Earned {(earned._sum.points ?? 0).toLocaleString("en-IN")} · held{" "}
              {(held._sum.points ?? 0).toLocaleString("en-IN")}
            </p>
            <p className="text-caption text-text-tertiary">
              Spending never touches your level or badges.
            </p>
          </div>
        </div>
      </Card>

      <section aria-labelledby="store">
        <h2 id="store" className="mb-3 font-heading text-h2 text-text-primary">
          The store
        </h2>
        {rewards.length === 0 ? (
          <Card flush>
            <EmptyState
              warm
              title="Nothing on offer yet."
              body="When your company adds rewards, they appear here."
            />
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rewards.map((reward) => {
              const check = canRedeem({
                rewardActive: reward.isActive,
                pointCost: reward.pointCost,
                available,
                stock: reward.stock,
                pendingForReward: pendingFor(reward.id),
              });
              return (
                <li key={reward.id}>
                  <Card className="flex h-full flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-10 items-center justify-center rounded-full bg-[color:var(--fh-color-brand-primary-subtle)]">
                          <Gift aria-hidden="true" className="size-5 text-brand-primary" />
                        </span>
                        <div>
                          <p className="font-heading text-h3 text-text-primary">{reward.name}</p>
                          {reward.stock !== null && (
                            <p className="text-caption text-text-secondary">
                              {reward.stock} left
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="font-mono text-data font-semibold text-brand-primary tabular-nums">
                        {reward.pointCost.toLocaleString("en-IN")}
                      </p>
                    </div>
                    {reward.description && (
                      <p className="text-secondary text-text-secondary">{reward.description}</p>
                    )}
                    <div className="mt-auto pt-2">
                      <RedeemButton
                        rewardId={reward.id}
                        pointCost={reward.pointCost}
                        disabledReason={check.ok ? undefined : check.reason}
                      />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {mine.length > 0 && (
        <section aria-labelledby="history">
          <h2 id="history" className="mb-3 font-heading text-h2 text-text-primary">
            My redemptions
          </h2>
          <Card>
            <ul className="flex flex-col divide-y divide-border-subtle">
              {mine.map((r) => {
                const status = STATUS_LABEL[r.status];
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-body text-text-primary">
                        {r.rewardName}{" "}
                        <span className="font-mono text-data text-text-secondary tabular-nums">
                          −{r.points.toLocaleString("en-IN")}
                        </span>
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <StatusChip
                          size="sm"
                          status={{ key: r.status.toLowerCase(), label: status.label, tone: status.tone }}
                        />
                        {r.status === "REJECTED" && r.decisionReason && (
                          <span className="text-caption text-text-secondary">
                            &ldquo;{r.decisionReason}&rdquo;
                          </span>
                        )}
                      </div>
                    </div>
                    {r.status === "PENDING" && <CancelRedemptionButton redemptionId={r.id} />}
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
