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

/** "Asha", "Asha and Ravi", "Asha, Ravi and Meena". */
function listNames(names: string[]): string {
  return names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await redeemEmailVerification(decodeURIComponent(token));
  const { sent, failed, unfinished } = result.ok
    ? result.invitations
    : { sent: [], failed: [], unfinished: false };
  const waited = sent.length + failed.length > 0 || unfinished;

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
          {sent.length > 0 && (
            <div className="mt-4">
              <Alert
                variant="success"
                title={
                  sent.length === 1
                    ? `Invitation sent to ${sent[0]}.`
                    : `Invitations sent to ${sent.length} people.`
                }
              >
                {sent.length > 1 && <>{listNames(sent)}. </>}
                {sent.length === 1 ? "They were" : "These were"} waiting for this
                confirmation. Each gets an email with a link to choose a password.
              </Alert>
            </div>
          )}
          {failed.length > 0 && (
            <div className="mt-4">
              <Alert variant="warning" title={`We couldn't email ${listNames(failed)}.`}>
                Open {failed.length === 1 ? "them" : "each of them"} in Employees and send
                it from there — you&apos;ll also get a link you can share on WhatsApp.
              </Alert>
            </div>
          )}
          {unfinished && (
            <div className="mt-4">
              <Alert variant="warning" title="Some invitations that were waiting weren't sent.">
                Open Employees: anyone showing “Not invited” needs “Send invitation”.
              </Alert>
            </div>
          )}
          <Link
            href={waited ? "/admin/employees" : "/admin/employees/new"}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-button bg-brand-primary px-5 text-label text-text-on-primary"
          >
            {waited ? "Go to Employees" : "Invite your team"}
          </Link>
        </>
      ) : (
        <>
          <h1 className="mt-7 font-heading text-h1 text-text-primary">
            This link doesn&apos;t work
          </h1>
          <div className="mt-4">
            <Alert variant="warning" title="It may have expired or be incomplete.">
              Sign in and use “Send it again” at the top of your dashboard,
              or write to help@flowacord.com.
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
