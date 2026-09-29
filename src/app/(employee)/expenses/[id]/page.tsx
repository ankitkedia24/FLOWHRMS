import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { ClaimTimeline } from "@/components/expenses/ClaimTimeline";
import { ReceiptLink } from "@/components/expenses/ReceiptLink";
import { formatAmount, formatExpenseDate, formatWhen } from "@/lib/expenses/format";
import { payrollRoundingNote } from "@/lib/expenses/payroll-settlement";
import { loadClaimForViewer } from "@/lib/expenses/queries";
import { loadClaimEvidence } from "@/lib/field-visits/conveyance";
import { TravelEvidence } from "@/components/field-visits/TravelEvidence";
import { claimRef } from "@/lib/expenses/state";
import { CLAIM_STATUS, flagMeanings, flagStatuses } from "@/lib/expenses/status-map";
import { WithdrawButton } from "../WithdrawButton";

export const metadata: Metadata = { title: "Expense claim" };

/**
 * One claim, the employee’s view: what was claimed, every receipt, the
 * decision in the approver’s words, how it was settled, and the history.
 * Withdrawal lives here — after confirmation, only while SUBMITTED.
 */
export default async function ExpenseClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { session, decision } = await checkAccess({ module: "EXPENSES" });
  if (!decision.allowed) redirect("/home");
  if (devFixtureOffline()) notFound();

  const loaded = await loadClaimForViewer(session, id);
  if (!loaded) notFound();
  const { claim, isOwn, actorNames } = loaded;
  // A travel allowance claim carries what it was worked out from.
  const evidence = await loadClaimEvidence(session.tenant.id, claim.id);

  const ref = claimRef(claim.claimNumber);
  const claimed = Number(claim.claimedAmount);
  const approved = claim.approvedAmount === null ? null : Number(claim.approvedAmount);
  const tz = session.tenant.timezone;
  const flags = flagStatuses(claim);
  const settledNote =
    claim.settlement && approved !== null
      ? payrollRoundingNote(approved, Number(claim.settlement.amount))
      : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-h1 text-text-primary">{ref}</h1>
          <StatusChip status={CLAIM_STATUS[claim.status]} />
        </div>
        <Link href="/expenses" className="text-label text-brand-primary underline-offset-2 hover:underline">
          All claims
        </Link>
      </div>

      <Card>
        <p className="text-body font-semibold text-text-primary">
          {claim.categoryName} · {formatExpenseDate(claim.expenseDate)}
        </p>
        <p className="mt-1 font-mono text-data-xl font-semibold text-text-primary tabular-nums">
          {formatAmount(claimed)}
        </p>
        {approved !== null && approved !== claimed && (
          <p className="text-body text-text-secondary">Approved {formatAmount(approved)}</p>
        )}
        <p className="mt-2 text-body text-text-secondary">{claim.description}</p>
        {evidence && (
          <div className="mt-3">
            <TravelEvidence evidence={evidence} />
          </div>
        )}
        {claim.submittedAt && (
          <p className="mt-2 text-caption text-text-tertiary">
            Submitted {formatWhen(claim.submittedAt, tz)}
          </p>
        )}
        {claim.receipts.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {claim.receipts.map((r) => (
              <li key={r.id}>
                <ReceiptLink receiptId={r.id} name={r.name} sizeBytes={r.sizeBytes} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {claim.status === "SUBMITTED" && flags.length > 0 && (
        <Alert variant="info" title="The approver will see these notes.">
          <ul className="list-disc pl-5">
            {flagMeanings(claim).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Alert>
      )}

      {claim.decisionReason && (
        <Alert
          variant={claim.status === "REJECTED" ? "error" : "info"}
          title={claim.status === "REJECTED" ? "Refused — the approver’s reason:" : "The approver’s reason:"}
        >
          &ldquo;{claim.decisionReason}&rdquo;
        </Alert>
      )}

      {claim.settlement && (
        <Alert
          variant="success"
          title={`Settled ${claim.settlement.route === "OUTSIDE" ? "outside payroll" : "through payroll"} · ${formatAmount(Number(claim.settlement.amount))}`}
        >
          {claim.settlement.reference ?? ""} · {formatWhen(claim.settlement.settledAt, tz)}
          {settledNote ? ` · ${settledNote}` : ""}
          {claim.settlement.route === "PAYROLL"
            ? " It appears on that payslip as an adjustment with this claim’s reference."
            : ""}
        </Alert>
      )}

      {isOwn && claim.status === "SUBMITTED" && (
        <div>
          <WithdrawButton claimId={claim.id} claimRef={ref} />
        </div>
      )}

      <ClaimTimeline
        transitions={claim.transitions}
        actorNames={actorNames}
        claimedAmount={claimed}
        timeZone={tz}
      />
    </div>
  );
}
