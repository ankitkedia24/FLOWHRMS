import type { Metadata } from "next";
import { describeAction } from "@/lib/activity-labels";
import Link from "next/link";
import { requireAdminArea } from "@/lib/authz/guard";
import { DECIDABLE_STATUSES } from "@/lib/authz/approvals";
import { canSee, decidableWhere, visibleIds } from "@/lib/authz/scope";
import { loadRecordScope } from "@/lib/authz/record-scope";
import { reviewableProofWhere } from "@/lib/tasks/review";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { evaluateAccess } from "@/lib/authz/flags";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { STATUS } from "@/lib/status";
import { workDateInTimezone } from "@/lib/attendance/policy";
import { periodLabel } from "@/lib/payroll/engine";
import { membersOffOn } from "@/lib/attendance/work-calendar";
import { currentPeriod } from "@/lib/payroll/service";
import { cn } from "@/lib/cn";
import { UserPlus } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Admin dashboard (screen A1) — real counts from the tenant's data.
 * Metrics never render a partial number: they are computed server-side
 * before the page streams.
 */
export default async function AdminDashboardPage() {
  const session = await requireAdminArea();
  const entitlements = await loadEntitlements(
    session.tenant.id,
    session.user.id,
  );
  const tz = session.tenant.timezone;

  const attendanceOn = evaluateAccess({
    session,
    entitlements,
    module: "ATTENDANCE",
  }).allowed;
  const leaveOn = evaluateAccess({ session, entitlements, module: "LEAVE" }).allowed;
  const tasksOn = evaluateAccess({ session, entitlements, module: "TASKS" }).allowed;
  const payrollOn =
    evaluateAccess({ session, entitlements, module: "PAYROLL" }).allowed &&
    session.permissions.has("payroll.view");
  // "Recent activity" is a window onto the activity log, which needs the
  // sensitive audit.view permission — the same decision as /admin/activity,
  // so the card and its query exist only for people who could open the log.
  const activityOn = evaluateAccess({
    session,
    entitlements,
    module: "EMPLOYEES",
    permission: "audit.view",
  }).allowed;

  const currentMonth = currentPeriod(tz);
  const currentPeriodLabel = periodLabel(currentMonth, tz);

  const workDate = workDateInTimezone(new Date(), tz);
  const db = devFixtureOffline() ? null : getDb();
  const me = { membershipId: session.membership.id, roleKey: session.membership.roleKey };

  const payrollRun =
    db && payrollOn
      ? await db.payrollRun.findUnique({
          where: {
            tenantId_periodMonth: {
              tenantId: session.tenant.id,
              periodMonth: currentMonth,
            },
          },
          select: { status: true },
        })
      : null;

  // A Manager's dashboard counts their team (and themselves) only, the same
  // people their screens list (lib/authz/scope.ts).
  const scope = await loadRecordScope(session);
  const visible = visibleIds(scope, session.membership.id);
  const inView = visible ? { membershipId: { in: visible } } : {};

  const [headcount, records, pendingExceptions, pendingLeave, openTasks, proofToReview, activity] =
    db
      ? await Promise.all([
          db.tenantMembership.count({
            where: {
              tenantId: session.tenant.id,
              status: "ACTIVE",
              ...(visible ? { id: { in: visible } } : {}),
            },
          }),
          attendanceOn
            ? db.attendanceRecord.findMany({
                where: { tenantId: session.tenant.id, workDate, ...inView },
                select: {
                  membershipId: true,
                  checkInAt: true,
                  lateMinutes: true,
                  reviewStatus: true,
                },
              })
            : [],
          // The same items the review queues offer: still decidable, in
          // scope, and not your own unless you are an Owner.
          attendanceOn
            ? db.attendanceRecord.count({
                where: {
                  tenantId: session.tenant.id,
                  reviewStatus: { in: [...DECIDABLE_STATUSES] },
                  ...decidableWhere(me, scope),
                },
              })
            : 0,
          leaveOn
            ? db.leaveRequest.count({
                where: {
                  tenantId: session.tenant.id,
                  status: { in: [...DECIDABLE_STATUSES] },
                  ...decidableWhere(me, scope),
                },
              })
            : 0,
          tasksOn
            ? db.task.count({
                where: {
                  tenantId: session.tenant.id,
                  status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
                  ...(visible
                    ? {
                        OR: [
                          { assigneeId: { in: visible } },
                          { createdById: session.membership.id },
                        ],
                      }
                    : {}),
                },
              })
            : 0,
          tasksOn
            ? db.task.count({
                where: {
                  tenantId: session.tenant.id,
                  status: "SUBMITTED_FOR_REVIEW",
                  ...reviewableProofWhere(me, scope),
                },
              })
            : 0,
          activityOn
            ? db.auditEvent.findMany({
                where: {
                  tenantId: session.tenant.id,
                  ...(visible
                    ? { actor: { memberships: { some: { id: { in: visible } } } } }
                    : {}),
                },
                orderBy: { createdAt: "desc" },
                take: 6,
                include: { actor: true },
              })
            : [],
        ])
      : [0, [], 0, 0, 0, 0, []];

  const presentIds = new Set(
    records.filter((r) => r.checkInAt).map((r) => r.membershipId),
  );
  const present = presentIds.size;
  const late = records.filter((r) => r.lateMinutes > 0).length;
  // Nobody is "not recorded" on their day off (weekly off or holiday).
  const offToday =
    db && attendanceOn
      ? await membersOffOn(session.tenant.id, workDate)
      : new Set<string>();
  const offAndAbsent = [...offToday].filter(
    (id) => !presentIds.has(id) && canSee(scope, session.membership.id, id),
  ).length;
  const notRecorded = Math.max(0, headcount - present - offAndAbsent);

  const metrics = attendanceOn
    ? [
        { label: "Present", value: present, dot: "bg-status-success-fg" },
        { label: "Late", value: late, dot: "bg-status-warning-fg" },
        { label: "Not recorded", value: notRecorded, dot: "bg-status-neutral-fg" },
        { label: "Needs review", value: pendingExceptions, dot: "bg-status-warning-fg" },
      ]
    : [];

  const reviewItems = [
    attendanceOn && {
      label: "Attendance exceptions",
      count: pendingExceptions,
      href: "/admin/attendance",
    },
    leaveOn && { label: "Leave requests", count: pendingLeave, href: "/admin/leave" },
    tasksOn && { label: "Task proof", count: proofToReview, href: "/admin/tasks" },
  ].filter(Boolean) as Array<{ label: string; count: number; href: string }>;

  const totalToReview = reviewItems.reduce((sum, item) => sum + item.count, 0);
  const canAddPeople = session.permissions.has("employees.manage");

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-h1 text-text-primary">Dashboard</h1>

      {/* Right after sign-up, adding people is the job. A slim bar, not a
          card: always one tap away, never in the way of the numbers. */}
      {canAddPeople && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-surface-card border border-brand-primary-subtle bg-brand-primary-subtle px-4 py-2.5">
          <p className="flex min-w-0 items-center gap-2.5 text-body text-text-primary">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-default text-brand-primary"
            >
              <UserPlus className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="font-semibold">
                {headcount <= 1 ? "Add your team" : "Add more people"}
              </span>{" "}
              <span className="text-text-secondary">
                · {headcount} {headcount === 1 ? "person" : "people"} in {session.tenant.name} so far
              </span>
            </span>
          </p>
          <Link
            href="/admin/employees/new"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-button bg-brand-primary px-4 text-label text-text-on-primary hover:bg-brand-primary-hover"
          >
            <UserPlus className="size-4" aria-hidden="true" />
            Add employee
          </Link>
        </div>
      )}

      {attendanceOn && (
        <section aria-label="Attendance today">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {metrics.map((metric) => (
              <Card key={metric.label}>
                <p className="flex items-center gap-2 text-label text-text-secondary">
                  <span
                    aria-hidden="true"
                    className={cn("size-1.5 rounded-pill", metric.dot)}
                  />
                  {metric.label}
                </p>
                <p className="mt-1 font-mono text-data-lg font-semibold text-text-primary tabular-nums">
                  {metric.value}
                </p>
                <p className="text-caption text-text-tertiary">
                  of {headcount} {headcount === 1 ? "employee" : "employees"}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card flush>
          <div className="p-5 pb-0">
            <CardHeader title="Needs your review" />
          </div>
          {totalToReview === 0 ? (
            <EmptyState
              title="No exceptions to review."
              body="Attendance for today is clear."
            />
          ) : (
            <ul className="flex flex-col p-5 pt-0">
              {reviewItems
                .filter((item) => item.count > 0)
                .map((item) => (
                  <li
                    key={item.href}
                    className="flex items-center justify-between gap-3 border-b border-border-subtle py-3 last:border-0"
                  >
                    <Link
                      href={item.href}
                      className="text-body font-medium text-brand-primary underline-offset-2 hover:underline"
                    >
                      {item.label}
                    </Link>
                    <span className="font-mono text-data font-semibold text-text-primary tabular-nums">
                      {item.count}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          {tasksOn && (
            <Card>
              <CardHeader title="Open tasks" />
              <p className="font-mono text-data-lg font-semibold text-text-primary tabular-nums">
                {openTasks}
              </p>
              <p className="text-caption text-text-secondary">
                Not started or in progress
              </p>
            </Card>
          )}

          {payrollOn && (
            <Card>
              <CardHeader
                title={`${currentPeriodLabel} payroll`}
                action={
                  <StatusChip
                    status={
                      payrollRun?.status === "APPROVED"
                        ? STATUS.locked
                        : payrollRun
                          ? STATUS.draft
                          : STATUS.notReady
                    }
                    size="sm"
                  />
                }
              />
              <p className="text-secondary text-text-secondary">
                {payrollRun?.status === "APPROVED"
                  ? "Approved and locked. Later changes need an auditable adjustment."
                  : payrollRun
                    ? "Calculated but not approved. Review the figures before approving."
                    : "Not yet calculated. Payroll uses approved attendance and leave for the period."}
              </p>
              <Link
                href="/admin/payroll"
                className="mt-3 inline-block text-label text-brand-primary underline-offset-2 hover:underline"
              >
                Open payroll
              </Link>
            </Card>
          )}

          {activityOn && (
            <Card flush>
              <div className="p-5 pb-0">
                <CardHeader title="Recent activity" />
              </div>
              {activity.length === 0 ? (
                <EmptyState
                  title="No activity yet."
                  body="Configuration and approval events will appear here."
                />
              ) : (
                <ul className="flex flex-col p-5 pt-0">
                  {activity.map((event) => (
                    <li
                      key={event.id}
                      className="border-b border-border-subtle py-2.5 last:border-0"
                    >
                      <p className="text-secondary text-text-primary">
                        {describeAction(event.action)}
                      </p>
                      <p className="font-mono text-mono text-text-tertiary uppercase">
                        {event.actor?.displayName ?? "System"} ·{" "}
                        {new Intl.DateTimeFormat("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                          timeZone: tz,
                        }).format(event.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
