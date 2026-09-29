"use client";

import { useState, useTransition, type ReactNode } from "react";
import { History } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import type { Status } from "@/lib/status";
import { cn } from "@/lib/cn";

/**
 * Approval card (component-specifications.md §30, decision D-012) — the
 * governance workhorse shared by attendance exceptions, leave requests,
 * task proof review and payroll adjustments.
 *
 * Anatomy: requester → one-sentence request statement → evidence →
 * COMPUTED impact line → decisions → persistent audit line.
 *
 * Rules (Constitution §3):
 * - No silent approvals.
 * - Reject ALWAYS requires a reason; the primary stays disabled until one
 *   exists, with the reason stated.
 * - The impact line is mandatory and computed, never generic.
 * - After a decision the audit line persists on the card.
 */

export type ApprovalDecision = "APPROVED" | "REJECTED" | "DETAILS_REQUESTED";

export interface ApprovalCardProps {
  requesterName: string;
  requesterMeta?: string;
  /** One plain sentence: "Checked in 1.4 km outside the Shivaji Market area at 9:12 AM". */
  statement: string;
  /** Evidence block: reason text, distances, timestamps. */
  evidence?: ReactNode;
  /** Computed impact — "Approving marks this Present. No payroll change." */
  impact: string;
  /** Warning tone when money or attendance changes; neutral when nothing does. */
  impactTone?: "warning" | "neutral";
  statuses?: Status[];
  tone?: "warning" | "error" | "info" | "neutral";
  /** Labels for the three decisions (leave uses paid/unpaid wording). */
  approveLabel?: string;
  secondaryApprove?: { label: string; decision: ApprovalDecision; paid?: boolean };
  onDecide: (input: {
    decision: ApprovalDecision;
    reason?: string;
    paid?: boolean;
  }) => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
  /** Persistent audit line once decided. */
  auditLine?: string;
}

const borderTone = {
  warning: "border-l-status-warning-fg",
  error: "border-l-status-error-fg",
  info: "border-l-status-info-fg",
  neutral: "border-l-status-neutral-fg",
} as const;

export function ApprovalCard({
  requesterName,
  requesterMeta,
  statement,
  evidence,
  impact,
  impactTone = "warning",
  statuses = [],
  tone = "warning",
  approveLabel = "Approve",
  secondaryApprove,
  onDecide,
  auditLine,
}: ApprovalCardProps) {
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [settled, setSettled] = useState<string | null>(auditLine ?? null);

  function decide(decision: ApprovalDecision, paid?: boolean) {
    if (decision === "REJECTED" && !reason.trim()) {
      setRejecting(true);
      return;
    }
    startTransition(async () => {
      const result = await onDecide({
        decision,
        reason: reason.trim() || undefined,
        paid,
      });
      if (result.ok) {
        setSettled(result.message);
        show({ variant: "success", message: result.message });
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  const initials = requesterName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <section
      aria-label={`${requesterName} — ${statement}`}
      className={cn(
        "rounded-surface-card border border-border-default border-l-2 bg-surface-default p-5 shadow-elevation-1",
        borderTone[tone],
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-primary-subtle font-heading text-label text-brand-primary"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-text-primary">
            {requesterName}
          </p>
          {requesterMeta && (
            <p className="text-caption text-text-secondary">{requesterMeta}</p>
          )}
        </div>
        {statuses.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {statuses.map((status) => (
              <StatusChip key={status.key} status={status} size="sm" />
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 text-body text-text-primary">{statement}</p>

      {evidence && (
        <div className="mt-3 rounded-md bg-surface-sunken p-3">{evidence}</div>
      )}

      {/* Computed impact — never collapsed, never generic. */}
      <div className="mt-3">
        <Alert
          variant={impactTone === "warning" ? "warning" : "info"}
          title={impact}
        />
      </div>

      {settled ? (
        <p className="mt-4 flex items-start gap-2 border-t border-border-subtle pt-3 text-caption text-text-secondary">
          <History aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {settled}
        </p>
      ) : (
        <>
          {rejecting && (
            <div className="mt-3">
              <TextArea
                label="Reason"
                required
                placeholder="Tell them what to do next"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="max-w-none"
                error={
                  rejecting && !reason.trim()
                    ? "A reason is required to reject."
                    : undefined
                }
              />
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 md:flex-row">
            <Button
              size="lg"
              loading={pending}
              // When a secondary approval exists it carries `paid: true`,
              // so the primary is the explicit unpaid choice.
              onClick={() => decide("APPROVED", secondaryApprove ? false : undefined)}
              className="md:w-auto"
            >
              {approveLabel}
            </Button>
            {secondaryApprove && (
              <Button
                size="lg"
                variant="secondary"
                loading={pending}
                onClick={() =>
                  decide(secondaryApprove.decision, secondaryApprove.paid)
                }
                className="md:w-auto"
              >
                {secondaryApprove.label}
              </Button>
            )}
            <Button
              size="lg"
              variant="dangerSubtle"
              loading={pending}
              onClick={() => decide("REJECTED")}
              disabled={rejecting && !reason.trim()}
              disabledReason={
                rejecting && !reason.trim()
                  ? "Add a reason to reject."
                  : undefined
              }
              className="md:w-auto"
            >
              Reject
            </Button>
            <Button
              size="lg"
              variant="outline"
              loading={pending}
              onClick={() => decide("DETAILS_REQUESTED")}
              className="md:w-auto"
            >
              Ask for details
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
