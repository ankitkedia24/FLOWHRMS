"use client";

import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { STATUS } from "@/lib/status";
import { reviewProofAction } from "@/lib/tasks/actions";

/**
 * Task proof review (screen A9). The impact line names what approving
 * does (copy-deck.md §4): the task becomes Completed and appears in the
 * day's summary and the employee's record.
 */
export interface ProofQueueItem {
  taskId: string;
  title: string;
  assignee: string;
  note: string | null;
  fileNames: string[];
  submittedAt: string;
}

export function ProofQueue({ items }: { items: ProofQueueItem[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.taskId}>
          <ApprovalCard
            requesterName={item.assignee}
            requesterMeta={`Submitted ${item.submittedAt}`}
            statement={`Submitted proof for "${item.title}".`}
            statuses={[STATUS.submittedForReview]}
            tone="info"
            impact={`Approving marks this task Completed. It will appear in today's summary and in ${item.assignee}'s task record.`}
            impactTone="neutral"
            approveLabel="Approve completion"
            evidence={
              <div className="flex flex-col gap-1 text-secondary text-text-secondary">
                {item.note && (
                  <p className="text-text-primary">{item.note}</p>
                )}
                {item.fileNames.length > 0 ? (
                  <ul className="flex flex-col gap-0.5">
                    {item.fileNames.map((name) => (
                      <li key={name} className="font-mono text-mono">
                        {name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No files attached.</p>
                )}
              </div>
            }
            onDecide={async ({ decision, reason }) => {
              const result = await reviewProofAction({
                taskId: item.taskId,
                decision,
                reason,
              });
              return result.ok
                ? { ok: true as const, message: result.message }
                : { ok: false as const, error: result.error };
            }}
          />
        </li>
      ))}
    </ul>
  );
}
