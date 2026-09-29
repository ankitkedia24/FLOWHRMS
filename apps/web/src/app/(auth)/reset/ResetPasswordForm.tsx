"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Completes a password reset. The recovery session comes from the link in
 * the email, which Supabase establishes before this page renders.
 */
const MIN_LENGTH = 8;

export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = password.length >= MIN_LENGTH && confirm === password;

  return (
    <form
      noValidate
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          let supabase;
          try {
            supabase = createSupabaseBrowserClient();
          } catch {
            setError("Sign-in isn't connected yet. Ask your admin.");
            return;
          }
          const { error: updateError } = await supabase.auth.updateUser({
            password,
          });
          if (updateError) {
            // Say what happened and what to do next.
            setError(
              "That link has expired or was already used. Ask for a new one.",
            );
            return;
          }
          router.replace("/");
        });
      }}
    >
      {error && (
        <div className="mb-3">
          <Alert variant="error" title={error} live>
            Go back to sign in and choose &ldquo;Forgot password&rdquo; again.
          </Alert>
        </div>
      )}

      <Input
        label="New password"
        type="password"
        required
        autoComplete="new-password"
        helper={`At least ${MIN_LENGTH} characters.`}
        error={tooShort ? `Use at least ${MIN_LENGTH} characters.` : undefined}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Input
        label="Confirm password"
        type="password"
        required
        autoComplete="new-password"
        error={mismatch ? "Both passwords must match." : undefined}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      <div className="mt-3">
        <Button
          type="submit"
          size="xl"
          loading={pending}
          disabled={!ready}
          disabledReason={
            !ready ? "Enter a matching password of at least 8 characters." : undefined
          }
        >
          Save password
        </Button>
      </div>
    </form>
  );
}
