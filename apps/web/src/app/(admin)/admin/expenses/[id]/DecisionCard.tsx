"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input, TextArea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { decideClaimAction } from "@/lib/expenses/actions";
import { formatAmount } from "@/lib/expenses/format";

type Mode = "idle" | "amount" | "reject";

/**
 * The three outcomes, one form (EXPENSES-MODULE.md §11). Approve in full;
 * approve a different amount with a reason; reject with a reason. Which of
 * APPROVED / PARTIALLY_APPROVED results is derived server-side from the
 * amounts — nothing here chooses a status.
 */
export function DecisionCard({
  claimId,
  claimedAmount,
  personName,
  isOwn,
  allowSelfApproval,
}: {
  claimId: string;
  claimedAmount: number;
  personName: string;
  isOwn: boolean;
  allowSelfApproval: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("idle");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const selfBlocked = isOwn && !allowSelfApproval;
  const parsedAmount = Number(amount);
  const amountOk =
    amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= claimedAmount;
  const reasonOk = reason.trim().length > 0;

  function run(input: Parameters<typeof decideClaimAction>[0]) {
    startTransition(async () => {
      const result = await decideClaimAction(input);
      if (result.ok) {
        show({ variant: "success", message: result.message });
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  return (
    <section aria-label="Decision" className="flex flex-col gap-3">
      <Alert
        variant="warning"
        title={`Approving records ${formatAmount(claimedAmount)} as owed to ${personName}. Nothing is paid until you settle it.`}
      >
        {selfBlocked
          ? "This is your own claim. Company rules do not allow self-approval — ask another approver."
          : isOwn
            ? "This is your own claim. Company rules allow self-approval; it will be recorded as such."
            : "The employee reads any reason you give word for word."}
      </Alert>

      {mode === "amount" && (
        <div className="flex flex-col gap-1">
          <Input
            label="Amount to approve"
            required
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max={claimedAmount}
            prefix="₹"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            helper={`Claimed ${formatAmount(claimedAmount)}. Less than that is a partial approval.`}
            error={
              amount.trim() !== "" && !amountOk
                ? `Enter an amount between ₹0.01 and ${formatAmount(claimedAmount)}.`
                : undefined
            }
          />
          <TextArea
            label="Why a different amount"
            required
            placeholder="Auto fare above the usual rate; approved at the standard rate"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="max-w-none"
            error={reasonOk ? undefined : "A different amount needs a reason."}
          />
        </div>
      )}

      {mode === "reject" && (
        <TextArea
          label="Reason"
          required
          placeholder="Tell them what to do next"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="max-w-none"
          error={reasonOk ? undefined : "A reason is required to reject."}
        />
      )}

      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
        {mode === "idle" && (
          <>
            <Button
              size="lg"
              loading={pending}
              disabled={selfBlocked}
              disabledReason={selfBlocked ? "You can’t decide your own claim." : undefined}
              onClick={() => run({ claimId, decision: "APPROVE" })}
              className="md:w-auto"
            >
              Approve {formatAmount(claimedAmount)}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              disabled={selfBlocked}
              onClick={() => setMode("amount")}
              className="md:w-auto"
            >
              Approve a different amount
            </Button>
            <Button
              size="lg"
              variant="dangerSubtle"
              disabled={selfBlocked}
              onClick={() => setMode("reject")}
              className="md:w-auto"
            >
              Reject
            </Button>
          </>
        )}
        {mode === "amount" && (
          <>
            <Button
              size="lg"
              loading={pending}
              disabled={!amountOk || !reasonOk}
              disabledReason={!amountOk ? "Enter the amount first." : !reasonOk ? "Add a reason." : undefined}
              onClick={() =>
                run({ claimId, decision: "APPROVE_AMOUNT", approvedAmount: parsedAmount, reason: reason.trim() })
              }
              className="md:w-auto"
            >
              Approve {amountOk ? formatAmount(parsedAmount) : "amount"}
            </Button>
            <Button size="lg" variant="outline" onClick={() => setMode("idle")} className="md:w-auto">
              Back
            </Button>
          </>
        )}
        {mode === "reject" && (
          <>
            <Button
              size="lg"
              variant="danger"
              loading={pending}
              disabled={!reasonOk}
              disabledReason={!reasonOk ? "Add a reason to reject." : undefined}
              onClick={() => run({ claimId, decision: "REJECT", reason: reason.trim() })}
              className="md:w-auto"
            >
              Reject with this reason
            </Button>
            <Button size="lg" variant="outline" onClick={() => setMode("idle")} className="md:w-auto">
              Back
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
