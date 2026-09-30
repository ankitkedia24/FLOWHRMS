"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input, TextArea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { requestLockoutCodeAction } from "@/lib/platform/lockout-actions";

type Result = { ok: true; message: string; detail?: string } | { ok: false; error: string };

/**
 * Locking a company out — suspending it, or ending its trial now — takes
 * two steps and a code nobody on this screen holds (lib/platform/
 * lockout-code.ts): say why, a code goes to info@flowacord.com, and the
 * action runs only with that code. The reason is fixed when the code is
 * sent; the email shows it, and it is what goes on the record.
 */
export function LockoutCodeModal({
  open,
  onClose,
  tenantId,
  action,
  title,
  consequence,
  consequenceDetail,
  confirmLabel,
  cancelLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  action: "SUSPEND" | "END_TRIAL";
  title: string;
  consequence: string;
  consequenceDetail: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: (codeId: string, code: string) => Promise<Result>;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState<{ codeId: string; sentTo: string } | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>();
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const digits = code.replace(/\s+/g, "");
  const codeReady = /^\d{6}$/.test(digits);

  function close() {
    setReason("");
    setSent(null);
    setCode("");
    setCodeError(undefined);
    onClose();
  }

  function sendCode() {
    startTransition(async () => {
      const result = await requestLockoutCodeAction({ tenantId, action, reason: reason.trim() });
      if (!result.ok) {
        if (result.waitSeconds) setWait(result.waitSeconds);
        show({ variant: "error", message: result.error });
        return;
      }
      setSent({ codeId: result.codeId, sentTo: result.sentTo });
      setCode("");
      setCodeError(undefined);
      setWait(60);
    });
  }

  function confirm() {
    if (!sent) return;
    startTransition(async () => {
      const result = await onConfirm(sent.codeId, digits);
      if (!result.ok) {
        setCodeError(result.error);
        return;
      }
      show({ variant: "success", message: [result.message, result.detail].filter(Boolean).join(" ") });
      close();
      router.refresh();
    });
  }

  return (
    <Modal open={open} onClose={close} title={title}>
      <Alert variant="consequence" title={consequence}>
        {consequenceDetail}
      </Alert>

      {!sent ? (
        <>
          <div className="mt-4">
            <TextArea
              label="Why"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              helper="Kept on the record, and shown in the email with the code."
              className="max-w-none"
            />
          </div>
          <p className="mt-3 text-caption text-text-secondary">
            This needs a code emailed to info@flowacord.com. Nobody can do it without one.
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={close}>
              {cancelLabel}
            </Button>
            <Button
              variant="primary"
              loading={pending}
              disabled={reason.trim().length === 0 || wait > 0}
              disabledReason={reason.trim().length === 0 ? "Say why first." : `Wait ${wait} seconds.`}
              onClick={sendCode}
            >
              Email the code
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-4">
            <Alert variant="info" title={`Code sent to ${sent.sentTo}`}>
              It works once, for 10 minutes. Reason on the record: “{reason.trim()}”
            </Alert>
          </div>
          <div className="mt-4">
            <Input
              label="Code from the email"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError(undefined);
              }}
              error={codeError}
            />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            <Button
              variant="outline"
              size="sm"
              loading={pending}
              disabled={wait > 0}
              disabledReason={`Wait ${wait} seconds.`}
              onClick={sendCode}
            >
              {wait > 0 ? `Email a new code (${wait}s)` : "Email a new code"}
            </Button>
            <Button variant="outline" onClick={close}>
              {cancelLabel}
            </Button>
            <Button
              variant="danger"
              loading={pending}
              disabled={!codeReady}
              disabledReason="Enter the 6-digit code."
              onClick={confirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
