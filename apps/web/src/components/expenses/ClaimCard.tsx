import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatAmount, formatExpenseDate } from "@/lib/expenses/format";
import type { ClaimListRow } from "@/lib/expenses/queries";
import { claimRef } from "@/lib/expenses/state";
import { CLAIM_STATUS, flagStatuses } from "@/lib/expenses/status-map";

/**
 * One claim in a list — the employee’s own, or the approver’s queue.
 * Status is text + colour; money is at its final value (D-017).
 */
export function ClaimCard({
  claim,
  href,
  showPerson = false,
}: {
  claim: ClaimListRow;
  href: string;
  showPerson?: boolean;
}) {
  const ref = claimRef(claim.claimNumber);
  const claimed = Number(claim.claimedAmount);
  const approved = claim.approvedAmount === null ? null : Number(claim.approvedAmount);
  const flags = claim.status === "SUBMITTED" ? flagStatuses(claim) : [];

  return (
    <Card statusTone={CLAIM_STATUS[claim.status].tone}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body font-semibold text-text-primary">
            {showPerson ? `${claim.membership.user.displayName} · ` : ""}
            {claim.categoryName} · {formatExpenseDate(claim.expenseDate)}
          </p>
          <p className="text-caption text-text-secondary">
            {ref}
            {claim._count.receipts > 0
              ? ` · ${claim._count.receipts} receipt${claim._count.receipts === 1 ? "" : "s"}`
              : " · no receipt"}
          </p>
        </div>
        <StatusChip status={CLAIM_STATUS[claim.status]} size="sm" />
      </div>

      <p className="mt-2 font-mono text-data font-semibold text-text-primary tabular-nums">
        {formatAmount(claimed)}
        {approved !== null && approved !== claimed && (
          <span className="ml-2 text-body font-normal text-text-secondary">
            approved {formatAmount(approved)}
          </span>
        )}
      </p>
      <p className="mt-1 text-secondary text-text-secondary">{claim.description}</p>

      {flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {flags.map((f) => (
            <StatusChip key={f.key} status={f} size="sm" bordered />
          ))}
        </div>
      )}

      {claim.decisionReason && (
        <p className="mt-2 text-secondary text-text-secondary">
          Reason from the approver: {claim.decisionReason}
        </p>
      )}
      {claim.status === "WITHDRAWN" && claim.withdrawalReason && (
        <p className="mt-2 text-secondary text-text-secondary">
          Withdrawn: {claim.withdrawalReason}
        </p>
      )}
      {claim.settlement && (
        <p className="mt-2 text-caption text-text-secondary">
          Settled {claim.settlement.route === "OUTSIDE" ? "outside payroll" : "through payroll"}
          {claim.settlement.reference ? ` — ${claim.settlement.reference}` : ""}
          {approved !== null && Number(claim.settlement.amount) !== approved
            ? ` · ${formatAmount(Number(claim.settlement.amount))} (rounded to whole rupees)`
            : ""}
        </p>
      )}

      <div className="mt-3">
        <Link
          href={href}
          className="text-label text-brand-primary underline-offset-2 hover:underline"
        >
          Open {ref}
        </Link>
      </div>
    </Card>
  );
}
