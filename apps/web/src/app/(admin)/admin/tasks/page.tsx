import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { PRIORITY, STATUS } from "@/lib/status";
import { evaluateAccess } from "@/lib/authz/flags";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { CreateTaskPanel } from "./CreateTaskPanel";
import { ProofQueue } from "./ProofQueue";
import { BranchFilter } from "@/components/filters/BranchFilter";
import {
  branchName,
  loadBranchOptions,
  resolveBranchFilter,
} from "@/lib/branches/scope";

export const metadata: Metadata = { title: "Tasks" };

const statusFor = {
  NOT_STARTED: STATUS.notStarted,
  IN_PROGRESS: STATUS.inProgress,
  SUBMITTED_FOR_REVIEW: STATUS.submittedForReview,
  COMPLETED: STATUS.completed,
} as const;

const priorityFor = {
  HIGH: PRIORITY.high,
  MEDIUM: PRIORITY.medium,
  LOW: PRIORITY.low,
} as const;

/** Task list + create + proof review (screens A7/A8/A9). */
export default async function AdminTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const { session, decision } = await checkAccess({
    module: "TASKS",
    permission: "tasks.view",
  });
  if (!decision.allowed) redirect("/unauthorized");

  // A task has no location of its own, so filter by where its assignee
  // works. Validated against this tenant's locations before use.
  const params = await searchParams;
  const branchOptions = await loadBranchOptions(session.tenant.id);
  const branchFilter = resolveBranchFilter(
    params.branch,
    new Set(branchOptions.map((b) => b.id)),
  );
  const selectedBranchName = branchName(branchFilter, branchOptions);
  const assigneeWhere = branchFilter
    ? { assignee: { branchId: branchFilter } }
    : {};

  const canManage = session.permissions.has("tasks.manage");
  const tz = session.tenant.timezone;
  const entitlements = await loadEntitlements(
    session.tenant.id,
    session.user.id,
  );
  const photoProofOn = evaluateAccess({
    session,
    entitlements,
    module: "TASKS",
    feature: "proof_photo",
  }).allowed;
  const fileProofOn = evaluateAccess({
    session,
    entitlements,
    module: "TASKS",
    feature: "proof_file",
  }).allowed;

  const [tasks, assignees, awaitingReview] = devFixtureOffline()
    ? [[], [], []]
    : await Promise.all([
        getDb().task.findMany({
          where: { tenantId: session.tenant.id, ...assigneeWhere },
          include: { assignee: { include: { user: true } } },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          take: 50,
        }),
        getDb().tenantMembership.findMany({
          where: {
            tenantId: session.tenant.id,
            status: "ACTIVE",
            ...(branchFilter ? { branchId: branchFilter } : {}),
          },
          include: { user: true },
          orderBy: { createdAt: "asc" },
        }),
        getDb().task.findMany({
          where: {
            tenantId: session.tenant.id,
            status: "SUBMITTED_FOR_REVIEW",
            ...assigneeWhere,
          },
          include: {
            assignee: { include: { user: true } },
            proofs: {
              orderBy: { submittedAt: "desc" },
              take: 1,
              include: { files: true },
            },
          },
          take: 25,
        }),
      ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">Tasks</h1>
        <BranchFilter options={branchOptions} selected={branchFilter} />
      </div>

      {canManage && (
        <CreateTaskPanel
          assignees={assignees.map((m) => ({
            id: m.id,
            name: m.user.displayName,
          }))}
          photoProofOn={photoProofOn}
          fileProofOn={fileProofOn}
        />
      )}

      {awaitingReview.length > 0 && canManage && (
        <section aria-labelledby="proof-review">
          <h2
            id="proof-review"
            className="mb-3 font-heading text-h2 text-text-primary"
          >
            Proof to review ({awaitingReview.length})
          </h2>
          <ProofQueue
            items={awaitingReview.map((task) => ({
              taskId: task.id,
              title: task.title,
              assignee: task.assignee.user.displayName,
              note: task.proofs[0]?.note ?? null,
              fileNames: task.proofs[0]?.files.map((f) => f.name) ?? [],
              submittedAt: task.proofs[0]
                ? new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                    timeZone: tz,
                  }).format(task.proofs[0].submittedAt)
                : "",
            }))}
          />
        </section>
      )}

      <section aria-labelledby="all-tasks">
        <h2
          id="all-tasks"
          className="mb-3 font-heading text-h2 text-text-primary"
        >
          All tasks
        </h2>

        {tasks.length === 0 ? (
          <Card flush>
            <EmptyState
              title={
                selectedBranchName
                  ? `No tasks for ${selectedBranchName}.`
                  : "No tasks yet."
              }
              body={
                selectedBranchName
                  ? "Other locations may still have tasks."
                  : "Assign the first task to see it here."
              }
            />
          </Card>
        ) : (
          <>
            {/* Mobile: stacked cards. */}
            <ul className="flex flex-col gap-3 md:hidden">
              {tasks.map((task) => (
                <li key={task.id}>
                  <Card>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip status={priorityFor[task.priority]} size="sm" />
                      <StatusChip status={statusFor[task.status]} size="sm" />
                    </div>
                    <p className="mt-2 text-body font-semibold text-text-primary">
                      {task.title}
                    </p>
                    <p className="text-secondary text-text-secondary">
                      {task.assignee.user.displayName}
                      {task.dueDate &&
                        ` · due ${new Intl.DateTimeFormat("en-GB", {
                          day: "numeric",
                          month: "short",
                          timeZone: tz,
                        }).format(task.dueDate)}`}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>

            {/* md+: table. */}
            <div className="hidden overflow-hidden rounded-surface-card border border-border-default bg-surface-default shadow-elevation-1 md:block">
              <table className="w-full border-collapse">
                <caption className="sr-only">All tasks</caption>
                <thead>
                  <tr className="bg-surface-sunken">
                    <th scope="col" className="micro-label px-4 py-2.5 text-left text-text-tertiary">
                      Task
                    </th>
                    <th scope="col" className="micro-label px-4 py-2.5 text-left text-text-tertiary">
                      Assignee
                    </th>
                    <th scope="col" className="micro-label px-4 py-2.5 text-right text-text-tertiary">
                      Due
                    </th>
                    <th scope="col" className="micro-label px-4 py-2.5 text-left text-text-tertiary">
                      Priority
                    </th>
                    <th scope="col" className="micro-label px-4 py-2.5 text-left text-text-tertiary">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr
                      key={task.id}
                      className="border-t border-border-subtle hover:bg-surface-sunken"
                    >
                      <th
                        scope="row"
                        className="px-4 py-2.5 text-left text-body font-semibold text-text-primary"
                      >
                        {task.title}
                      </th>
                      <td className="px-4 py-2.5 text-body">
                        {task.assignee.user.displayName}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-data tabular-nums">
                        {task.dueDate
                          ? new Intl.DateTimeFormat("en-GB", {
                              day: "numeric",
                              month: "short",
                              timeZone: tz,
                            }).format(task.dueDate)
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusChip status={priorityFor[task.priority]} size="sm" />
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusChip status={statusFor[task.status]} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
