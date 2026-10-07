"use client";

import { useRouter } from "next/navigation";
import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { ViewProofFile } from "@/components/tasks/ViewProofFile";
import { STATUS } from "@/lib/status";
import { reviewProofAction } from "@/lib/tasks/actions";
import { proofAnchorId } from "@/lib/tasks/links";

/**
 * Task proof review (screen A9). The impact line names what approving
 * does (copy-deck.md §4): the task becomes Completed and appears in the
 * day's summary and the employee's record. Each file can be opened before
 * deciding — approving proof nobody looked at is no review.
 */
export interface ProofQueueItem {
  taskId: string;
  title: string;
  assignee: string;
  note: string | null;
  files: Array<{ id: string; name: string }>;
  submittedAt: string;
}

export function ProofQueue({ items }: { items: ProofQueueItem[] }) {
  const router = useRouter();

  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        // The bell and the dashboard tile link here (proofReviewHref);
        // the card they point at is outlined.
        <li
          key={item.taskId}
          id={proofAnchorId(item.taskId)}
          className="scroll-mt-20 rounded-surface-card target:ring-2 target:ring-brand-primary"
        >
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
                {item.files.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {item.files.map((file) => (
                      <li key={file.id} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate font-mono text-mono">
                          {file.name}
                        </span>
                        <ViewProofFile fileId={file.id} name={file.name} />
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
              if (result.ok) {
                router.refresh();
              }
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
