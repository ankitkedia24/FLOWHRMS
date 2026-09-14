"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Sends a Supabase password-reset email.
 *
 * The response is deliberately the same whether or not the address is
 * registered — telling a stranger which emails exist would leak your
 * company's staff list.
 */
export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <Alert variant="success" title="Check your email.">
        If that address has a FlowHRMS account, a reset link is on its way. The
        link expires shortly, so use it soon.
      </Alert>
    );
  }

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
          await supabase.auth.resetPasswordForEmail(email.trim(), {
            // `(auth)` is a route group — it adds no path segment, so the
            // page lives at /reset. Must also be in Supabase's redirect
            // allow-list for the deployed domain (DEPLOY.md).
            redirectTo: `${window.location.origin}/reset`,
          });
          // Always the same outcome — never confirm whether an account exists.
          setSent(true);
        });
      }}
    >
      <Input
        label="Email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@company.example"
        error={error ?? undefined}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="mt-3">
        <Button
          type="submit"
          size="xl"
          loading={pending}
          disabled={!email.trim()}
          disabledReason={!email.trim() ? "Enter your email." : undefined}
        >
          Send reset link
        </Button>
      </div>
    </form>
  );
}
