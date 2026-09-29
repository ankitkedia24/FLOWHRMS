import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { accessState, formatPaise, isPaused, periodStart, type AccessState } from "@/lib/billing/pricing";
import { canManageBilling } from "@/lib/billing/policy";
import { razorpayKeys, razorpayMode } from "@/lib/billing/razorpay";
import { sellerGaps } from "@/lib/billing/seller";
import { activeEmployeeCount, loadPlans, loadSeller, toPlanView } from "@/lib/billing/store";
import { FlowHRMSLockup } from "@/components/brand/FlowHRMSWordmark";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ToastProvider } from "@/components/ui/Toast";
import { SubscribeForm } from "./SubscribeForm";

export const metadata: Metadata = { title: "Subscription", robots: { index: false } };

/**
 * Where a company chooses a plan and pays for it — during the trial, when
 * a paid period is about to end, and after the company has paused (so it
 * sits outside the admin shell, which a paused company cannot open).
 */
export default async function SubscriptionPage() {
  const session = await requireSession({ allowPaused: true });
  const now = new Date();
  const access = accessState(session.tenant, now);
  const paused = isPaused(access);
  const back = paused ? null : session.permissions.has("admin.access") ? "/admin" : "/";

  if (!canManageBilling(session)) {
    return (
      <Shell back={back} companyName={session.tenant.name}>
        <Alert variant="info" title="Ask your company's owner">
          Only the owner or an admin of {session.tenant.name} can see and change its FlowHRMS plan.
        </Alert>
      </Shell>
    );
  }

  const db = getDb();
  const [plans, tenant, employees, seller, payments] = await Promise.all([
    loadPlans({ activeOnly: true }),
    db.tenant.findUniqueOrThrow({ where: { id: session.tenant.id }, include: { billingPlan: true } }),
    activeEmployeeCount(session.tenant.id),
    loadSeller(),
    db.billingPayment.findMany({
      where: { tenantId: session.tenant.id, status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 24,
    }),
  ]);
  const currentPlan = tenant.billingPlan ? toPlanView(tenant.billingPlan) : null;
  // A company on a plan Flowacord has since hidden can still renew it.
  const offered = currentPlan && !plans.some((p) => p.id === currentPlan.id) ? [currentPlan, ...plans] : plans;
  const ready = razorpayKeys() !== null && sellerGaps(seller).length === 0;
  const mode = razorpayMode();

  const tz = session.tenant.timezone;
  const date = (d: Date) =>
    new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: tz }).format(d);

  return (
    <Shell back={back} companyName={session.tenant.name}>
      <StatusCard access={access} planName={currentPlan?.name ?? null} date={date} />

      {mode === "test" && ready && (
        <Alert variant="info" title="Test mode">
          Payments here use Razorpay test keys — no real money is taken, and invoices are for testing.
        </Alert>
      )}

      <ToastProvider>
        <SubscribeForm
          plans={offered.map((p) => ({
            key: p.key,
            name: p.name,
            target: p.target,
            priceMonthly: p.priceMonthly,
            priceAnnual: p.priceAnnual,
            includedEmployees: p.includedEmployees,
            extraEmployeeMonthly: p.extraEmployeeMonthly,
            extraEmployeeAnnual: p.extraEmployeeAnnual,
            flagship: p.flagship,
            // What each plan unlocks is decided tier by tier later; until
            // then the plans show prices only (owner, 29 Sept 2026).
            features: p.features,
          }))}
          currentPlanKey={currentPlan?.key ?? null}
          currentCycle={tenant.billingCycle}
          employees={employees}
          sellerState={seller.state}
          startsLabel={date(periodStart(tenant, now))}
          startsLater={periodStart(tenant, now).getTime() > now.getTime() + 60_000}
          ready={ready}
          buyer={{
            name: tenant.billingName ?? tenant.name,
            gstin: tenant.billingGstin ?? "",
            address: tenant.billingAddress ?? "",
            city: tenant.billingCity ?? tenant.addressCity ?? "",
            state: tenant.billingState ?? tenant.addressState ?? "",
            pincode: tenant.billingPincode ?? tenant.addressPincode ?? "",
          }}
        />
      </ToastProvider>

      <Card>
        <CardHeader title="Payments and invoices" meta="Tax invoices for every payment, to print or save as PDF." />
        {payments.length === 0 ? (
          <p className="text-body text-text-secondary">No payments yet.</p>
        ) : (
          <ul className="-my-2 divide-y divide-border-default">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                <div className="min-w-0">
                  <p className="text-body font-semibold text-text-primary">
                    {p.planName} · {p.cycle === "ANNUAL" ? "1 year" : "1 month"} · {p.employees}{" "}
                    {p.employees === 1 ? "employee" : "employees"}
                  </p>
                  <p className="font-mono text-caption text-text-secondary">
                    {p.invoiceNumber} · paid {date(p.paidAt!)} · covers {date(p.periodStart!)} – {date(p.periodEnd!)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-body font-semibold text-text-primary">{formatPaise(p.totalPaise)}</span>
                  <Link
                    href={`/subscription/invoice/${p.id}`}
                    className="text-secondary font-semibold text-brand-primary underline-offset-2 hover:underline"
                  >
                    Invoice
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-caption text-text-secondary">
        Questions about plans or invoices? Write to help@flowacord.com or call +91 89088 88880.
      </p>
    </Shell>
  );
}

function Shell({
  back,
  companyName,
  children,
}: {
  back: string | null;
  companyName: string;
  children: React.ReactNode;
}) {
  return (
    <main
      data-surface="admin"
      className="mx-auto flex min-h-dvh w-full max-w-[960px] flex-col gap-4 px-4 pb-12 pt-6 sm:px-6"
    >
      <div className="flex items-center justify-between gap-3">
        <FlowHRMSLockup height={26} />
        <form action="/auth/sign-out" method="post">
          <Button type="submit" variant="tertiary" size="sm">
            Sign out
          </Button>
        </form>
      </div>
      {back && (
        <Link
          href={back}
          className="inline-flex w-fit items-center gap-1.5 text-secondary font-semibold text-brand-primary underline-offset-2 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to FlowHRMS
        </Link>
      )}
      <div>
        <h1 className="font-heading text-h1 text-text-primary">Subscription</h1>
        <p className="mt-1 text-body text-text-secondary">{companyName}</p>
      </div>
      {children}
    </main>
  );
}

function StatusCard({
  access,
  planName,
  date,
}: {
  access: AccessState;
  planName: string | null;
  date: (d: Date) => string;
}) {
  switch (access.kind) {
    case "trial":
      return (
        <Alert variant="info" title={access.daysLeft === null ? "Free trial" : `Free trial — ${Math.max(access.daysLeft, 0)} days left`}>
          {access.endsAt
            ? `Your trial runs until ${date(access.endsAt)}. Choose a plan any time — the days left are kept, and the paid period starts when the trial ends.`
            : "Choose a plan whenever you're ready."}
        </Alert>
      );
    case "trial_ended":
      return (
        <Alert variant="warning" title="Your free trial has ended">
          {`It ended on ${date(access.endedAt)}. Nothing has been deleted — choose a plan below and everyone can sign in again straight away.`}
        </Alert>
      );
    case "paid":
      return (
        <Alert variant="success" title={`${planName ?? "Paid"} plan${access.until ? ` — paid until ${date(access.until)}` : ""}`}>
          {access.until
            ? "Pay again below to add another month or year; it starts when the current period ends."
            : "Your plan has no end date set. Talk to us to change it."}
        </Alert>
      );
    case "grace":
      return (
        <Alert variant="warning" title={`Your plan ended on ${date(access.until)}`}>
          {`Everything keeps working until ${date(access.pausesAt)}. Renew before then to avoid a pause — nothing is deleted either way.`}
        </Alert>
      );
    case "lapsed":
      return (
        <Alert variant="warning" title="Your plan has ended">
          {`It ended on ${date(access.until)} and your company is paused. Nothing has been deleted — renew below and everyone can sign in again straight away.`}
        </Alert>
      );
    default:
      return (
        <Alert variant="info" title="Managed by Flowacord">
          This company&apos;s access is arranged directly with Flowacord.
        </Alert>
      );
  }
}
