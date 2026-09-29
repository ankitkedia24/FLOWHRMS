"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { settleClaimAction } from "@/lib/expenses/actions";
import { formatAmount } from "@/lib/expenses/format";
import type { SettlementRoute } from "@/lib/expenses/policy";

/** What settling through payroll would do — computed server-side, before the click. */
export interface PayrollOption {
  ready: boolean;
  monthLabel: string | null;
  /** Whole rupees — what the payslip and the settlement record will carry. */
  amount: number;
  /** Set when rounding changed the figure. */
  note: string | null;
  /** Set when the seam would refuse; names the way out. */
  problem: string | null;
}

/**
 * Settlement (EXPENSES-MODULE.md §12): a record of how the money was
 * paid. The routes offered come from the server (Payroll on or off); the
 * action recomputes them at write time. Money shows at its final value.
 */
export function SettleForm({
  claimId,
  amount,
  personName,
  routes,
  preselected,
  payroll,
}: {
  claimId: string;
  amount: number;
  personName: string;
  routes: SettlementRoute[];
  preselected: SettlementRoute;
  payroll: PayrollOption | null;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [route, setRoute] = useState<SettlementRoute>(preselected);
  const [reference, setReference] = useState("");

  const viaPayroll = route === "PAYROLL" && payroll !== null;
  const blocker = viaPayroll
    ? payroll.ready
      ? null
      : "Payroll cannot take this claim — see above."
    : reference.trim().length < 3
      ? "Say how it was paid."
      : null;

  function run() {
    startTransition(async () => {
      const result = await settleClaimAction(
        viaPayroll
          ? { claimId, route: "PAYROLL" }
          : { claimId, route: "OUTSIDE", reference: reference.trim() },
      );
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
      <CardHeader title="Record settlement" meta={`${formatAmount(amount)} owed to ${personName}`} />

      {routes.length > 1 ? (
        <Select
          label="Settle"
          options={[
            { value: "PAYROLL", label: "Through payroll — as an adjustment on the payslip" },
            { value: "OUTSIDE", label: "Outside payroll — cash, UPI or bank" },
          ]}
          value={route}
          onChange={(event) => setRoute(event.target.value as SettlementRoute)}
        />
      ) : (
        <Alert variant="info" title="Route: outside payroll">
          Payroll is not enabled for your company, so claims are settled outside payroll and recorded here.
        </Alert>
      )}

      {viaPayroll && payroll.ready && (
        <div className="mt-3">
          <Alert
            variant="consequence"
            title={`Adds ${formatAmount(payroll.amount)} to ${payroll.monthLabel} payroll for ${personName}.`}
          >
            {payroll.note ??
              "It appears on the payslip as an adjustment carrying the claim reference. Nothing is paid until that payroll is approved."}
          </Alert>
        </div>
      )}
      {viaPayroll && !payroll.ready && (
        <div className="mt-3">
          <Alert variant="warning" title="Payroll cannot take this claim yet.">
            {payroll.problem}
          </Alert>
        </div>
      )}

      {!viaPayroll && (
        <div className="mt-3">
          <Input
            label="How it was paid"
            required
            placeholder="Cash on 12 Sept, voucher 118"
            helper="Cash, UPI or bank — and when. This is what the employee reads."
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </div>
      )}

      <div className="mt-4">
        <Button
          size="lg"
          loading={pending}
          disabled={Boolean(blocker)}
          disabledReason={blocker ?? undefined}
          onClick={run}
        >
          {viaPayroll ? `Add to ${payroll.monthLabel ?? "payroll"} payroll` : "Record as settled"}
        </Button>
      </div>
    </Card>
  );
}
