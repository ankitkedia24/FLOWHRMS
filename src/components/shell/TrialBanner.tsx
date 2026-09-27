"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { resendVerificationAction } from "@/lib/signup/owner-actions";

/** What the banner has to say about the company's access, if anything. */
export type PlanNotice =
  | { kind: "trial"; daysLeft: number; endsLabel: string }
  /** A paid period with a week or less to run. */
  | { kind: "renew_soon"; daysLeft: number; untilLabel: string }
  /** The paid period is over; access continues until `pausesLabel`. */
  | { kind: "grace"; endedLabel: string; pausesLabel: string };

/**
 * Above the admin screens: how long a trial has left, a paid plan about
 * to run out, or a plan in its week of grace — each with a way to pay for
 * those who can. And whether the owner still has to confirm their email
 * before they can invite staff.
 */
export function TrialBanner({
  notice,
  canPay,
  needsVerification,
  email,
}: {
  notice: PlanNotice | null;
  canPay: boolean;
  needsVerification: boolean;
  email: string | null;
}) {
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const urgent =
    notice !== null && (notice.kind === "grace" || notice.kind === "renew_soon" || notice.daysLeft <= 7);

  const pay = (label: string) =>
    canPay ? (
      <Link href="/subscription" className="font-semibold underline underline-offset-2">
        {label}
      </Link>
    ) : (
      <span>Ask your company&apos;s owner to {label.toLowerCase()}.</span>
    );

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
      {notice && (
        <div
          role={notice.kind === "grace" ? "status" : undefined}
          className={
            urgent
              ? "flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-status-warning-border bg-status-warning-bg px-5 py-2 text-secondary text-status-warning-text lg:px-8"
              : "flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border-default bg-surface-sunken px-5 py-1.5 text-caption text-text-secondary lg:px-8"
          }
        >
          {notice.kind === "trial" && (
            <>
              <span>
                {notice.daysLeft <= 0
                  ? "Your free trial ends today."
                  : `Free trial: ${notice.daysLeft} day${notice.daysLeft === 1 ? "" : "s"} left (ends ${notice.endsLabel}).`}
              </span>
              {pay("Choose a plan")}
            </>
          )}
          {notice.kind === "renew_soon" && (
            <>
              <span>
                Your plan runs until {notice.untilLabel}
                {notice.daysLeft <= 1 ? "" : ` — ${notice.daysLeft} days left`}.
              </span>
              {pay("Renew")}
            </>
          )}
          {notice.kind === "grace" && (
            <>
              <span>
                Your plan ended on {notice.endedLabel}. Renew by {notice.pausesLabel} to keep using FlowHRMS —
                nothing is deleted either way.
              </span>
              {pay("Renew")}
            </>
          )}
        </div>
      )}
    </div>
  );
}
