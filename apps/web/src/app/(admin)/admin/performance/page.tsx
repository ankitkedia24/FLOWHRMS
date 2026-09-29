import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { getDb } from "@/lib/db";
import { workDateInTimezone } from "@/lib/attendance/policy";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPolicy } from "@/lib/policies";
import {
  mostImproved,
  previousSeasonBounds,
  rankSeason,
  seasonBounds,
  type SeasonEntry,
} from "@/lib/performance/seasons";
import { BoostManager } from "./BoostManager";
import { SendKudos } from "./SendKudos";

export const metadata: Metadata = { title: "Performance" };

/**
 * The HR pulse view (PERFORMANCE-MODULE.md §E): this season's top
 * performers, most improved, streak health, and double-points windows.
 *
 * Reads the same ledger the employee screens read — no separate truth.
 * The scoring EDITOR stays under Settings; this page is for watching the
 * season, not changing the rules.
 */
export default async function AdminPerformancePage() {
  const { session, decision } = await checkAccess({ module: "PERFORMANCE" });
  if (!decision.allowed) redirect("/unauthorized");

  if (devFixtureOffline()) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-heading text-h1 text-text-primary">Performance</h1>
        <Card flush>
          <EmptyState title="No data yet." body="Connect a database to see the season." />
        </Card>
      </div>
    );
  }

  const db = getDb();
  const tenantId = session.tenant.id;
  const today = workDateInTimezone(new Date(), session.tenant.timezone);
  const published = await getPolicy(tenantId, "performance");

  const members = await db.tenantMembership.findMany({
    where: { tenantId, status: "ACTIVE" },
    select: {
      id: true,
      user: { select: { displayName: true } },
      department: { select: { name: true } },
    },
  });
  const nameById = new Map(
    members.map((m) => [m.id, { name: m.user.displayName, dept: m.department?.name ?? null }]),
  );

  const bounds = seasonBounds(today);
  const prev = previousSeasonBounds(today);

  const entriesFor = async (start: Date, end: Date): Promise<SeasonEntry[]> => {
    const rows = await db.performanceEvent.groupBy({
      by: ["membershipId"],
      where: { tenantId, workDate: { gte: start, lte: end } },
      _sum: { points: true },
    });
    return rows
      .filter((r) => nameById.has(r.membershipId))
      .map((r) => ({
        membershipId: r.membershipId,
        name: nameById.get(r.membershipId)!.name,
        departmentName: nameById.get(r.membershipId)!.dept,
        points: r._sum.points ?? 0,
      }));
  };

  const monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * 86_400_000);
  const [current, previous, boosts, kudosSentThisWeek] = await Promise.all([
    entriesFor(bounds.start, bounds.end),
    entriesFor(prev.start, prev.end),
    db.performanceBoost.findMany({ where: { tenantId }, orderBy: { startDate: "desc" }, take: 10 }),
    db.kudos.count({
      where: {
        tenantId,
        fromMembershipId: session.membership.id,
        createdAt: { gte: monday },
      },
    }),
  ]);
  const ranked = rankSeason(current);
  const improved = mostImproved(current, previous);

  // Streak health: who arrived on time over the last 7 days, per person.
  const weekAgo = new Date(today.getTime() - 7 * 86_400_000);
  const recent = await db.attendanceRecord.findMany({
    where: {
      tenantId,
      workDate: { gte: weekAgo, lte: today },
      checkInAt: { not: null },
    },
    select: { membershipId: true, lateMinutes: true, exemptionStatus: true },
  });
  const seen = new Map<string, { days: number; onTime: number }>();
  for (const r of recent) {
    const row = seen.get(r.membershipId) ?? { days: 0, onTime: 0 };
    row.days += 1;
    if (!(r.lateMinutes > 0 && r.exemptionStatus !== "EXEMPTED")) row.onTime += 1;
    seen.set(r.membershipId, row);
  }
  let healthy = 0;
  let wobbly = 0;
  for (const row of seen.values()) {
    if (row.onTime === row.days) healthy += 1;
    else wobbly += 1;
  }

  const totalThisSeason = current.reduce((sum, e) => sum + e.points, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">Performance</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/performance/rewards"
            className="text-label text-brand-primary underline-offset-2 hover:underline"
          >
            Rewards
          </Link>
          <Link
            href="/admin/settings/performance"
            className="text-label text-brand-primary underline-offset-2 hover:underline"
          >
            Scoring rules
          </Link>
        </div>
      </div>

      {!published && (
        <Card>
          <CardHeader title="Scoring is not published" />
          <p className="text-body text-text-secondary">
            Points are not counting and the leaderboard cannot be enabled until
            the rules are published under{" "}
            <Link href="/admin/settings/performance" className="text-brand-primary underline underline-offset-2">
              Performance scoring
            </Link>
            .
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-caption text-text-secondary">Points this season</p>
          <p className="font-mono text-data-xl font-semibold text-text-primary tabular-nums">
            {totalThisSeason.toLocaleString("en-IN")}
          </p>
        </Card>
        <Card>
          <p className="text-caption text-text-secondary">On the board</p>
          <p className="font-mono text-data-xl font-semibold text-text-primary tabular-nums">
            {ranked.length}
          </p>
          <p className="text-caption text-text-tertiary">people with points</p>
        </Card>
        <Card>
          <p className="text-caption text-text-secondary">Streak health, last 7 days</p>
          <p className="font-mono text-data-xl font-semibold text-text-primary tabular-nums">
            {healthy} <span className="text-data text-text-secondary">clean</span> · {wobbly}{" "}
            <span className="text-data text-text-secondary">wobbly</span>
          </p>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top this season" />
          {ranked.length === 0 ? (
            <p className="text-body text-text-secondary">No points yet this month.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-subtle">
              {ranked.slice(0, 8).map((row) => (
                <li key={row.membershipId} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <span className="w-8 font-mono text-data text-text-secondary tabular-nums">
                    #{row.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body text-text-primary">{row.name}</p>
                    {row.departmentName && (
                      <p className="text-caption text-text-secondary">{row.departmentName}</p>
                    )}
                  </div>
                  <span className="font-mono text-data font-semibold text-text-primary tabular-nums">
                    {row.points.toLocaleString("en-IN")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Most improved" />
          {improved ? (
            <div className="flex flex-col gap-1">
              <p className="font-heading text-h2 text-text-primary">{improved.name}</p>
              <p className="font-mono text-data-lg font-semibold text-status-success-fg tabular-nums">
                +{improved.climb.toLocaleString("en-IN")}
              </p>
              <p className="text-caption text-text-secondary">
                {improved.previousPoints.toLocaleString("en-IN")} →{" "}
                {improved.currentPoints.toLocaleString("en-IN")} against their own last season.
              </p>
            </div>
          ) : (
            <p className="text-body text-text-secondary">
              Needs two seasons with points to compare.
            </p>
          )}
        </Card>
      </div>

      <section aria-labelledby="kudos">
        <h2 id="kudos" className="mb-3 font-heading text-h2 text-text-primary">
          Kudos
        </h2>
        <Card>
          <SendKudos
            members={members
              .filter((m) => m.id !== session.membership.id)
              .map((m) => ({ id: m.id, name: m.user.displayName }))
              .sort((a, b) => a.name.localeCompare(b.name))}
            sentThisWeek={kudosSentThisWeek}
          />
        </Card>
      </section>

      <section aria-labelledby="boosts">
        <h2 id="boosts" className="mb-3 font-heading text-h2 text-text-primary">
          Double-points days
        </h2>
        <Card>
          <BoostManager
            boosts={boosts.map((b) => ({
              id: b.id,
              name: b.name,
              startDate: b.startDate.toISOString().slice(0, 10),
              endDate: b.endDate.toISOString().slice(0, 10),
              active: b.startDate <= today && b.endDate >= today,
            }))}
          />
        </Card>
      </section>
    </div>
  );
}
