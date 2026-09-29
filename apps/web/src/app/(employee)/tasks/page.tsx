import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskCard } from "@/components/tasks/TaskCard";
import { workDateInTimezone } from "@/lib/attendance/policy";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Tasks" };

type TabKey = "today" | "open" | "review" | "done";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "open", label: "Open" },
  { key: "review", label: "In review" },
  { key: "done", label: "Done" },
];

/**
 * My tasks (screen E12). Tab state lives in the URL so a view can be
 * shared, and counts are always shown for queues.
 */
export default async function EmployeeTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { session, decision } = await checkAccess({ module: "TASKS" });
  if (!decision.allowed) redirect("/unauthorized");

  const params = await searchParams;
  const active: TabKey = TABS.some((t) => t.key === params.tab)
    ? (params.tab as TabKey)
    : "today";

  const tasks = devFixtureOffline()
    ? []
    : await getDb().task.findMany({
        where: {
          tenantId: session.tenant.id,
          assigneeId: session.membership.id,
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 100,
      });

  const today = workDateInTimezone(new Date(), session.tenant.timezone);

  const buckets: Record<TabKey, typeof tasks> = {
    today: tasks.filter(
      (task) =>
        task.status !== "COMPLETED" &&
        task.dueDate != null &&
        task.dueDate <= today,
    ),
    open: tasks.filter(
      (task) => task.status === "NOT_STARTED" || task.status === "IN_PROGRESS",
    ),
    review: tasks.filter((task) => task.status === "SUBMITTED_FOR_REVIEW"),
    done: tasks.filter((task) => task.status === "COMPLETED"),
  };

  const shown = buckets[active];

  const emptyCopy: Record<TabKey, { title: string; body: string }> = {
    today: {
      title: "No tasks today.",
      body: "New tasks from your manager will appear here.",
    },
    open: {
      title: "Nothing open.",
      body: "Everything assigned to you is done or in review.",
    },
    review: {
      title: "Nothing in review.",
      body: "Work you send for review will wait here until your manager looks at it.",
    },
    done: {
      title: "Nothing finished yet.",
      body: "Completed tasks stay here so you can look back at them.",
    },
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mt-2 font-heading text-h1 text-text-primary">My tasks</h1>

      {/* Scrollable tab row, max 5, counts always shown for queues. */}
      <div
        role="tablist"
        aria-label="Task filters"
        className="-mx-5 flex gap-1 overflow-x-auto px-5 pb-1"
      >
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const count = buckets[tab.key].length;
          return (
            <Link
              key={tab.key}
              href={tab.key === "today" ? "/tasks" : `/tasks?tab=${tab.key}`}
              role="tab"
              aria-selected={isActive}
              scroll={false}
              className={cn(
                "inline-flex min-h-12 shrink-0 items-center gap-1.5 border-b-2 px-3 text-label",
                isActive
                  ? "border-brand-primary text-brand-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary",
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className="rounded-pill bg-surface-sunken px-1.5 font-mono text-mono tabular-nums">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <Card flush>
          <EmptyState
            warm
            title={emptyCopy[active].title}
            body={emptyCopy[active].body}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                timezone={session.tenant.timezone}
                href={`/tasks/${task.id}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
