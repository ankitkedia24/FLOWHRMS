import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { FlowHRMSLockup } from "@/components/brand/FlowHRMSWordmark";

export const metadata: Metadata = { title: "Reset password" };

/**
 * Forgot password (screen E2, adapted).
 *
 * The approved design is a 6-digit OTP to a phone. Phone sign-in needs an
 * SMS provider and DLT registration that are not decided yet (D-P1-05), so
 * this sends a reset link by email — the same journey, with the channel
 * we actually have. Tracked as an open product decision.
 */
export default function ForgotPasswordPage() {
  return (
    <main
      data-surface="employee"
      className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-10 pt-14"
    >
      <FlowHRMSLockup height={28} />

      <h1 className="mt-6 font-heading text-h1 text-text-primary">
        Reset password
      </h1>
      <p className="mt-2 text-body text-text-secondary">
        We&apos;ll email you a link to set a new password.
      </p>

      <div className="mt-7">
        <ForgotPasswordForm />
      </div>

      <div className="mt-6">
        <Link
          href="/sign-in"
          className="text-label text-brand-primary underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      </div>

      <div className="mt-auto rounded-surface-card border border-border-default bg-surface-default p-4">
        <p className="text-caption text-text-secondary">
          Can&apos;t sign in? Ask your company&apos;s admin or owner to check
          your details. FlowHRMS support (help@flowacord.com) cannot open your company&apos;s data
          without a logged, time-bound request from your owner.
        </p>
      </div>
    </main>
  );
}
