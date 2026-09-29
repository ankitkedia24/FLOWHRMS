"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { withdrawClaimAction } from "@/lib/expenses/actions";

/**
 * The claimant’s withdrawal (EXPENSES-MODULE.md §3): explicit confirmation,
 * optional reason, terminal. Only shown while the claim is SUBMITTED; the
 * server refuses everything else regardless.
 */
export function WithdrawButton({ claimId, claimRef }: { claimId: string; claimRef: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <>
      <Button size="lg" variant="outline" onClick={() => setOpen(true)}>
        Withdraw claim
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Withdraw ${claimRef}?`}
        preventEscClose
      >
        <p className="text-body text-text-secondary">
          It cannot be reopened. If you still need to claim this expense, submit a
          new claim. Your approvers stop seeing it.
        </p>
        <div className="mt-4">
          <TextArea
            label="Why"
            optional
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            helper="Kept on the record with the claim. Leave it blank if you prefer."
            className="max-w-none"
          />
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Keep the claim
          </Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await withdrawClaimAction({
                  claimId,
                  reason: reason.trim() || undefined,
                });
                setOpen(false);
                if (result.ok) {
                  show({ variant: "success", message: result.message });
                  router.refresh();
                } else {
                  show({ variant: "error", message: result.error });
                }
              })
            }
          >
            Withdraw
          </Button>
        </div>
      </Modal>
    </>
  );
}
