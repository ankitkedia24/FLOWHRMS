"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { setTenantStatusAction } from "@/lib/platform/actions";
import { LockoutCodeModal } from "./LockoutCodeModal";

/**
 * Suspend or restore a company.
 *
 * Suspending is the sharpest thing on this screen — it stops every person
 * at that company signing in — so it follows the impact-confirm order the
 * rest of FlowHRMS uses: name the consequence, say how many people it lands on,
 * require a reason, and only then offer the button — and, since 30 Sept
 * 2026, a code emailed to info@flowacord.com (LockoutCodeModal): nobody
 * suspends a company without it. Restoring needs only a reason, because
 * "why were they off for three days" is a question someone will ask.
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

  if (suspending) {
    return (
      <>
        <Button size="sm" variant="dangerSubtle" onClick={() => setOpen(true)}>
          Suspend
        </Button>
        <LockoutCodeModal
          open={open}
          onClose={() => setOpen(false)}
          tenantId={tenantId}
          action="SUSPEND"
          title={`Suspend ${name}?`}
          consequence={`All ${people} ${people === 1 ? "person" : "people"} at ${name} will stop being able to sign in.`}
          consequenceDetail="Nothing is deleted. Attendance, payroll and documents stay exactly as recorded, and all of it comes back if you restore them."
          confirmLabel="Suspend this company"
          cancelLabel="Leave them active"
          onConfirm={(codeId, code) => setTenantStatusAction({ tenantId, status: "SUSPENDED", codeId, code })}
        />
      </>
    );
  }

  function submit() {
    startTransition(async () => {
      const result = await setTenantStatusAction({
        tenantId,
        status: "ACTIVE",
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
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Restore
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Restore ${name}?`}
      >
        <Alert variant="info" title={`Everyone at ${name} will be able to sign in again.`}>
          Their data is exactly as they left it.
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
            Leave them suspended
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={reason.trim().length === 0}
            disabledReason={reason.trim().length === 0 ? "Say why first." : undefined}
            onClick={submit}
          >
            Restore this company
          </Button>
        </div>
      </Modal>
    </>
  );
}
