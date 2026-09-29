"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { setTenantStatusAction } from "@/lib/platform/actions";

/**
 * Suspend or restore a company.
 *
 * Suspending is the sharpest thing on this screen — it stops every person
 * at that company signing in — so it follows the impact-confirm order the
 * rest of FlowHRMS uses: name the consequence, say how many people it lands on,
 * require a reason, and only then offer the button. Restoring is the same
 * control in reverse and needs the same reason, because "why were they off
 * for three days" is a question someone will eventually ask.
 */
export function TenantStatusControl({
  tenantId,
  name,
  status,
  people,
}: {
  tenantId: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  people: number;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (status === "ARCHIVED") {
    return <span className="text-caption text-text-tertiary">Archived</span>;
  }

  const suspending = status === "ACTIVE";
  const next = suspending ? "SUSPENDED" : "ACTIVE";

  function submit() {
    startTransition(async () => {
      const result = await setTenantStatusAction({
        tenantId,
        status: next,
        reason: reason.trim(),
      });
      if (result.ok) {
        show({
          variant: "success",
          message: [result.message, result.detail].filter(Boolean).join(" "),
        });
        setOpen(false);
        setReason("");
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant={suspending ? "dangerSubtle" : "outline"}
        onClick={() => setOpen(true)}
      >
        {suspending ? "Suspend" : "Restore"}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={suspending ? `Suspend ${name}?` : `Restore ${name}?`}
      >
        <Alert
          variant={suspending ? "consequence" : "info"}
          title={
            suspending
              ? `All ${people} ${people === 1 ? "person" : "people"} at ${name} will stop being able to sign in.`
              : `Everyone at ${name} will be able to sign in again.`
          }
        >
          {suspending
            ? "Nothing is deleted. Attendance, payroll and documents stay exactly as recorded, and all of it comes back if you restore them."
            : "Their data is exactly as they left it."}
        </Alert>

        <div className="mt-4">
          <TextArea
            label="Why"
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            helper="Kept on the record. This is the answer if they ask what happened."
            className="max-w-none"
          />
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {suspending ? "Leave them active" : "Leave them suspended"}
          </Button>
          <Button
            variant={suspending ? "danger" : "primary"}
            loading={pending}
            disabled={reason.trim().length === 0}
            disabledReason={reason.trim().length === 0 ? "Say why first." : undefined}
            onClick={submit}
          >
            {suspending ? "Suspend this company" : "Restore this company"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
