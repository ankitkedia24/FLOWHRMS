import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { getDb } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateRewardForm, DecideRedemption, RetireRewardButton } from "./RewardAdmin";

export const metadata: Metadata = { title: "Rewards" };

function formatWhen(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(date);
}

/**
 * Reward management and the fulfilment queue (PERFORMANCE-MODULE.md §E).
 * Redemption tiles land here; the decision is made where its consequence
 * is on screen — who asked, what for, how many points, stock remaining.
 */
export default async function AdminRewardsPage() {
  const { session, decision } = await checkAccess({
    module: "PERFORMANCE",
    feature: "rewards",
    permission: "employees.manage",
  });
  if (!decision.allowed) redirect("/admin/performance");

  if (devFixtureOffline()) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-heading text-h1 text-text-primary">Rewards</h1>
        <Card flush>
          <EmptyState title="No store yet." body="Connect a database to manage rewards." />
        </Card>
      </div>
    );
  }

  const db = getDb();
  const tenantId = session.tenant.id;

  const [rewards, pending, decided] = await Promise.all([
    db.reward.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { pointCost: "asc" }],
    }),
    db.rewardRedemption.findMany({
      where: { tenantId, status: "PENDING" },
      include: { membership: { include: { user: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.rewardRedemption.findMany({
      where: { tenantId, status: { in: ["APPROVED", "REJECTED", "CANCELLED"] } },
      include: { membership: { include: { user: true } } },
      orderBy: { decidedAt: "desc" },
      take: 15,
    }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">Rewards</h1>
        <Link
          href="/admin/performance"
          className="text-label text-brand-primary underline-offset-2 hover:underline"
        >
          Performance overview
        </Link>
      </div>

      {/* ---- fulfilment queue first: it's the work ---- */}
      <section aria-labelledby="queue">
        <h2 id="queue" className="mb-3 font-heading text-h2 text-text-primary">
          Waiting for hand-over ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <Card flush>
            <EmptyState title="Nothing waiting." body="Redemptions land here the moment someone spends points." />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((r) => (
              <li key={r.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-body font-semibold text-text-primary">
                        {r.membership.user.displayName} · {r.rewardName}
                      </p>
                      <p className="text-caption text-text-secondary">
                        {r.points.toLocaleString("en-IN")} points ·{" "}
                        {formatWhen(r.createdAt, session.tenant.timezone)}
                      </p>
                    </div>
                    <DecideRedemption redemptionId={r.id} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- the store ---- */}
      <section aria-labelledby="store">
        <h2 id="store" className="mb-3 font-heading text-h2 text-text-primary">
          The store
        </h2>
        <Card>
          {rewards.length > 0 && (
            <ul className="mb-4 flex flex-col divide-y divide-border-subtle">
              {rewards.map((reward) => (
                <li
                  key={reward.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-text-primary">{reward.name}</p>
                    <p className="text-caption text-text-secondary">
                      {reward.pointCost.toLocaleString("en-IN")} points
                      {reward.stock !== null ? ` · ${reward.stock} left` : " · unlimited"}
                    </p>
                  </div>
                  <RetireRewardButton rewardId={reward.id} />
                </li>
              ))}
            </ul>
          )}
          <CreateRewardForm />
        </Card>
      </section>

      {/* ---- history ---- */}
      {decided.length > 0 && (
        <section aria-labelledby="history">
          <h2 id="history" className="mb-3 font-heading text-h2 text-text-primary">
            Decided
          </h2>
          <Card>
            <ul className="flex flex-col divide-y divide-border-subtle">
              {decided.map((r) => (
                <li key={r.id} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-body text-text-primary">
                    {r.membership.user.displayName} · {r.rewardName} ·{" "}
                    <span className="font-mono tabular-nums">
                      {r.points.toLocaleString("en-IN")}
                    </span>{" "}
                    ·{" "}
                    <span
                      className={
                        r.status === "APPROVED"
                          ? "text-status-success-fg"
                          : r.status === "REJECTED"
                            ? "text-status-error-fg"
                            : "text-text-secondary"
                      }
                    >
                      {r.status === "APPROVED"
                        ? "handed over"
                        : r.status === "REJECTED"
                          ? "refused"
                          : "cancelled"}
                    </span>
                  </p>
                  {r.decisionReason && (
                    <p className="text-caption text-text-secondary">
                      &ldquo;{r.decisionReason}&rdquo;
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
