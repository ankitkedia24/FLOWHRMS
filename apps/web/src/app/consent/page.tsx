import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppSession, hasSupabaseUser } from "@/lib/auth/session";
import { outstandingNotices } from "@/lib/consent/record";
import { FlowHRMSLockup } from "@/components/brand/FlowHRMSWordmark";
import { ConsentForm } from "./ConsentForm";

export const metadata: Metadata = {
  title: "Your consent",
  robots: { index: false, follow: false },
};

/**
 * Where requireSession() sends anyone who has not consented to the current
 * version of the notice that applies to them — new owners created by the
 * Flowacord team, existing users when a notice changes, and anyone who
 * withdrew consent and came back.
 */
export default async function ConsentPage() {
  const session = await getAppSession();
  if (!session) {
    redirect((await hasSupabaseUser()) ? "/unauthorized" : "/sign-in");
  }
  const outstanding = await outstandingNotices(session);
  if (outstanding.length === 0) redirect("/");

  return (
    <main
      data-surface="employee"
      className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col px-5 pb-12 pt-10"
    >
      <FlowHRMSLockup height={28} />
      <h1 className="mt-7 font-heading text-h1 text-text-primary">
        Before you continue
      </h1>
      <p className="mt-2 text-body text-text-secondary">
        {session.user.displayName}, please read how your personal data is used
        in FlowHRMS and give your consent. You can withdraw it later from
        Account → Privacy &amp; consent.
      </p>
      <div className="mt-6">
        <ConsentForm keys={outstanding} companyName={session.tenant.name} />
      </div>
    </main>
  );
}
