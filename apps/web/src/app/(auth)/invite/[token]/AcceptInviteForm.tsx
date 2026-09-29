"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { acceptInviteAction } from "@/lib/invites/accept";
import { ConsentChecklist, allRequiredGranted } from "@/components/consent/ConsentChecklist";
import { CURRENT_DOCUMENTS, type DocumentKey } from "@/lib/consent/documents";

/**
 * Setting a password from an invitation.
 *
 * One field. The person doing this is often standing in a warehouse on a
 * phone they share, and every extra field is somewhere to get stuck.
 *
 * The strength rule is stated up front rather than after a failed attempt,
 * and the "show" control exists because typing an unseen password on a
 * phone keyboard is how people end up locked out of the thing they were
 * just invited to (accessibility.md §5).
 */
export function AcceptInviteForm({
  token,
  employeeName,
  variant = "employee",
  consentKeys = [],
}: {
  token: string;
  employeeName: string;
  /** "owner": the person just registered the company themselves. */
  variant?: "employee" | "owner";
  /** Notices to accept before the password is set (DPDP). */
  consentKeys?: DocumentKey[];
}) {
  const [granted, setGranted] = useState<Partial<Record<DocumentKey, string[]>>>({});
  const consentReady = consentKeys.every((k) =>
    allRequiredGranted(CURRENT_DOCUMENTS[k], granted[k] ?? []),
  );
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < 8;

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await acceptInviteAction({
            token,
            password,
            consents: granted as Record<string, string[]>,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(result.redirectTo);
          router.refresh();
        });
      }}
    >
      {error && (
        <Alert variant="error" title="That didn't work">
          {error}
        </Alert>
      )}

      {consentKeys.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-body text-text-secondary">
            First, please read how your personal data is used and tick each
            box you agree to.
          </p>
          {consentKeys.map((key) => (
            <ConsentChecklist
              key={key}
              doc={CURRENT_DOCUMENTS[key]}
              granted={granted[key] ?? []}
              onChange={(next) => setGranted((g) => ({ ...g, [key]: next }))}
            />
          ))}
        </div>
      )}

      <Input
        label="Choose a password"
        required
        type={show ? "text" : "password"}
        autoComplete="new-password"
        autoFocus
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={tooShort ? "Use at least 8 characters." : undefined}
        helper="At least 8 characters. Use something you don't use elsewhere."
      />

      <label className="flex items-center gap-2 text-secondary text-text-secondary">
        <input
          type="checkbox"
          checked={show}
          onChange={(event) => setShow(event.target.checked)}
          className="size-5 rounded border-[1.5px] border-border-default"
        />
        Show password
      </label>

      <Button
        type="submit"
        size="xl"
        loading={pending}
        disabled={password.length < 8 || !consentReady}
        disabledReason={
          !consentReady
            ? "Tick every box marked Required above first."
            : password.length < 8
              ? "Enter at least 8 characters first."
              : undefined
        }
        aria-label={`Set password and sign in as ${employeeName}`}
      >
        {pending ? "Setting up…" : "Set password and sign in"}
      </Button>

      {variant === "employee" && consentKeys.length === 0 && (
        <p className="text-caption text-text-tertiary">
          How your records are used is described in the{" "}
          <a href="/privacy/notice/employee" target="_blank" className="underline underline-offset-2">
            notice to employees
          </a>
          .
        </p>
      )}
    </form>
  );
}
