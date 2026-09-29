import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { STATUS, statusLate, type Status } from "@/lib/status";
import {
  describeAttendanceRecord,
  formatClockTime,
  formatDuration,
  workDateInTimezone,
} from "@/lib/attendance/policy";
import {
  AttendanceCalendar,
  type CalendarDay,
} from "@/components/attendance/AttendanceCalendar";

export const metadata: Metadata = { title: "Attendance" };

/** Attendance calendar + history (screens E8 / E9) — own records only. */
export default async function EmployeeAttendancePage() {
  const { session, decision } = await checkAccess({ module: "ATTENDANCE" });
  if (!decision.allowed) redirect("/unauthorized");

  const tz = session.tenant.timezone;
  const today = workDateInTimezone(new Date(), tz);
  const monthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );

  const records = devFixtureOffline()
    ? []
    : await getDb().attendanceRecord.findMany({
        where: {
          tenantId: session.tenant.id,
          membershipId: session.membership.id,
        },
        include: { branch: true },
        orderBy: { workDate: "desc" },
        take: 60,
      });

  /** The status a day should show — text always, colour as support. */
  const statusFor = (record: (typeof records)[number]): Status => {
    if (record.exemptionStatus === "EXEMPTED") return STATUS.exempted;
    if (record.reviewStatus === "PENDING") return STATUS.pendingReview;
    if (record.reviewStatus === "REJECTED") return STATUS.rejected;
    if (record.lateMinutes > 0) return statusLate(record.lateMinutes);
    if (record.checkInAt) return STATUS.present;
    return STATUS.notRecorded;
  };

  const calendarDays: CalendarDay[] = records
    .filter((record) => record.workDate >= monthStart)
    .map((record) => {
      const worked =
        record.checkInAt && record.checkOutAt
          ? (record.checkOutAt.getTime() - record.checkInAt.getTime()) / 60000
          : null;
      return {
        date: record.workDate.toISOString().slice(0, 10),
        status: statusFor(record),
        detail: [
          `In ${record.checkInAt ? formatClockTime(record.checkInAt, tz) : "—"}`,
          `Out ${record.checkOutAt ? formatClockTime(record.checkOutAt, tz) : "—"}`,
          worked != null ? formatDuration(worked) : null,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="mt-2 font-heading text-h1 text-text-primary">
        Attendance
      </h1>

      <AttendanceCalendar
        month={monthStart.toISOString().slice(0, 10)}
        days={calendarDays}
      />

      <section aria-labelledby="history">
        <h2
          id="history"
          className="mb-3 font-heading text-h2 text-text-primary"
        >
          History
        </h2>

        {records.length === 0 ? (
          <Card flush>
            <EmptyState
              warm
              title="No records yet."
              body="Your attendance will appear here after your first check-in."
            />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {records.map((record) => {
              const statuses: Status[] = [statusFor(record)];
              if (record.checkInAt && !record.checkOutAt)
                statuses.push(STATUS.notRecorded);

              const worked =
                record.checkInAt && record.checkOutAt
                  ? (record.checkOutAt.getTime() - record.checkInAt.getTime()) /
                    60000
                  : null;

              // Prefer what the record itself captured, so a renamed
              // location does not change what a past day says.
              const described = describeAttendanceRecord({
                snapshot: record.policySnapshot as never,
                currentBranchName: record.branch?.name,
              });

              return (
                <li key={record.id}>
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-label text-text-primary">
                        {new Intl.DateTimeFormat("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          timeZone: "UTC",
                        }).format(record.workDate)}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {statuses.map((status) => (
                          <StatusChip
                            key={status.key}
                            status={status}
                            size="sm"
                          />
                        ))}
                      </div>
                    </div>

                    <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-data text-text-secondary tabular-nums">
                      <div className="flex gap-1.5">
                        <dt>In</dt>
                        <dd className="text-text-primary">
                          {record.checkInAt
                            ? formatClockTime(record.checkInAt, tz)
                            : "—"}
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt>Out</dt>
                        <dd className="text-text-primary">
                          {record.checkOutAt
                            ? formatClockTime(record.checkOutAt, tz)
                            : "—"}
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt>Hrs</dt>
                        <dd className="text-text-primary">
                          {worked != null ? formatDuration(worked) : "—"}
                        </dd>
                      </div>
                    </dl>

                    {described.branchName && (
                      <p className="mt-1 text-caption text-text-secondary">
                        Recorded at {described.branchName}
                      </p>
                    )}
                    {record.checkInReason && (
                      <p className="mt-1 text-secondary text-text-secondary">
                        Your reason: {record.checkInReason}
                      </p>
                    )}
                    {record.reviewReason && (
                      <p className="mt-1 text-secondary text-text-secondary">
                        Manager&apos;s note: {record.reviewReason}
                      </p>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-caption text-text-secondary">
        Your location is captured only when you check in or out, to confirm
        you were at a permitted place of work.
      </p>
    </div>
  );
}
