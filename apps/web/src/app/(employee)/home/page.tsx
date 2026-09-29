import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/authz/guard";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { evaluateAccess } from "@/lib/authz/flags";
import { loadAttendanceContext } from "@/lib/attendance/service";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { AttendanceActionCard } from "@/components/attendance/AttendanceActionCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskCard } from "@/components/tasks/TaskCard";
import { LevelRing } from "@/components/performance/LevelRing";
import { StreakFlame } from "@/components/performance/StreakFlame";
import { loadPerformanceSummary } from "@/lib/performance/summary";
import { loadFieldHome } from "@/lib/field-visits/service";
import { FieldVisitCard } from "@/components/field-visits/FieldVisitCard";

export const metadata: Metadata = { title: "Home" };

/** Time-of-day greeting in the tenant's timezone (copy-deck.md §5). */
function greeting(timezone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Employee home (screen E3): attendance action + today's tasks. */
export default async function EmployeeHomePage() {
  const session = await requireSession();
  const firstName = session.user.displayName.split(/\s+/)[0];
  const entitlements = await loadEntitlements(
    session.tenant.id,
    session.user.id,
  );

  const attendanceOn = evaluateAccess({
    session,
    entitlements,
    module: "ATTENDANCE",
  }).allowed;
  const tasksOn = evaluateAccess({
    session,
    entitlements,
    module: "TASKS",
  }).allowed;

  const attendance = attendanceOn
    ? await loadAttendanceContext(session)
    : null;

  // Field visits live inside the working day (FIELD-VISITS-MODULE.md §3);
  // null for owners, for people outside its scope, and where it is off.
  const field = attendance ? await loadFieldHome(session) : null;
  const fieldOut =
    field?.phase === "AT_PLACE" && field.visit
      ? `Checking out also ends your visit at ${field.visit.placeName} and your trip.`
      : field?.phase === "OUT"
        ? "Checking out also ends your trip."
        : null;

  // The motivation widget (PERFORMANCE-MODULE.md §B): streak flame,
  // today's points, level ring — the first thing seen after check-in.
  // Same loader as My Performance, so the two can never disagree.
  const performance = devFixtureOffline()
    ? null
    : await loadPerformanceSummary(session);

  const tasks =
    tasksOn && !devFixtureOffline()
      ? await getDb().task.findMany({
          where: {
            tenantId: session.tenant.id,
            assigneeId: session.membership.id,
            status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
          },
          orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          take: 3,
        })
      : [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mt-2 font-heading text-h1 text-text-primary">
        {greeting(session.tenant.timezone)}, {firstName}
      </h1>

      {attendance && (
        <section aria-label="Attendance today">
          <AttendanceActionCard context={attendance} firstName={firstName} fieldOut={fieldOut} />
        </section>
      )}

      {field && (
        <section aria-label="Field visits">
          <FieldVisitCard home={field} />
        </section>
      )}

      {performance?.published && (
        <section aria-label="Your points">
          <Link href="/performance" className="block">
            <Card className="transition-shadow hover:shadow-elevation-2">
              {performance.boost && (
                <p className="mb-3 rounded-input bg-[color:var(--fh-color-status-warning-bg)] px-3 py-2 text-caption font-semibold text-status-warning-fg">
                  ×{performance.boost.multiplier} points — {performance.boost.name}
                </p>
              )}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-3">
                  <StreakFlame days={performance.streak} />
                  <div>
                    <p className="font-mono text-data font-semibold text-text-primary tabular-nums">
                      +{performance.todayPoints.toLocaleString("en-IN")}
                    </p>
                    <p className="text-caption text-text-secondary">points today</p>
                  </div>
                </div>
                <LevelRing
                  level={performance.level}
                  totalPoints={performance.totalPoints}
                  size={96}
                />
              </div>
            </Card>
          </Link>
        </section>
      )}

      {tasksOn && (
        <section aria-labelledby="today-tasks">
          <div className="mb-2 flex items-baseline justify-between">
            <h2
              id="today-tasks"
              className="font-heading text-h2 text-text-primary"
            >
              Today&apos;s tasks
            </h2>
            {tasks.length > 0 && (
              <Link
                href="/tasks"
                className="text-label text-brand-primary underline-offset-2 hover:underline"
              >
                View all
              </Link>
            )}
          </div>

          {tasks.length === 0 ? (
            <Card flush>
              <EmptyState
                warm
                title="No tasks today."
                body="New tasks from your manager will appear here."
              />
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {tasks.map((task) => (
                <li key={task.id}>
                  <TaskCard
                    task={{
                      id: task.id,
                      title: task.title,
                      priority: task.priority,
                      status: task.status,
                      dueDate: task.dueDate,
                      proofRequirement: task.proofRequirement,
                    }}
                    timezone={session.tenant.timezone}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
