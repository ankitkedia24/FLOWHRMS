import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { evaluateAccess } from "@/lib/authz/flags";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { STATUS } from "@/lib/status";
import { workDateInTimezone } from "@/lib/attendance/policy";

export const metadata: Metadata = { title: "Daily report" };

/**
 * Daily report (screen A10). The summary is composed only from ENABLED
 * modules (user-flows.md §6); payroll figures are excluded by design.
 * Channels that are not configured show as Off — never silently failed.
 */
export default async function AdminDailyReportPage() {
  const { session, decision } = await checkAccess({
    module: "DAILY_REPORTING",
    permission: "reports.view",
  });
  if (!decision.allowed) redirect("/unauthorized");

  const entitlements = await loadEntitlements(
    session.tenant.id,
    session.user.id,
  );
  const tz = session.tenant.timezone;
  const workDate = workDateInTimezone(new Date(), tz);

  const on = (module: "ATTENDANCE" | "LEAVE" | "TASKS") =>
    evaluateAccess({ session, entitlements, module }).allowed;
  const channel = (feature: string) =>
    evaluateAccess({
      session,
      entitlements,
      module: "NOTIFICATIONS",
      feature,
    }).allowed;

  const db = devFixtureOffline() ? null : getDb();
  const [records, headcount, pendingLeave, tasksDone, tasksOpen] = db
    ? await Promise.all([
        on("ATTENDANCE")
          ? db.attendanceRecord.findMany({
              where: { tenantId: session.tenant.id, workDate },
              select: { checkInAt: true, lateMinutes: true, reviewStatus: true },
            })
          : [],
        db.tenantMembership.count({
          where: { tenantId: session.tenant.id, status: "ACTIVE" },
        }),
        on("LEAVE")
          ? db.leaveRequest.count({
              where: { tenantId: session.tenant.id, status: "PENDING" },
            })
          : 0,
        on("TASKS")
          ? db.task.count({
              where: { tenantId: session.tenant.id, status: "COMPLETED" },
            })
          : 0,
        on("TASKS")
          ? db.task.count({
              where: {
                tenantId: session.tenant.id,
                status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
              },
            })
          : 0,
      ])
    : [[], 0, 0, 0, 0];

  const present = records.filter((r) => r.checkInAt).length;
  const late = records.filter((r) => r.lateMinutes > 0).length;
  const exceptions = records.filter((r) => r.reviewStatus === "PENDING").length;

  const channels = [
    { name: "Email", on: channel("email") },
    { name: "Push", on: channel("push") },
    { name: "WhatsApp", on: channel("whatsapp") },
    { name: "SMS", on: channel("sms") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-h1 text-text-primary">Daily report</h1>

      <Alert variant="info" title="Scheduled delivery is not switched on yet.">
        The summary below is live. Automatic delivery on a schedule arrives
        with the notification providers — a channel that is not configured is
        shown as Off and is never silently failed.
      </Alert>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Today's summary"
            meta={new Intl.DateTimeFormat("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: tz,
            }).format(new Date())}
          />
          <dl className="flex flex-col gap-2">
            {on("ATTENDANCE") && (
              <>
                <Row label="Present" value={`${present} of ${headcount}`} />
                <Row label="Late" value={String(late)} />
                <Row label="Exceptions to review" value={String(exceptions)} />
              </>
            )}
            {on("LEAVE") && (
              <Row label="Leave awaiting approval" value={String(pendingLeave)} />
            )}
            {on("TASKS") && (
              <>
                <Row label="Tasks completed" value={String(tasksDone)} />
                <Row label="Tasks open" value={String(tasksOpen)} />
              </>
            )}
          </dl>
          <p className="mt-3 border-t border-border-subtle pt-3 text-caption text-text-secondary">
            Payroll figures are excluded from daily summaries by design.
          </p>
        </Card>

        <Card>
          <CardHeader title="Delivery channels" />
          <ul className="flex flex-col gap-3">
            {channels.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-body text-text-primary">{item.name}</span>
                <StatusChip
                  status={item.on ? STATUS.enabled : STATUS.disabled}
                  size="sm"
                />
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-border-subtle pt-3 text-caption text-text-secondary">
            SMS and WhatsApp need a provider in Company settings before they
            can be switched on.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2 last:border-0">
      <dt className="text-secondary text-text-secondary">{label}</dt>
      <dd className="font-mono text-data font-medium text-text-primary tabular-nums">
        {value}
      </dd>
    </div>
  );
}
