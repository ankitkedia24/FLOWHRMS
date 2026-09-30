import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { mayDecideOwn } from "@/lib/authz/approvals";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { evaluateAccess } from "@/lib/authz/flags";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { ClaimTimeline } from "@/components/expenses/ClaimTimeline";
import { ReceiptLink } from "@/components/expenses/ReceiptLink";
import { canApproveClaims, canViewOthersClaims, loadExpensesPolicy } from "@/lib/expenses/access";
import { formatAmount, formatExpenseDate, formatWhen } from "@/lib/expenses/format";
import {
  monthLabel,
  offeredRoutes,
  payrollRoundingNote,
  seamFailureMessage,
  settlementMonth,
} from "@/lib/expenses/payroll-settlement";
import { previewPayrollSettlement } from "@/lib/expenses/settle-payroll";
import { loadClaimForViewer } from "@/lib/expenses/queries";
import { claimRef, ownClaimRefusal } from "@/lib/expenses/state";
import { CLAIM_STATUS, flagMeanings, flagStatuses } from "@/lib/expenses/status-map";
import { DecisionCard } from "./DecisionCard";
import { loadClaimEvidence } from "@/lib/field-visits/conveyance";
import { TravelEvidence } from "@/components/field-visits/TravelEvidence";
import { SettleForm, type PayrollOption } from "./SettleForm";

export const metadata: Metadata = { title: "Expense claim" };

/**
 * The decision card (EXPENSES-MODULE.md §11) and, once decided, the
 * settlement record (§12). Everything the approver needs is on screen
 * before the buttons: amount, receipts, the flags with their meaning.
 */
export default async function AdminExpenseClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { session, decision } = await checkAccess({ module: "EXPENSES" });
  if (!decision.allowed) redirect("/unauthorized");
  if (!canViewOthersClaims(session)) redirect("/unauthorized");
  if (devFixtureOffline()) notFound();

  const loaded = await loadClaimForViewer(session, id);
  if (!loaded) notFound();
  const { claim, isOwn, actorNames } = loaded;
  // A travel allowance claim: recorded and claimed kilometres, side by side.
  const evidence = await loadClaimEvidence(session.tenant.id, claim.id);

  const [published, entitlements] = await Promise.all([
    loadExpensesPolicy(session.tenant.id),
    loadEntitlements(session.tenant.id, session.user.id),
  ]);
  const payrollOn = evaluateAccess({ session, entitlements, module: "PAYROLL" }).allowed;

  const ref = claimRef(claim.claimNumber);
  const claimed = Number(claim.claimedAmount);
  const approved = claim.approvedAmount === null ? null : Number(claim.approvedAmount);
  const tz = session.tenant.timezone;
  const person = claim.membership.user.displayName;
  const flags = flagStatuses(claim);
  const canApprove = canApproveClaims(session);

  // Your own claim: the same rule the seam applies (state.ts), so the page
  // never offers a button that would only refuse. Outsiders never get here.
  const allowSelfApproval = published?.policy.allowSelfApproval ?? false;
  const ownRefusal = (step: "decide" | "settle") =>
    isOwn
      ? ownClaimRefusal({ step, mayDecideOwn: mayDecideOwn(session.membership.roleKey), allowSelfApproval })
      : null;
  const awaitingSettlement = claim.status === "APPROVED" || claim.status === "PARTIALLY_APPROVED";
  const ownSettleRefusal = awaitingSettlement && canApprove ? ownRefusal("settle") : null;

  // Settlement (§12): routes from the entitlement, preselected from policy,
  // and what payroll would do — computed here, before the click.
  const settleable = awaitingSettlement && canApprove && !ownSettleRefusal && approved !== null;
  const routes = offeredRoutes({
    payrollOn,
    defaultRoute: published?.policy.defaultSettlementRoute ?? "OUTSIDE",
  });
  let payrollOption: PayrollOption | null = null;
  if (settleable && payrollOn && approved !== null) {
    const preview = await previewPayrollSettlement(session, {
      membershipId: claim.membershipId,
      decidedAt: claim.decidedAt,
      approvedAmount: approved,
    });
    if (preview.available) {
      const target = preview.target;
      payrollOption = target.ok
        ? {
            ready: true,
            monthLabel: monthLabel(target.run.periodMonth),
            amount: preview.amount,
            note: payrollRoundingNote(preview.approvedAmount, preview.amount),
            problem: null,
          }
        : {
            ready: false,
            monthLabel: null,
            amount: preview.amount,
            note: null,
            problem:
              target.reason === "NO_OPEN_RUN"
                ? seamFailureMessage("NO_OPEN_RUN", {
                    monthLabel: monthLabel(settlementMonth(claim.decidedAt ?? new Date(), tz)),
                    earliestLockedLabel: target.earliestLockedMonth
                      ? monthLabel(target.earliestLockedMonth)
                      : null,
                  })
                : seamFailureMessage("NO_LINE_FOR_PERSON", {
                    monthLabel: monthLabel(target.periodMonth),
                    personName: person,
                  }),
          };
    }
  }
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
        <Link href="/admin/expenses" className="text-label text-brand-primary underline-offset-2 hover:underline">
          All claims
        </Link>
      </div>

      <Card>
        <p className="text-body font-semibold text-text-primary">{person}</p>
        <p className="text-caption text-text-secondary">
          {claim.membership.department?.name ?? "No department"}
          {claim.submittedAt ? ` · submitted ${formatWhen(claim.submittedAt, tz)}` : ""}
        </p>
        <p className="mt-3 text-body text-text-primary">
          {claim.categoryName} · {formatExpenseDate(claim.expenseDate)}
        </p>
        <p className="font-mono text-data-xl font-semibold text-text-primary tabular-nums">
          {formatAmount(claimed)}
        </p>
        {approved !== null && approved !== claimed && (
          <p className="text-body text-text-secondary">Approved {formatAmount(approved)}</p>
        )}
        <div className="mt-3 rounded-md bg-surface-sunken p-3">
          <p className="text-body text-text-primary">{claim.description}</p>
          <p className="mt-2 text-caption text-text-secondary">
            Receipt {claim.receiptRequiredAtSubmission ? "required" : "optional"} for this category
            {claim.maxClaimAmountAtSubmission !== null
              ? ` · cap ${formatAmount(Number(claim.maxClaimAmountAtSubmission))}`
              : ""}
            {claim.policyVersion ? ` · rules v${claim.policyVersion}` : ""}
          </p>
          {claim.receipts.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-2">
              {claim.receipts.map((r) => (
                <li key={r.id}>
                  <ReceiptLink receiptId={r.id} name={r.name} sizeBytes={r.sizeBytes} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-caption text-text-secondary">No receipt attached.</p>
          )}
        </div>
        {evidence && (
          <div className="mt-3">
            <TravelEvidence evidence={evidence} />
          </div>
        )}
        {flags.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {flags.map((f) => (
                <StatusChip key={f.key} status={f} size="sm" bordered />
              ))}
            </div>
            <ul className="list-disc pl-5 text-secondary text-text-secondary">
              {flagMeanings(claim).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {claim.status === "SUBMITTED" && canApprove && (
        <DecisionCard
          claimId={claim.id}
          claimedAmount={claimed}
          personName={person}
          isOwn={isOwn}
          ownRefusal={ownRefusal("decide")}
        />
      )}

      {claim.decisionReason && (
        <Alert
          variant={claim.status === "REJECTED" ? "error" : "info"}
          title={`${claim.status === "REJECTED" ? "Refused" : "Decision"} — reason on the record:`}
        >
          &ldquo;{claim.decisionReason}&rdquo;
        </Alert>
      )}

      {ownSettleRefusal && (
        <Alert variant="info" title="This is your own claim.">
          {ownSettleRefusal}
        </Alert>
      )}

      {settleable && approved !== null && (
        <SettleForm
          claimId={claim.id}
          amount={approved}
          personName={person}
          routes={routes.routes}
          preselected={routes.preselected}
          payroll={payrollOption}
        />
      )}

      {claim.settlement && (
        <Alert
          variant="success"
          title={`Settled ${claim.settlement.route === "OUTSIDE" ? "outside payroll" : "through payroll"} · ${formatAmount(Number(claim.settlement.amount))}`}
        >
          {claim.settlement.reference ?? ""} · {formatWhen(claim.settlement.settledAt, tz)}
          {settledNote ? ` · ${settledNote}` : ""}
        </Alert>
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
