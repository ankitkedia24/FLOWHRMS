"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { settleClaimAction } from "@/lib/expenses/actions";
import { formatAmount } from "@/lib/expenses/format";

export interface AwaitingClaim {
  id: string;
  ref: string;
  personName: string;
  categoryName: string;
  approvedAmount: number;
  /** Whole rupees — what the payslip will carry. */
  payrollAmount: number;
  note: string | null;
}

/**
 * Payroll pulling (EXPENSES-MODULE.md §13 rule 8): approved expense
 * claims for people on this DRAFT run, settled into it with one tap.
 * The same seam as the claim page — the settler needs `expenses.approve`,
 * not a payroll permission, and the amount is the rounded figure.
 */
export function SettleIntoRun({
  periodLabel,
  claims,
}: {
  periodLabel: string;
  claims: AwaitingClaim[];
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function settle(claimId: string) {
    setBusyId(claimId);
    startTransition(async () => {
      const result = await settleClaimAction({ claimId, route: "PAYROLL" });
      setBusyId(null);
      if (result.ok) {
        show({ variant: "success", message: result.message });
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title={`Expense claims waiting to settle into ${periodLabel} (${claims.length})`}
        meta="Approved claims for people on this run. Each becomes an adjustment on the payslip."
      />
      <ul className="flex flex-col divide-y divide-border-subtle">
        {claims.map((claim) => (
          <li
            key={claim.id}
            className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="text-body font-semibold text-text-primary">
                {claim.personName} · {claim.categoryName}
              </p>
              <p className="text-caption text-text-secondary">
                {claim.ref} · approved {formatAmount(claim.approvedAmount)}
                {claim.note ? ` · ${claim.note}` : ""}
              </p>
            </div>
            <Button
              size="sm"
              loading={pending && busyId === claim.id}
              disabled={pending && busyId !== claim.id}
              onClick={() => settle(claim.id)}
            >
              Add {formatAmount(claim.payrollAmount)} to payroll
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
