import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { isModuleBuilt, MODULES, type ModuleKey } from "@/lib/catalog";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { accessState, formatPaise } from "@/lib/billing/pricing";
import { loadPlans } from "@/lib/billing/store";
import { TenantStatusControl } from "../../TenantStatusControl";
import { TrialControls, ModuleControls, PaidPlanControl, VerifyEmailControl } from "./CompanyControls";
import { SupportControl } from "./SupportControl";
import { supportRefusal } from "@/lib/platform/support-policy";
import { ownerTermsVersion } from "@/lib/platform/support-terms";

export const metadata: Metadata = { title: "Company" };

function fmt(date: Date | null, withTime = false): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: "Asia/Kolkata",
  }).format(date);
}

/**
 * Everything Flowacord controls about one company: its trial or plan, the
 * modules it has, whether its owner is verified, its status — and the
 * consent it gave. No access to the company's own data from here.
 */
export default async function PlatformCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const db = getDb();
  const tenant = await db.tenant.findUnique({
    where: { id },
    include: {
      billingPlan: { select: { key: true, name: true } },
      // Not the hidden Flowacord support member (lib/auth/support.ts).
      _count: { select: { memberships: { where: { status: { not: "SUPPORT" } } } } },
      moduleSettings: { include: { module: { select: { key: true } } } },
      memberships: {
        where: { role: { key: "OWNER" }, status: { not: "SUPPORT" } },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { displayName: true, email: true, phone: true } } },
      },
    },
  });
  if (!tenant) notFound();

  const [consents, payments, plans, termsVersion] = await Promise.all([
    db.consentRecord.findMany({
      where: { tenantId: tenant.id },
      orderBy: { seq: "desc" },
      take: 20,
    }),
    db.billingPayment.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    loadPlans(),
    ownerTermsVersion(tenant.id),
  ]);

  const now = new Date();
  const access = accessState(tenant, now);
  const planName = tenant.billingPlan?.name ?? "Paid plan";
  const planChip =
    access.kind === "paid"
      ? { key: "plan-paid", label: planName, tone: "success" as const }
      : access.kind === "grace"
        ? { key: "plan-grace", label: `${planName} · grace, ${access.daysLeft}d left`, tone: "warning" as const }
        : access.kind === "lapsed"
          ? { key: "plan-lapsed", label: "Plan ended · paused", tone: "warning" as const }
          : access.kind === "trial_ended"
            ? { key: "plan-ended", label: "Trial ended", tone: "warning" as const }
            : access.kind === "trial"
              ? {
                  key: "plan-trial",
                  label: access.daysLeft === null ? "Trial" : `Trial · ${access.daysLeft} day${access.daysLeft === 1 ? "" : "s"} left`,
                  tone: "info" as const,
                }
              : { key: "plan-internal", label: "Internal", tone: "neutral" as const };

  const modules = (Object.keys(MODULES) as ModuleKey[])
    .filter((k) => MODULES[k].category !== "CORE")
    .map((k) => {
      const s = tenant.moduleSettings.find((m) => m.module.key === k);
      return {
        key: k,
        name: MODULES[k].name,
        category: MODULES[k].category,
        enabled: s?.enabled ?? false,
        allowed: s?.allowedByPlatform ?? true,
        built: isModuleBuilt(k),
      };
    });

  const owner = tenant.memberships[0];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/platform" className="text-label text-brand-primary underline-offset-2 hover:underline">
          ← Companies
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-h1 text-text-primary">{tenant.name}</h1>
          <StatusChip status={planChip} size="sm" />
        </div>
        <p className="font-mono text-mono text-text-tertiary">
          {tenant.slug} · {tenant._count.memberships} people · added {fmt(tenant.createdAt)}
          {tenant.selfSignup ? " · self sign-up" : " · added by Flowacord"}
        </p>
      </div>

      <Card>
        <CardHeader title="Trial and plan" />
        <p className="text-body text-text-secondary">
          {access.kind === "trial_ended"
            ? `The trial ended ${fmt(tenant.trialEndsAt, true)}. Everyone sees "Access paused"; nothing is deleted.`
            : access.kind === "trial"
              ? `Trial ends ${fmt(tenant.trialEndsAt, true)}.`
              : access.kind === "paid"
                ? `${planName}, billed ${tenant.billingCycle === "ANNUAL" ? "yearly" : "monthly"}. ${access.until ? `Paid until ${fmt(access.until, true)}.` : "No end date."}`
                : access.kind === "grace"
                  ? `${planName} ended ${fmt(access.until, true)}. In the 7-day grace period; pauses ${fmt(access.pausesAt, true)} unless renewed.`
                  : access.kind === "lapsed"
                    ? `${planName} ended ${fmt(access.until, true)} and the company is paused. Nothing is deleted.`
                    : "Internal company (sample, demo or added before trials). Never expires."}
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <TrialControls
            tenantId={tenant.id}
            name={tenant.name}
            plan={tenant.plan}
            trialEnded={access.kind === "trial_ended"}
          />
          <PaidPlanControl
            tenantId={tenant.id}
            plans={plans.map((p) => ({ key: p.key, name: `${p.name}${p.active ? "" : " (hidden)"}` }))}
            currentPlanKey={tenant.billingPlan?.key ?? null}
            currentCycle={tenant.billingCycle}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Payments" meta="Online payments through Razorpay, with their tax invoices." />
        {payments.length === 0 ? (
          <p className="text-secondary text-text-secondary">No payments yet.</p>
        ) : (
          <ul className="flex flex-col">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle py-2 last:border-0">
                <span className="text-body text-text-primary">
                  {p.planName} · {p.cycle === "ANNUAL" ? "1 year" : "1 month"} · {p.employees} employees ·{" "}
                  <span className="font-mono">{formatPaise(p.totalPaise)}</span>
                </span>
                <span className="text-caption text-text-secondary">
                  {p.status === "PAID" ? (
                    <Link href={`/subscription/invoice/${p.id}`} className="text-brand-primary underline-offset-2 hover:underline">
                      {p.invoiceNumber}
                    </Link>
                  ) : (
                    `Not completed${p.failureReason ? ` — ${p.failureReason}` : ""}`
                  )}{" "}
                  · {fmt(p.paidAt ?? p.createdAt, true)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Owner and sign-up details" />
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-[12rem_1fr]">
          <Row label="Owner" value={owner ? `${owner.user.displayName} <${owner.user.email ?? "no email"}>` : "—"} />
          <Row label="Owner's mobile" value={owner?.user.phone ?? "—"} />
          <Row label="Owner joined" value={owner ? (owner.status === "ACTIVE" ? "Yes — password set" : "Not yet") : "—"} />
          <Row
            label="Email confirmed"
            value={tenant.selfSignup ? (tenant.ownerEmailVerifiedAt ? `Yes — ${fmt(tenant.ownerEmailVerifiedAt, true)}` : "No — cannot invite staff yet") : "Not needed (added by Flowacord)"}
          />
          <Row label="Industry" value={tenant.industry ?? "—"} />
          <Row label="Staff count" value={tenant.staffCount ? String(tenant.staffCount) : "—"} />
          <Row
            label="Address"
            value={[tenant.addressCity, tenant.addressState, tenant.addressPincode, tenant.addressCountry].filter(Boolean).join(", ") || "—"}
          />
          <Row label="Their role" value={tenant.signupRole ?? "—"} />
          <Row label="Heard about us" value={tenant.signupHeardFrom ?? "—"} />
        </dl>
        {tenant.selfSignup && !tenant.ownerEmailVerifiedAt && (
          <div className="mt-4">
            <VerifyEmailControl tenantId={tenant.id} />
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Modules" meta="Included modules are on and the company manages them. Removed ones are off and show “Not in your plan”." />
        <ModuleControls tenantId={tenant.id} modules={modules} />
      </Card>

      <Card>
        <CardHeader title="Access" />
        <TenantStatusControl tenantId={tenant.id} name={tenant.name} status={tenant.status} people={tenant._count.memberships} />
      </Card>

      <Card>
        <CardHeader title="Support" meta="Work inside this company to help them — docs/md/SUPPORT-ACCESS.md." />
        <SupportControl tenantId={tenant.id} refusal={supportRefusal(tenant, termsVersion)} />
      </Card>

      <Card>
        <CardHeader
          title="Consent records"
          action={
            <a
              href={`/platform/consents/export?format=csv&q=${encodeURIComponent(tenant.name)}`}
              className="text-label text-brand-primary underline-offset-2 hover:underline"
            >
              Export CSV
            </a>
          }
        />
        {consents.length === 0 ? (
          <p className="text-secondary text-text-secondary">None recorded for this company.</p>
        ) : (
          <ul className="flex flex-col">
            {consents.map((c) => (
              <li key={c.id} className="border-b border-border-subtle last:border-0">
                <Link href={`/platform/consents/${c.id}`} className="flex flex-wrap justify-between gap-2 py-2 hover:bg-surface-sunken">
                  <span className="text-body text-text-primary">
                    {c.email} · {c.noticeKey} v{c.noticeVersion}
                  </span>
                  <span className="text-caption text-text-secondary">
                    {c.action} · {fmt(c.createdAt, true)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-secondary text-text-secondary">{label}</dt>
      <dd className="break-words text-body text-text-primary">{value}</dd>
    </>
  );
}
