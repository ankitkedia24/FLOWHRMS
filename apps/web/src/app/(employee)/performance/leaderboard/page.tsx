import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { loadLeaderboard } from "@/lib/performance/leaderboard";

export const metadata: Metadata = { title: "Leaderboard" };

function seasonLabel(season: string): string {
  const [year, month] = season.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

/**
 * The leaderboard (PERFORMANCE-MODULE.md §C) — monthly seasons with a
 * podium, your own neighbourhood, Most Improved beside first place, and
 * department boards where small teams can win.
 *
 * Gated on the leaderboard feature flag, which itself refuses to enable
 * before scoring is published — so this page can assume rules exist.
 *
 * What it never shows: anyone else's attendance details. Names, points
 * and ranks only (§1.7, fair visibility).
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const { session, decision } = await checkAccess({
    module: "PERFORMANCE",
    feature: "leaderboard",
  });
  if (!decision.allowed) redirect("/performance");

  if (devFixtureOffline()) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-heading text-h1 text-text-primary">Leaderboard</h1>
        <Card flush>
          <EmptyState warm title="No board yet." body="Connect a database to see the season." />
        </Card>
      </div>
    );
  }

  const { season } = await searchParams;
  const data = await loadLeaderboard(session, season);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">Leaderboard</h1>
        <Link
          href="/performance"
          className="text-label text-brand-primary underline-offset-2 hover:underline"
        >
          My Performance
        </Link>
      </div>

      {/* season picker — history is browsable, never erased */}
      {data.seasons.length > 1 && (
        <nav aria-label="Season" className="flex flex-wrap gap-2">
          {data.seasons.map((s) => (
            <Link
              key={s}
              href={s === data.seasons[0] ? "/performance/leaderboard" : `/performance/leaderboard?season=${s}`}
              aria-current={s === data.season ? "page" : undefined}
              className={
                s === data.season
                  ? "rounded-pill bg-brand-primary px-3 py-1.5 text-label text-text-on-primary"
                  : "rounded-pill bg-surface-default px-3 py-1.5 text-label text-text-secondary border border-border-default hover:border-border-strong"
              }
            >
              {seasonLabel(s)}
            </Link>
          ))}
        </nav>
      )}

      {data.totalPlayers === 0 ? (
        <Card flush>
          <EmptyState
            warm
            title="No points this season yet."
            body="The first on-time check-in starts the board."
          />
        </Card>
      ) : (
        <>
          {/* ---- podium + most improved, equal billing ---- */}
          <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader title={`${seasonLabel(data.season)} podium`} />
              <div className="flex items-end justify-center gap-2 sm:gap-3">
                {[1, 0, 2].map((slot) => {
                  const entry = data.podium[slot];
                  if (!entry) return <div key={slot} className="min-w-0 flex-1 max-w-28" />;
                  // Indexed by PODIUM position (0 = winner), not by render
                  // order — getting that wrong put gold on a shorter
                  // plinth than silver, and a user photographed it.
                  const heights = ["h-36", "h-28", "h-24"];
                  return (
                    <div key={entry.membershipId} className="flex min-w-0 flex-1 max-w-28 flex-col items-center gap-1.5">
                      <span aria-hidden="true" className="text-2xl">{medals[slot]}</span>
                      <p className="w-full truncate text-center text-label font-semibold text-text-primary">
                        {entry.name}
                      </p>
                      <p className="font-mono text-data font-semibold text-brand-primary tabular-nums">
                        {entry.points.toLocaleString("en-IN")}
                      </p>
                      <div
                        className={`w-full rounded-t-input bg-[color:var(--fh-color-brand-primary-subtle)] ${heights[slot]} flex items-start justify-center pt-2`}
                      >
                        <span className="font-heading text-h2 text-brand-primary">#{entry.rank}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <CardHeader title="Most improved" />
              {data.improved ? (
                <div className="flex flex-col gap-1">
                  <p className="font-heading text-h2 text-text-primary">{data.improved.name}</p>
                  <p className="font-mono text-data-lg font-semibold text-status-success-fg tabular-nums">
                    +{data.improved.climb.toLocaleString("en-IN")}
                  </p>
                  <p className="text-caption text-text-secondary">
                    {data.improved.previousPoints.toLocaleString("en-IN")} →{" "}
                    {data.improved.currentPoints.toLocaleString("en-IN")} against their own last
                    season.
                  </p>
                </div>
              ) : (
                <p className="text-body text-text-secondary">
                  Needs two seasons to compare. Next month this card has a name on it.
                </p>
              )}
            </Card>
          </div>

          {/* ---- your neighbourhood ---- */}
          {data.neighbourhood && (
            <Card>
              <CardHeader
                title={`You are #${data.neighbourhood.yourRank} of ${data.totalPlayers}`}
                meta={
                  data.neighbourhood.pointsToNext !== null
                    ? `${data.neighbourhood.pointsToNext.toLocaleString("en-IN")} points to the next rank`
                    : "You lead this season"
                }
              />
              <ul className="flex flex-col divide-y divide-border-subtle">
                {data.neighbourhood.rows.map((row) => {
                  const me = row.membershipId === session.membership.id;
                  return (
                    <li
                      key={row.membershipId}
                      className={`flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 ${me ? "font-semibold" : ""}`}
                    >
                      <span className="w-10 font-mono text-data text-text-secondary tabular-nums">
                        #{row.rank}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-body text-text-primary">
                        {row.name}
                        {me && <span className="ml-2 text-caption text-brand-primary">you</span>}
                      </span>
                      <span className="font-mono text-data font-semibold text-text-primary tabular-nums">
                        {row.points.toLocaleString("en-IN")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {/* ---- weekly quest ---- */}
          {data.quest && (
            <Card>
              <CardHeader
                title="This week's quest"
                meta={data.quest.done ? "Done — bonus paid" : `+${data.quest.quest.bonus} points on completion`}
              />
              <div className="flex items-center gap-3">
                <Trophy
                  aria-hidden="true"
                  className={data.quest.done ? "size-5 text-status-success-fg" : "size-5 text-text-tertiary"}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-body text-text-primary">{data.quest.quest.title}</p>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-pill bg-surface-sunken">
                    <div
                      className={`h-full rounded-pill motion-safe:transition-[width] motion-safe:duration-700 ${data.quest.done ? "bg-status-success-fg" : "bg-brand-primary"}`}
                      style={{ width: `${(data.quest.progress / data.quest.quest.target) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="font-mono text-data font-semibold text-text-primary tabular-nums">
                  {data.quest.progress}/{data.quest.quest.target}
                </span>
              </div>
            </Card>
          )}

          {/* ---- weekly sprint ---- */}
          {data.sprint.length > 0 && (
            <Card>
              <CardHeader title="This week's sprint" meta="Same board, cut to this week." />
              <ul className="flex flex-col divide-y divide-border-subtle">
                {data.sprint.map((row) => (
                  <li key={row.membershipId} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                    <span className="w-10 font-mono text-data text-text-secondary tabular-nums">#{row.rank}</span>
                    <span className="min-w-0 flex-1 truncate text-body text-text-primary">{row.name}</span>
                    <span className="font-mono text-data font-semibold text-text-primary tabular-nums">
                      {row.points.toLocaleString("en-IN")}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* ---- departments ---- */}
          {data.departments.length > 0 && (
            <Card>
              <CardHeader title="Departments" meta="Average per member, so small teams can win." />
              <ul className="flex flex-col divide-y divide-border-subtle">
                {data.departments.map((dept, i) => (
                  <li key={dept.departmentName} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="w-10 font-mono text-data text-text-secondary tabular-nums">#{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body text-text-primary">{dept.departmentName}</p>
                      <p className="text-caption text-text-secondary">
                        {dept.members} member{dept.members === 1 ? "" : "s"} ·{" "}
                        {dept.totalPoints.toLocaleString("en-IN")} total
                      </p>
                    </div>
                    <span className="font-mono text-data font-semibold text-text-primary tabular-nums">
                      {dept.averagePoints.toLocaleString("en-IN")} avg
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
