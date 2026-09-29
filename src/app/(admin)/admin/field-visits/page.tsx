import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { formatClockTime } from "@/lib/attendance/policy";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { ParamSelect } from "@/components/filters/ParamSelect";
import { FieldVisitsTabs } from "@/components/field-visits/FieldVisitsTabs";
import type { Status } from "@/lib/status";
import { loadBoard, loadTeamContext, scopeDepartments, type BoardRow } from "@/lib/field-visits/team";
import { formatDistance, formatStay, type BoardStatus } from "@/lib/field-visits/state";
import { withArticle } from "@/lib/field-visits/policy";

export const metadata: Metadata = { title: "Field visits" };

/**
 * Field visits · Today (FIELD-VISITS-MODULE.md §5): who is out, at a
 * place, on the road, or needs a correction — the owner's view of the
 * whole company, a department head's of their department, a reporting
 * manager's of their people.
 */
export default async function FieldVisitsTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>;
}) {
  const { session, decision } = await checkAccess({ module: "FIELD_VISITS", permission: "admin.access" });
  if (!decision.allowed) redirect("/unauthorized");
  if (devFixtureOffline()) redirect("/admin");

  const context = await loadTeamContext(session);
  if (!context.ok) return <Nothing reason={context.reason} />;
  const { scope, policy } = context;

  const departments = await scopeDepartments(session, scope);
  const asked = (await searchParams).dept;
  const dept = departments.find((d) => d.id === asked)?.id ?? null;
  const rows = await loadBoard(session, scope, policy, dept);
  const tz = session.tenant.timezone;
  const time = (d: Date) => formatClockTime(d, tz);
  const now = new Date().getTime();

  const outNow = rows.filter((r) => r.status.kind === "AT_PLACE" || r.status.kind === "OUT").length;
  const atPlace = rows.filter((r) => r.status.kind === "AT_PLACE").length;
  const visits = rows.reduce((n, r) => n + r.today.visits, 0);
  const metres = rows.reduce((n, r) => n + r.today.metres, 0);
  const estimated = rows.some((r) => r.today.estimated);
  const awaiting = rows.reduce((n, r) => n + r.awaitingApproval, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-h1 text-text-primary">Field visits</h1>
          <p className="text-secondary text-text-secondary">
            {scope.everyone
              ? "Everyone who records visits."
              : "The people you're responsible for: your department, and those who report to you."}
          </p>
        </div>
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

      <FieldVisitsTabs current="today" places={scope.everyone} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Out now" value={String(outNow)} />
        <Metric label={`At ${withArticle(policy.placeWord.singular)}`} value={String(atPlace)} />
        <Metric label="Visits today" value={String(visits)} />
        <Metric label={estimated ? "Travelled today (about)" : "Travelled today"} value={metres > 0 ? formatDistance(metres) : "—"} />
      </div>

      {awaiting > 0 && (
        <p className="text-secondary text-text-primary">
          {awaiting} trip{awaiting === 1 ? " is" : "s are"} waiting for approval — open the person to decide.
        </p>
      )}

      {rows.length === 0 ? (
        <Card flush>
          <EmptyState
            title="Nobody to show yet."
            body="People appear here once they're set up to record field visits."
          />
        </Card>
      ) : (
        <Card flush>
          <ul className="divide-y divide-border-subtle">
            {rows.map((row) => (
              <li key={row.member.membershipId}>
                <Link
                  href={`/admin/field-visits/people/${row.member.membershipId}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-sunken"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-label text-text-secondary"
                  >
                    {initials(row.member.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold text-text-primary">{row.member.name}</span>
                    <span className="block truncate text-caption text-text-secondary">
                      {[row.member.designation, row.member.departmentName].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 text-right">
                    <StatusChip status={chip(row.status)} size="sm" />
                    <span className="text-caption text-text-secondary">{detail(row, time, now)}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-text-tertiary" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function chip(status: BoardStatus): Status {
  switch (status.kind) {
    case "AT_PLACE":
      return { key: "fv-at", label: `At ${status.placeName}`, tone: "success" };
    case "OUT":
      return { key: "fv-out", label: "Out, travelling", tone: "info" };
    case "NEEDS_CORRECTION":
      return { key: "fv-lost", label: "Visit not ended", tone: "warning" };
    case "BACK":
      return { key: "fv-back", label: "Back at office", tone: "neutral" };
    case "AT_OFFICE":
      return { key: "fv-office", label: "At the office", tone: "neutral" };
    case "CHECKED_OUT":
      return { key: "fv-done", label: "Checked out", tone: "neutral" };
    case "NOT_IN":
      return { key: "fv-none", label: "Not checked in", tone: "neutral" };
  }
}

function detail(row: BoardRow, time: (d: Date) => string, now: number): string {
  const s = row.status;
  const today =
    row.today.visits > 0
      ? `${row.today.visits} visit${row.today.visits === 1 ? "" : "s"}${
          row.today.metres > 0 ? ` · ${row.today.estimated ? "about " : ""}${formatDistance(row.today.metres)}` : ""
        }`
      : "";
  switch (s.kind) {
    case "AT_PLACE":
      return `since ${time(s.since)} · ${formatStay((now - s.since.getTime()) / 60_000)}`;
    case "OUT":
      return `went out ${time(s.since)}${s.lastPlaceName ? ` · last at ${s.lastPlaceName}` : ""}`;
    case "NEEDS_CORRECTION":
      return s.placeName ? `at ${s.placeName}` : "a trip was left open";
    case "BACK":
      return [`at ${time(s.at)}`, today].filter(Boolean).join(" · ");
    case "AT_OFFICE":
      return `checked in ${time(s.since)}`;
    case "CHECKED_OUT":
      return [`at ${time(s.at)}`, today].filter(Boolean).join(" · ");
    case "NOT_IN":
      return "";
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-label text-text-secondary">{label}</p>
      <p className="mt-1 font-mono text-data-lg font-semibold text-text-primary tabular-nums">{value}</p>
    </Card>
  );
}

function Nothing({ reason }: { reason: "unpublished" | "nobody" }) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-h1 text-text-primary">Field visits</h1>
      <Card flush>
        {reason === "unpublished" ? (
          <EmptyState
            title="Field visit rules aren't published yet."
            body="Publish them in Settings → Field visit rules, and people can start recording visits."
            action={
              <Link href="/admin/settings/field-visits" className="text-label text-brand-primary underline-offset-2 hover:underline">
                Open field visit rules
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="No one's field visits to show you."
            body="You see the visits of your department if you head one, and of the people who report to you."
          />
        )}
      </Card>
    </div>
  );
}
