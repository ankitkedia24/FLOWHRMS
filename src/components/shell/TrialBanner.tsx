"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { resendVerificationAction } from "@/lib/signup/owner-actions";

/**
 * Above the admin screens of a trial company: how long is left (a quiet
 * line, turning to a warning in the last 7 days), and whether the owner
 * still has to confirm their email before they can invite staff.
 */
export function TrialBanner({
  daysLeft,
  endsLabel,
  needsVerification,
  email,
}: {
  daysLeft: number | null;
  endsLabel: string | null;
  needsVerification: boolean;
  email: string | null;
}) {
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const urgent = daysLeft !== null && daysLeft <= 7;

  return (
    <div className="flex flex-col">
      {needsVerification && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-status-warning-border bg-status-warning-bg px-5 py-2 text-secondary text-status-warning-text lg:px-8"
        >
          <span>Confirm your email to invite your team — we sent a link to {email}.</span>
          <button
            type="button"
            disabled={pending}
            className="font-semibold underline underline-offset-2"
            onClick={() =>
              startTransition(async () => {
                const r = await resendVerificationAction();
                show({ variant: r.ok ? "success" : "error", message: r.ok ? r.message : r.error });
              })
            }
          >
            {pending ? "Sending…" : "Send it again"}
          </button>
        </div>
      )}
      {daysLeft !== null && (
        <div
          className={
            urgent
              ? "border-b border-status-warning-border bg-status-warning-bg px-5 py-2 text-secondary text-status-warning-text lg:px-8"
              : "border-b border-border-default bg-surface-sunken px-5 py-1.5 text-caption text-text-secondary lg:px-8"
          }
        >
          {daysLeft <= 0
            ? "Your free trial ends today."
            : `Free trial: ${daysLeft} day${daysLeft === 1 ? "" : "s"} left (ends ${endsLabel}).`}{" "}
          {urgent && "Write to help@flowacord.com or call +91 89088 88880 to continue."}
        </div>
      )}
    </div>
  );
}
