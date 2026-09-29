"use client";

import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { STATUS, statusLate, type Status } from "@/lib/status";
import { reviewAttendanceAction } from "@/lib/attendance/actions";

/**
 * Attendance exception queue (screen A3) — each item is an Approval card
 * with a computed impact line. Approving an outside-area check-in marks it
 * Present with no payroll change (copy-deck.md §4).
 */
export interface ExceptionItem {
  id: string;
  name: string;
  meta?: string;
  checkInTime: string;
  distanceLabel: string | null;
  branchName: string | null;
  outcome: "INSIDE" | "OUTSIDE" | "UNCONFIRMED" | "NOT_REQUIRED" | null;
  reason: string | null;
  lateMinutes: number;
  /** Both versions, when a queued check-in clashed with a saved one. */
  conflictNote: string | null;
  offlineCaptured: boolean;
}

export function ExceptionQueue({ items }: { items: ExceptionItem[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => {
        const statement = item.conflictNote
          ? `Two check-in times for this day.`
          : item.outcome === "OUTSIDE" && item.distanceLabel
            ? `Checked in ${item.distanceLabel} outside the ${item.branchName ?? "branch"} area at ${item.checkInTime}.`
            : `Checked in at ${item.checkInTime} without a confirmed location.`;

        const statuses: Status[] = [STATUS.outsideArea];
        if (item.lateMinutes > 0) statuses.push(statusLate(item.lateMinutes));

        return (
          <li key={item.id}>
            <ApprovalCard
              requesterName={item.name}
              requesterMeta={item.meta}
              statement={statement}
              statuses={statuses}
              tone="warning"
              impact="Approving marks this Present. No payroll change."
              impactTone="neutral"
              evidence={
                <dl className="flex flex-col gap-1 text-secondary text-text-secondary">
                  <div className="flex gap-2">
                    <dt className="font-medium">Time</dt>
                    <dd className="font-mono text-data text-text-primary tabular-nums">
                      {item.checkInTime}
                    </dd>
                  </div>
                  {item.distanceLabel && (
                    <div className="flex gap-2">
                      <dt className="font-medium">Distance</dt>
                      <dd className="font-mono text-data text-text-primary tabular-nums">
                        {item.distanceLabel}
                      </dd>
                    </div>
                  )}
                  {item.offlineCaptured && (
                    <div className="flex gap-2">
                      <dt className="font-medium">Recorded</dt>
                      <dd className="text-text-primary">
                        On the employee&apos;s phone while offline
                      </dd>
                    </div>
                  )}
                  {item.conflictNote && (
                    <div className="flex gap-2">
                      <dt className="font-medium">Both versions</dt>
                      <dd className="text-text-primary">{item.conflictNote}</dd>
                    </div>
                  )}
                  {item.reason && (
                    <div className="flex gap-2">
                      <dt className="font-medium">Reason</dt>
                      <dd className="text-text-primary">{item.reason}</dd>
                    </div>
                  )}
                </dl>
              }
              onDecide={async ({ decision, reason }) => {
                const result = await reviewAttendanceAction({
                  recordId: item.id,
                  decision,
                  reason,
                });
                return result.ok
                  ? { ok: true as const, message: result.message }
                  : { ok: false as const, error: result.error };
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}
