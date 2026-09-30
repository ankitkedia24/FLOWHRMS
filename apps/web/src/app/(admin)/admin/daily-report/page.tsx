import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { visibleIds } from "@/lib/authz/scope";
import { loadRecordScope } from "@/lib/authz/record-scope";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { evaluateAccess } from "@/lib/authz/flags";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { notificationChannelStates } from "@/lib/notifications/channels";
import { workDateInTimezone } from "@/lib/attendance/policy";
import { dayBoundsInTimezone } from "@/lib/reports/day";

export const metadata: Metadata = { title: "Daily report" };

/**
 * Daily report (screen A10). The summary is composed only from ENABLED
 * modules (user-flows.md §6); payroll figures are excluded by design.
 * Delivery channels show what they really do (lib/notifications/channels.ts):
 * nothing sends on any of them yet, so each reads "Not available yet"
 * rather than an Enabled that delivers nothing. Scheduled delivery isn't
 * built either — when a channel is, this card needs that too before it
 * can say more.
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
  const now = new Date();
  const workDate = workDateInTimezone(now, tz);
  const today = dayBoundsInTimezone(now, tz);

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
  // A Manager's summary is of their team and themselves (lib/authz/scope.ts).
  const visible = visibleIds(await loadRecordScope(session), session.membership.id);
  const inView = visible ? { membershipId: { in: visible } } : {};
  const tasksInView = visible
    ? { OR: [{ assigneeId: { in: visible } }, { createdById: session.membership.id }] }
    : {};
  const [records, headcount, pendingLeave, tasksDone, tasksOpen] = db
    ? await Promise.all([
        on("ATTENDANCE")
          ? db.attendanceRecord.findMany({
              where: { tenantId: session.tenant.id, workDate, ...inView },
              select: { checkInAt: true, lateMinutes: true, reviewStatus: true },
            })
          : [],
        db.tenantMembership.count({
          where: {
            tenantId: session.tenant.id,
            status: "ACTIVE",
            ...(visible ? { id: { in: visible } } : {}),
          },
        }),
        on("LEAVE")
          ? db.leaveRequest.count({
              where: { tenantId: session.tenant.id, status: "PENDING", ...inView },
            })
          : 0,
        // Completed today — the same company-timezone day the attendance
        // rows above use — not every completion since the company began.
        on("TASKS")
          ? db.task.count({
              where: {
                tenantId: session.tenant.id,
                status: "COMPLETED",
                completedAt: { gte: today.start, lt: today.end },
                ...tasksInView,
              },
            })
          : 0,
        on("TASKS")
          ? db.task.count({
              where: {
                tenantId: session.tenant.id,
                status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
                ...tasksInView,
              },
            })
          : 0,
      ])
    : [[], 0, 0, 0, 0];

  const present = records.filter((r) => r.checkInAt).length;
  const late = records.filter((r) => r.lateMinutes > 0).length;
  const exceptions = records.filter((r) => r.reviewStatus === "PENDING").length;

  // In-app is not a way to send this report: the report is this page.
  const channels = notificationChannelStates(channel).filter((c) => !c.alwaysOn);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-h1 text-text-primary">Daily report</h1>

      <Alert variant="info" title="Scheduled delivery isn't available yet.">
        The summary below is live — open this page whenever you want
        today&apos;s picture. Sending it on a schedule, by email, push, SMS or
        WhatsApp, isn&apos;t available yet.
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
            }).format(now)}
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
                key={item.key}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-body text-text-primary">{item.label}</span>
                <StatusChip status={item.status} size="sm" />
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-border-subtle pt-3 text-caption text-text-secondary">
            None of these can be switched on yet. Requests and decisions still
            reach people in the app&apos;s notifications.
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
