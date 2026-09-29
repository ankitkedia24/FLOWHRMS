"use client";

import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { STATUS } from "@/lib/status";
import { decideLeaveAction } from "@/lib/leave/actions";

/**
 * Leave approval queue. Paid and unpaid are two explicit decisions —
 * nothing is silently defaulted (user-flows.md §4).
 */
export interface LeaveQueueItem {
  id: string;
  name: string;
  meta?: string;
  dates: string;
  type: string;
  reason: string;
  days: number;
  impactUnpaid: string;
}

export function LeaveQueue({ items }: { items: LeaveQueueItem[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.id}>
          <ApprovalCard
            requesterName={item.name}
            requesterMeta={item.meta}
            statement={`Requested ${item.type.toLowerCase()} leave for ${item.dates}.`}
            statuses={[STATUS.pendingReview]}
            tone="info"
            impact={item.impactUnpaid}
            impactTone="warning"
            approveLabel="Approve as unpaid"
            secondaryApprove={{
              label: "Approve as paid",
              decision: "APPROVED",
              paid: true,
            }}
            evidence={
              <dl className="flex flex-col gap-1 text-secondary text-text-secondary">
                <div className="flex gap-2">
                  <dt className="font-medium">Dates</dt>
                  <dd className="text-text-primary">{item.dates}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium">Days</dt>
                  <dd className="font-mono text-data text-text-primary tabular-nums">
                    {item.days}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium">Reason</dt>
                  <dd className="text-text-primary">{item.reason}</dd>
                </div>
              </dl>
            }
            onDecide={async ({ decision, reason, paid }) => {
              const result = await decideLeaveAction({
                requestId: item.id,
                decision,
                paid: decision === "APPROVED" ? Boolean(paid) : undefined,
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
