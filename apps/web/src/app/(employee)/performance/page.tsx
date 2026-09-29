import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { getDb } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { BadgeWall } from "@/components/performance/BadgeWall";
import { CelebrationOverlay } from "@/components/performance/CelebrationOverlay";
import { LevelRing } from "@/components/performance/LevelRing";
import { StreakFlame } from "@/components/performance/StreakFlame";
import { WeekBars } from "@/components/performance/WeekBars";
import { loadPerformanceSummary } from "@/lib/performance/summary";
import { RULE_KEYS, RULE_LABELS } from "@/lib/performance/scoring";

export const metadata: Metadata = { title: "My Performance" };

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

/**
 * My Performance (P2): the full motivation surface — level ring, streak
 * flame, weekly bars, personal bests, badge wall, ledger, and the
 * published rules.
 *
 * Every number traces to a ledger line or an attendance record; the
 * summary loader is shared with the Home widget so the two can never
 * disagree. Celebrations ride in from the same load and fire once.
 */
export default async function PerformancePage() {
  const { session, decision } = await checkAccess({ module: "PERFORMANCE" });
  if (!decision.allowed) redirect("/unauthorized");

  if (devFixtureOffline()) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-heading text-h1 text-text-primary">My Performance</h1>
        <Card flush>
          <EmptyState warm title="No points yet." body="Connect a database to see performance." />
        </Card>
      </div>
    );
  }

  const summary = await loadPerformanceSummary(session);
  if (!summary) redirect("/unauthorized");

  const db = getDb();
  const [recent, kudos] = await Promise.all([
    db.performanceEvent.findMany({
      where: { tenantId: session.tenant.id, membershipId: session.membership.id },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      take: 20,
    }),
    db.kudos.findMany({
      where: { tenantId: session.tenant.id, toMembershipId: session.membership.id },
      include: { from: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      {summary.celebrations.length > 0 && (
        <CelebrationOverlay celebrations={summary.celebrations} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">My Performance</h1>
        <div className="flex items-center gap-4">
          {summary.rewardsOn && (
            <Link
              href="/performance/rewards"
              className="text-label text-brand-primary underline-offset-2 hover:underline"
            >
              Rewards
            </Link>
          )}
          {summary.leaderboardOn && (
            <Link
              href="/performance/leaderboard"
              className="text-label text-brand-primary underline-offset-2 hover:underline"
            >
              Leaderboard
            </Link>
          )}
        </div>
      </div>

      {!summary.published && (
        <Card>
          <CardHeader title="Points aren't counting yet" />
          <p className="text-body text-text-secondary">
            Your company hasn&apos;t published its scoring rules yet. Once it
            does, every on-time day and completed task starts earning points
            — and they&apos;ll show here.
          </p>
        </Card>
      )}

      {summary.boost && (
        <Card>
          <p className="text-body font-semibold text-text-primary">
            ×{summary.boost.multiplier} points: {summary.boost.name}
          </p>
          <p className="text-caption text-text-secondary">
            Every point earned counts {summary.boost.multiplier} times until{" "}
            {formatDay(summary.boost.endDate)}.
          </p>
        </Card>
      )}

      {/* ---- the game face: ring, streak, week ---- */}
      <Card>
        <div className="flex flex-wrap items-center justify-around gap-6">
          <LevelRing level={summary.level} totalPoints={summary.totalPoints} />
          <div className="flex flex-col gap-4">
            <StreakFlame days={summary.streak} />
            <div>
              <p className="font-mono text-data font-semibold text-text-primary tabular-nums">
                {summary.weekPoints.toLocaleString("en-IN")}
              </p>
              <p className="text-caption text-text-secondary">points this week</p>
            </div>
            <div>
              <p className="font-mono text-data font-semibold text-text-primary tabular-nums">
                {summary.todayPoints.toLocaleString("en-IN")}
              </p>
              <p className="text-caption text-text-secondary">today</p>
            </div>
          </div>
          <WeekBars bars={summary.weekBars} />
        </div>
        {summary.level.next !== null && (
          <p className="mt-4 border-t border-border-subtle pt-3 text-caption text-text-secondary">
            {summary.level.pointsToNext.toLocaleString("en-IN")} points to{" "}
            {summary.policy?.levelNames[summary.level.index + 1] ?? "the next level"}. Levels
            never reset.
          </p>
        )}
      </Card>

      {/* ---- personal bests ---- */}
      <section aria-labelledby="bests">
        <h2 id="bests" className="mb-3 font-heading text-h2 text-text-primary">
          Personal bests
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-caption text-text-secondary">Best day</p>
            <p className="font-mono text-data-lg font-semibold text-text-primary tabular-nums">
              {summary.bestDay.points.toLocaleString("en-IN")}
            </p>
            <p className="text-caption text-text-tertiary">
              {summary.bestDay.date ? formatDay(summary.bestDay.date) : "—"}
            </p>
          </Card>
          <Card>
            <p className="text-caption text-text-secondary">Best week</p>
            <p className="font-mono text-data-lg font-semibold text-text-primary tabular-nums">
              {summary.bestWeek.points.toLocaleString("en-IN")}
            </p>
            <p className="text-caption text-text-tertiary">{summary.bestWeek.week ?? "—"}</p>
          </Card>
          <Card>
            <p className="text-caption text-text-secondary">Longest streak</p>
            <p className="font-mono text-data-lg font-semibold text-text-primary tabular-nums">
              {summary.longestStreak} day{summary.longestStreak === 1 ? "" : "s"}
            </p>
            <p className="text-caption text-text-tertiary">within the last year</p>
          </Card>
        </div>
      </section>

      {/* ---- badge wall ---- */}
      <section aria-labelledby="badges">
        <h2 id="badges" className="mb-3 font-heading text-h2 text-text-primary">
          Badges
        </h2>
        <BadgeWall earned={summary.earned} locked={summary.locked} />
      </section>

      {/* ---- kudos received ---- */}
      {kudos.length > 0 && (
        <section aria-labelledby="kudos">
          <h2 id="kudos" className="mb-3 font-heading text-h2 text-text-primary">
            Kudos
          </h2>
          <Card>
            <ul className="flex flex-col divide-y divide-border-subtle">
              {kudos.map((k) => (
                <li key={k.id} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-body text-text-primary">&ldquo;{k.message}&rdquo;</p>
                  <p className="mt-0.5 text-caption text-text-secondary">
                    — {k.from.user.displayName}, {formatDay(k.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* ---- ledger ---- */}
      <section aria-labelledby="recent">
        <h2 id="recent" className="mb-3 font-heading text-h2 text-text-primary">
          Recent points
        </h2>
        {recent.length === 0 ? (
          <Card flush>
            <EmptyState
              warm
              title="Nothing earned yet."
              body="Check in on time or finish a task — that's where points come from."
            />
          </Card>
        ) : (
          <Card>
            <ul className="flex flex-col divide-y divide-border-subtle">
              {recent.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-body text-text-primary">{event.note}</p>
                    <p className="text-caption text-text-secondary">
                      {formatDay(event.workDate)}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-data font-semibold text-brand-primary tabular-nums">
                    +{event.points}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* ---- how points work ---- */}
      {summary.policy && (
        <section aria-labelledby="how">
          <h2 id="how" className="mb-3 font-heading text-h2 text-text-primary">
            How points work
          </h2>
          <Card>
            <p className="text-caption text-text-secondary">
              Published rules, version {summary.version}. Points come only from
              your attendance and your tasks — nothing else, and nobody edits
              them by hand.
            </p>
            <ul className="mt-3 flex flex-col divide-y divide-border-subtle">
              {RULE_KEYS.filter((k) => summary.policy!.rules[k].enabled).map((key) => (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <span className="text-body text-text-primary">{RULE_LABELS[key]}</span>
                  <span className="shrink-0 font-mono text-data text-text-secondary tabular-nums">
                    +{summary.policy!.rules[key].points}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-border-subtle pt-3 text-caption text-text-secondary">
              Your streak counts every worked day you arrived on time. Days you
              didn&apos;t work — leave, weekly off — don&apos;t break it;
              arriving late does. Task points stop at{" "}
              {summary.policy.dailyTaskCap > 0
                ? `${summary.policy.dailyTaskCap} per day`
                : "no daily limit"}
              . Month awards need at least {summary.policy.monthMinDays} worked
              days in the month.
            </p>
          </Card>
        </section>
      )}
    </div>
  );
}
