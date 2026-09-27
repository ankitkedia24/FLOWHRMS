import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { FlowHRMSLockup } from "@/components/brand/FlowHRMSWordmark";
import { redeemEmailVerification } from "@/lib/signup/verify";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await redeemEmailVerification(decodeURIComponent(token));

  return (
    <main
      data-surface="employee"
      className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-10 pt-14"
    >
      <FlowHRMSLockup height={28} />
      {result.ok ? (
        <>
          <h1 className="mt-7 font-heading text-h1 text-text-primary">
            {result.already ? "Already confirmed" : "Email confirmed"}
          </h1>
          <p className="mt-2 text-body text-text-secondary">
            Thank you. {result.companyName} can now invite its team to FlowHRMS.
          </p>
          <Link
            href="/admin/employees/new"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-button bg-brand-primary px-5 text-label text-text-on-primary"
          >
            Invite your team
          </Link>
        </>
      ) : (
        <>
          <h1 className="mt-7 font-heading text-h1 text-text-primary">
            This link doesn&apos;t work
          </h1>
          <div className="mt-4">
            <Alert variant="warning" title="It may have expired or be incomplete.">
              Sign in and use “Send the confirmation email again” on your
              dashboard, or write to help@flowacord.com.
            </Alert>
          </div>
          <Link href="/sign-in" className="mt-5 text-label text-brand-primary underline-offset-2 hover:underline">
            Go to sign in
          </Link>
        </>
      )}
    </main>
  );
}
