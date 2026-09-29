import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { formatDuration } from "@/lib/attendance/policy";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table } from "@/components/ui/Table";
import { ParamSelect } from "@/components/filters/ParamSelect";
import { FieldVisitsTabs } from "@/components/field-visits/FieldVisitsTabs";
import { ReportExport } from "@/components/field-visits/ReportExport";
import { capitalise } from "@/lib/field-visits/policy";
import { dateKeyIn, formatDistance, monthRange } from "@/lib/field-visits/state";
import { loadMonthReport, loadTeamContext, scopeDepartments, type ReportRow } from "@/lib/field-visits/team";

export const metadata: Metadata = { title: "Field visits report" };

/**
 * The month, person by person (FIELD-VISITS-MODULE.md §5): days out,
 * visits, time at places and on the road, distance — by road and still
 * estimated, apart — and what needs attention. The same figures as the CSV.
 */
export default async function FieldVisitsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; dept?: string }>;
}) {
  const { session, decision } = await checkAccess({ module: "FIELD_VISITS", permission: "admin.access" });
  if (!decision.allowed) redirect("/unauthorized");
  if (devFixtureOffline()) redirect("/admin");
  const context = await loadTeamContext(session);
  if (!context.ok) redirect("/admin/field-visits");
  const { scope, policy } = context;

  const tz = session.tenant.timezone;
  const thisMonth = dateKeyIn(new Date(), tz).slice(0, 7);
  const params = await searchParams;
  const month = params.month && monthRange(params.month) && params.month <= thisMonth ? params.month : thisMonth;
  const range = monthRange(month)!;

  const departments = await scopeDepartments(session, scope);
  const dept = departments.find((d) => d.id === params.dept)?.id ?? null;
  const rows = await loadMonthReport(session, scope, policy, range, dept);

  // The last twelve months, newest first.
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(`${thisMonth}-01T00:00:00.000Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    const value = d.toISOString().slice(0, 7);
    const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
    return { value, label };
  });

  const total = rows.reduce(
    (t, r) => ({
      visits: t.visits + r.totals.visits,
      road: t.road + r.totals.finalMetres,
      estimated: t.estimated + r.totals.estimatedMetres,
    }),
    { visits: 0, road: 0, estimated: 0 },
  );
  const places = capitalise(policy.placeWord.plural);
  const km = (m: number) => (m > 0 ? formatDistance(m) : "—");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">Field visits</h1>
        <div className="flex flex-wrap items-end gap-3">
          <ParamSelect param="month" label="Month" options={months} selected={month} />
          {departments.length > 1 && (
            <ParamSelect
              param="dept"
              label="Department"
              allLabel="All departments"
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
              selected={dept}
            />
          )}
        </div>
      </div>

      <FieldVisitsTabs current="report" places={scope.everyone} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-secondary text-text-secondary">
          {total.visits} visit{total.visits === 1 ? "" : "s"} · {km(total.road)} by road
          {total.estimated > 0 ? ` · ${km(total.estimated)} still estimated` : ""}
        </p>
        <ReportExport month={month} departmentId={dept} canExport={session.permissions.has("reports.export")} />
      </div>

      <Table<ReportRow>
        caption={`Field visits, ${months.find((m) => m.value === month)?.label ?? month}`}
        rows={rows}
        rowKey={(r) => r.member.membershipId}
        empty={
          <Card flush>
            <EmptyState title="Nobody to show." body="People appear here once they're set up to record field visits." />
          </Card>
        }
        columns={[
          {
            key: "name",
            header: "Name",
            rowHeader: true,
            render: (r) => (
              <Link
                href={`/admin/field-visits/people/${r.member.membershipId}`}
                className="text-brand-primary underline-offset-2 hover:underline"
              >
                {r.member.name}
              </Link>
            ),
          },
          { key: "days", header: "Days out", numeric: true, render: (r) => r.totals.daysOut },
          { key: "visits", header: "Visits", numeric: true, render: (r) => r.totals.visits },
          { key: "at", header: `At ${places.toLowerCase()}`, numeric: true, render: (r) => formatDuration(r.totals.atPlaceMinutes) },
          { key: "out", header: "Out", numeric: true, render: (r) => formatDuration(r.totals.outMinutes) },
          { key: "road", header: "By road", numeric: true, render: (r) => km(r.totals.finalMetres) },
          { key: "est", header: "Estimated", numeric: true, render: (r) => km(r.totals.estimatedMetres) },
          {
            key: "attention",
            header: "Needs attention",
            render: (r) => attention(r) || <span className="text-text-tertiary">—</span>,
          },
        ]}
        renderMobileCard={(r) => (
          <Card>
            <Link
              href={`/admin/field-visits/people/${r.member.membershipId}`}
              className="text-body font-semibold text-brand-primary underline-offset-2 hover:underline"
            >
              {r.member.name}
            </Link>
            <p className="mt-1 text-secondary text-text-secondary">
              {r.totals.daysOut} days out · {r.totals.visits} visits · {km(r.totals.finalMetres)} by road
              {r.totals.estimatedMetres > 0 ? ` · ${km(r.totals.estimatedMetres)} estimated` : ""}
            </p>
            <p className="text-caption text-text-secondary">
              At {places.toLowerCase()} {formatDuration(r.totals.atPlaceMinutes)} · out {formatDuration(r.totals.outMinutes)}
            </p>
            {attention(r) && <p className="mt-1 text-caption text-status-warning-fg">{attention(r)}</p>}
          </Card>
        )}
      />

      <p className="text-caption text-text-secondary">
        “Estimated” is straight-line distance where the road distance isn&apos;t known yet or couldn&apos;t be
        worked out. Declined trips still show here; they are left out of travel claims.
      </p>
    </div>
  );
}

function attention(r: ReportRow): string {
  const t = r.totals;
  return [
    t.notEnded ? `${t.notEnded} not ended` : null,
    t.awaiting ? `${t.awaiting} awaiting approval` : null,
    t.declined ? `${t.declined} declined` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
