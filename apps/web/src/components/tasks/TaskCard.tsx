import Link from "next/link";
import { Paperclip } from "lucide-react";
import { StatusChip } from "@/components/ui/StatusChip";
import { PRIORITY, STATUS, statusOverdueDays, type Status } from "@/lib/status";
import { cn } from "@/lib/cn";

/**
 * Task card (component-specifications.md §29).
 * Priority is a word plus colour, never colour alone. A task requiring
 * proof states that in text, not just an icon. Tapping the card opens
 * details; the action is a separate hit area in the footer.
 */
export interface TaskCardData {
  id: string;
  title: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED_FOR_REVIEW" | "COMPLETED";
  dueDate: Date | null;
  proofRequirement: "NONE" | "PHOTO" | "FILE";
}

const statusFor: Record<TaskCardData["status"], Status> = {
  NOT_STARTED: STATUS.notStarted,
  IN_PROGRESS: STATUS.inProgress,
  SUBMITTED_FOR_REVIEW: STATUS.submittedForReview,
  COMPLETED: STATUS.completed,
};

const priorityFor = {
  HIGH: PRIORITY.high,
  MEDIUM: PRIORITY.medium,
  LOW: PRIORITY.low,
} as const;

/** Whole days a due date is past, in the tenant's timezone. */
function overdueDays(dueDate: Date, timeZone: string): number {
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone,
    }).format(d);
  const today = new Date(`${dayKey(new Date())}T00:00:00Z`).getTime();
  const due = new Date(`${dayKey(dueDate)}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((today - due) / 86_400_000));
}

export function TaskCard({
  task,
  timezone,
  href,
  footer,
}: {
  task: TaskCardData;
  timezone: string;
  href?: string;
  footer?: React.ReactNode;
}) {
  const late =
    task.dueDate && task.status !== "COMPLETED"
      ? overdueDays(task.dueDate, timezone)
      : 0;

  return (
    <div
      className={cn(
        "rounded-surface-card border border-border-default bg-surface-default p-4 shadow-elevation-1",
        late > 0 && "border-l-2 border-l-status-error-fg",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={priorityFor[task.priority]} size="sm" />
        <StatusChip status={statusFor[task.status]} size="sm" />
        {late > 0 && (
          <StatusChip
            status={late === 1 ? statusOverdueDays(1) : STATUS.overdue}
            size="sm"
          />
        )}
      </div>

      <h3 className="mt-2 font-heading text-h3 text-text-primary">
        {href ? (
          <Link href={href} className="hover:underline underline-offset-2">
            {task.title}
          </Link>
        ) : (
          task.title
        )}
      </h3>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        {task.dueDate && (
          <p className="font-mono text-data text-text-secondary tabular-nums">
            Due{" "}
            {new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: timezone,
            }).format(task.dueDate)}
          </p>
        )}
        {task.proofRequirement !== "NONE" && (
          <p className="inline-flex items-center gap-1.5 text-caption text-text-secondary">
            <Paperclip aria-hidden="true" className="size-4" />
            {task.proofRequirement === "PHOTO"
              ? "Photo proof required"
              : "File proof required"}
          </p>
        )}
      </div>

      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}
