import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { PRIORITY, STATUS } from "@/lib/status";
import { TaskActions } from "./TaskActions";

export const metadata: Metadata = { title: "Task" };

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

/** Task details + proof submission (screens E13/E14). */
export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const { session, decision } = await checkAccess({ module: "TASKS" });
  if (!decision.allowed) redirect("/unauthorized");
  if (devFixtureOffline()) notFound();

  const task = await getDb().task.findFirst({
    where: {
      id: taskId,
      tenantId: session.tenant.id,
      assigneeId: session.membership.id, // own tasks only
    },
    include: {
      createdBy: { include: { user: true } },
      proofs: {
        orderBy: { submittedAt: "desc" },
        include: { files: true },
      },
    },
  });
  if (!task) notFound();

  const tz = session.tenant.timezone;
  const latestProof = task.proofs[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="mt-2 flex flex-wrap gap-2">
        <StatusChip status={priorityFor[task.priority]} size="sm" />
        <StatusChip status={statusFor[task.status]} size="sm" />
      </div>

      <h1 className="font-heading text-h1 text-text-primary">{task.title}</h1>

      <Card>
        {task.description && (
          <p className="text-body-lg text-text-primary">{task.description}</p>
        )}
        <dl className="mt-3 flex flex-col gap-2 border-t border-border-subtle pt-3">
          <div className="flex justify-between gap-3">
            <dt className="text-secondary text-text-secondary">From</dt>
            <dd className="text-body text-text-primary">
              {task.createdBy.user.displayName}
            </dd>
          </div>
          {task.dueDate && (
            <div className="flex justify-between gap-3">
              <dt className="text-secondary text-text-secondary">Due</dt>
              <dd className="font-mono text-data text-text-primary tabular-nums">
                {new Intl.DateTimeFormat("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: tz,
                }).format(task.dueDate)}
              </dd>
            </div>
          )}
          {task.proofRequirement !== "NONE" && (
            <div className="flex justify-between gap-3">
              <dt className="text-secondary text-text-secondary">Proof</dt>
              <dd className="text-body text-text-primary">
                {task.proofRequirement === "PHOTO"
                  ? "Photo proof required"
                  : "File proof required"}
              </dd>
            </div>
          )}
        </dl>
      </Card>

      {task.status !== "COMPLETED" && (
        <TaskActions
          taskId={task.id}
          status={task.status}
          proofRequirement={task.proofRequirement}
          managerName={task.createdBy.user.displayName}
        />
      )}

      {task.proofs.length > 0 && (
        <Card>
          <CardHeader title="What you sent" />
          <ul className="flex flex-col gap-3">
            {task.proofs.map((proof) => (
              <li key={proof.id} className="border-t border-border-subtle pt-3 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-mono text-text-tertiary uppercase">
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                      timeZone: tz,
                    }).format(proof.submittedAt)}
                  </p>
                  <StatusChip
                    status={
                      proof.decision === "APPROVED"
                        ? STATUS.approved
                        : proof.decision === "REJECTED"
                          ? STATUS.rejected
                          : proof.decision === "DETAILS_REQUESTED"
                            ? STATUS.needsReview
                            : STATUS.pendingReview
                    }
                    size="sm"
                  />
                </div>
                {proof.note && (
                  <p className="mt-1 text-secondary text-text-secondary">
                    {proof.note}
                  </p>
                )}
                {proof.files.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-1">
                    {proof.files.map((file) => (
                      <li
                        key={file.id}
                        className="text-caption text-text-secondary"
                      >
                        {file.name} · {(file.sizeBytes / 1024).toFixed(0)} KB
                      </li>
                    ))}
                  </ul>
                )}
                {proof.decisionReason && (
                  <p className="mt-1 text-secondary text-text-secondary">
                    Manager&apos;s note: {proof.decisionReason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {latestProof?.decision === "PENDING" && (
        <p className="text-caption text-text-secondary">
          Your photo shows the time and nearest place it was taken.{" "}
          {task.createdBy.user.displayName} will review it.
        </p>
      )}
    </div>
  );
}
