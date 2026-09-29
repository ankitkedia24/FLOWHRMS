import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession, hasSupabaseUser } from "@/lib/auth/session";
import { accessState, isPaused } from "@/lib/billing/pricing";
import { canManageBilling } from "@/lib/billing/policy";
import { CONTROLLER } from "@/lib/consent/documents";
import { FlowHRMSLockup } from "@/components/brand/FlowHRMSWordmark";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PrivacyControls } from "../(employee)/account/privacy/PrivacyControls";
import { ToastProvider } from "@/components/ui/Toast";
import { consentStandings } from "@/lib/consent/record";

export const metadata: Metadata = { title: "Access paused", robots: { index: false } };

/**
 * Where everyone in a paused company lands: a trial that ran out, or a
 * paid plan a week past its end. Nothing has been deleted: the owner and
 * admins can pay from here, staff are told access is paused, and everyone
 * can still sign out and use their data rights — those do not pause.
 */
export default async function TrialEndedPage() {
  const session = await getAppSession();
  if (!session) redirect((await hasSupabaseUser()) ? "/unauthorized" : "/sign-in");
  const access = accessState(session.tenant, new Date());
  if (!isPaused(access)) redirect("/");
  const trial = access.kind === "trial_ended";
  const canPay = canManageBilling(session);

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
  }).format(access.kind === "trial_ended" ? access.endedAt : access.kind === "lapsed" ? access.until : new Date());
  const what = trial ? "trial" : "plan";

  return (
    <main
      data-surface="employee"
      className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col gap-4 px-5 pb-12 pt-10"
    >
      <FlowHRMSLockup height={28} />
      <h1 className="mt-4 font-heading text-h1 text-text-primary">
        {canPay
          ? trial
            ? "Your free trial has ended"
            : "Your FlowHRMS plan has ended"
          : `${session.tenant.name}'s access is paused`}
      </h1>
      <Alert variant="info" title="Nothing has been deleted.">
        {canPay
          ? `The ${trial ? "free trial" : "paid plan"} for ${session.tenant.name} ended on ${ended}. Your employees, attendance, leave and payroll records are all kept, and everything comes back the moment you choose a plan.`
          : `${session.tenant.name}'s FlowHRMS ${what} ended on ${ended}. Your records are kept. Your company's owner has been told how to continue.`}
      </Alert>

      {canPay && (
        <Card>
          <CardHeader title="Continue with FlowHRMS" />
          <Link href="/subscription" className="block">
            <Button size="lg" className="w-full">
              Choose a plan and pay
            </Button>
          </Link>
          <p className="mt-4 text-body text-text-secondary">
            Everyone can sign in again as soon as the payment goes through. Or talk to us:
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
