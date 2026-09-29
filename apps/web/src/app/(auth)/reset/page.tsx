import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { FlowHRMSLockup } from "@/components/brand/FlowHRMSWordmark";

export const metadata: Metadata = { title: "Set a new password" };

/** Landing page for the reset link sent by email. */
export default function ResetPasswordPage() {
  return (
    <main
      data-surface="employee"
      className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-10 pt-14"
    >
      <FlowHRMSLockup height={28} />
      <h1 className="mt-6 font-heading text-h1 text-text-primary">
        Set a new password
      </h1>
      <p className="mt-2 text-body text-text-secondary">
        Choose a password you haven&apos;t used elsewhere.
      </p>
      <div className="mt-7">
        <ResetPasswordForm />
      </div>
    </main>
  );
}
