"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { TextArea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import {
  submitDataRequestAction,
  updateOptionalConsentAction,
  withdrawAllConsentAction,
} from "@/lib/consent/actions";
import { SELF_SERVICE_REQUEST_TYPES } from "@/lib/consent/requests";

/**
 * The interactive parts of Privacy & consent. Withdrawing is one button and
 * one confirmation — no harder than the consent was to give (s.6(4)).
 */
export function PrivacyControls({
  isOwner,
  productUpdates,
}: {
  isOwner: boolean;
  productUpdates: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [updates, setUpdates] = useState(productUpdates);
  const [type, setType] = useState<string>(SELF_SERVICE_REQUEST_TYPES[0].value);
  const [details, setDetails] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  const hint = SELF_SERVICE_REQUEST_TYPES.find((t) => t.value === type)?.hint;

  return (
    <>
      {isOwner && (
        <Card>
          <CardHeader title="Optional choices" />
          <Checkbox
            label="Send me product updates and offers by email or WhatsApp"
            helper="Turning this off changes nothing else about your account."
            checked={updates}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.checked;
              setUpdates(next);
              startTransition(async () => {
                const result = await updateOptionalConsentAction({ productUpdates: next });
                if (result.ok) {
                  show({ variant: "success", message: result.message });
                  router.refresh();
                } else {
                  setUpdates(!next);
                  show({ variant: "error", message: result.error });
                }
              });
            }}
          />
        </Card>
      )}

      <Card>
        <CardHeader title="Ask about your data" />
        <div className="flex flex-col gap-1">
          <Select
            label="What would you like?"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={SELF_SERVICE_REQUEST_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            helper={hint}
          />
          <TextArea
            label="Details"
            rows={4}
            value={details}
            error={requestError ?? undefined}
            onChange={(e) => {
              setDetails(e.target.value);
              setRequestError(null);
            }}
          />
        </div>
        <div className="mt-3">
          <Button
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await submitDataRequestAction({
                  type: type as (typeof SELF_SERVICE_REQUEST_TYPES)[number]["value"],
                  details,
                });
                if (result.ok) {
                  show({
                    variant: "success",
                    message: result.detail ? `${result.message} ${result.detail}` : result.message,
                  });
                  setDetails("");
                  router.refresh();
                } else {
                  setRequestError(result.error);
                }
              })
            }
          >
            Send request
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Withdraw consent" />
        <p className="text-secondary text-text-secondary">
          You can withdraw your consent at any time. You will be signed out,
          and we will close your account and erase your data except what the
          law requires us to keep. If you sign in again you will be asked for
          consent again.
        </p>
        <div className="mt-3">
          <Button variant="dangerSubtle" onClick={() => setConfirming(true)}>
            Withdraw my consent
          </Button>
        </div>
      </Card>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Withdraw your consent?"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Keep my account
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await withdrawAllConsentAction({ reason });
                  if (result.ok) router.replace("/sign-in");
                  else show({ variant: "error", message: result.error });
                })
              }
            >
              Withdraw and sign out
            </Button>
          </div>
        }
      >
        <Alert variant="consequence" title="What happens next">
          {isOwner
            ? "You are the owner. Withdrawing asks Flowacord to close your company's account; your staff will lose access once it is closed. Records the law requires to be kept (for example wage records) are kept for as long as required."
            : "Your employer is told, and your FlowHRMS account is closed. Records your employer must keep by law (for example attendance and wage records) are kept by them."}
        </Alert>
        <div className="mt-3">
          <TextArea
            label="Reason"
            optional
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </Modal>
    </>
  );
}
