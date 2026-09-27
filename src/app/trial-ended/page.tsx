import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppSession, hasSupabaseUser } from "@/lib/auth/session";
import { trialExpired } from "@/lib/signup/validate";
import { CONTROLLER } from "@/lib/consent/documents";
import { FlowHRMSLockup } from "@/components/brand/FlowHRMSWordmark";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PrivacyControls } from "../(employee)/account/privacy/PrivacyControls";
import { ToastProvider } from "@/components/ui/Toast";
import { consentStandings } from "@/lib/consent/record";

export const metadata: Metadata = { title: "Trial ended", robots: { index: false } };

/**
 * Where everyone in a company whose trial has run out lands. Nothing has
 * been deleted: the owner is told how to continue, staff are told access is
 * paused, and everyone can still sign out and use their data rights —
 * those do not pause with the trial.
 */
export default async function TrialEndedPage() {
  const session = await getAppSession();
  if (!session) redirect((await hasSupabaseUser()) ? "/unauthorized" : "/sign-in");
  if (!trialExpired(session.tenant, new Date())) redirect("/");

  const isOwner = session.membership.roleKey === "OWNER";
  const [account] = isOwner ? await consentStandings(session.user.id, ["account_holder"]) : [];
  const productUpdates =
    account?.status.state === "current" &&
    account.status.choices.some((c) => c.key === "product_updates" && c.granted);
  const ended = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: session.tenant.timezone,
  }).format(session.tenant.trialEndsAt!);

  return (
    <main
      data-surface="employee"
      className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col gap-4 px-5 pb-12 pt-10"
    >
      <FlowHRMSLockup height={28} />
      <h1 className="mt-4 font-heading text-h1 text-text-primary">
        {isOwner ? "Your free trial has ended" : `${session.tenant.name}'s access is paused`}
      </h1>
      <Alert variant="info" title="Nothing has been deleted.">
        {isOwner
          ? `The free trial for ${session.tenant.name} ended on ${ended}. Your employees, attendance, leave and payroll records are all kept, and everything comes back the moment your account continues.`
          : `${session.tenant.name}'s FlowHRMS trial ended on ${ended}. Your records are kept. Your company's owner has been told how to continue.`}
      </Alert>

      {isOwner && (
        <Card>
          <CardHeader title="Continue with FlowHRMS" />
          <p className="text-body text-text-secondary">
            Talk to us to choose a plan or extend your trial:
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-body">
            <li>
              Email{" "}
              <a
                href={`mailto:${CONTROLLER.email}?subject=${encodeURIComponent(`Continue FlowHRMS — ${session.tenant.name}`)}`}
                className="text-brand-primary underline-offset-2 hover:underline"
              >
                {CONTROLLER.email}
              </a>
            </li>
            <li>
              Call or WhatsApp{" "}
              <a href="tel:+918908888880" className="text-brand-primary underline-offset-2 hover:underline">
                {CONTROLLER.phone}
              </a>
            </li>
          </ul>
        </Card>
      )}

      <ToastProvider>
        <PrivacyControls isOwner={isOwner} productUpdates={productUpdates} />
      </ToastProvider>

      <form action="/auth/sign-out" method="post">
        <Button type="submit" variant="outline" size="lg" className="w-full">
          Sign out
        </Button>
      </form>
    </main>
  );
}
