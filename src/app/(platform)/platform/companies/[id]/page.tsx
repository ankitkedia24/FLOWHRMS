import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { MODULES, type ModuleKey } from "@/lib/catalog";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { trialDaysLeft, trialExpired } from "@/lib/signup/validate";
import { TenantStatusControl } from "../../TenantStatusControl";
import { TrialControls, ModuleControls, VerifyEmailControl } from "./CompanyControls";

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
      _count: { select: { memberships: true } },
      moduleSettings: { include: { module: { select: { key: true } } } },
      memberships: {
        where: { role: { key: "OWNER" } },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { displayName: true, email: true, phone: true } } },
      },
    },
  });
  if (!tenant) notFound();

  const consents = await db.consentRecord.findMany({
    where: { tenantId: tenant.id },
    orderBy: { seq: "desc" },
    take: 20,
  });

  const now = new Date();
  const expired = trialExpired(tenant, now);
  const daysLeft =
    tenant.plan === "TRIAL" && tenant.trialEndsAt ? trialDaysLeft(tenant.trialEndsAt, now) : null;
  const planChip =
    tenant.plan === "PAID"
      ? { key: "plan-paid", label: "Paid plan", tone: "success" as const }
      : tenant.plan === "TRIAL"
        ? expired
          ? { key: "plan-ended", label: "Trial ended", tone: "warning" as const }
          : { key: "plan-trial", label: `Trial · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`, tone: "info" as const }
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
          {tenant.plan === "TRIAL"
            ? expired
              ? `The trial ended ${fmt(tenant.trialEndsAt, true)}. Everyone sees "Trial ended"; nothing is deleted.`
              : `Trial ends ${fmt(tenant.trialEndsAt, true)}.`
            : tenant.plan === "PAID"
              ? "On a paid plan. No trial end."
              : "Internal company (sample, demo or added before trials). Never expires."}
        </p>
        <div className="mt-4">
          <TrialControls tenantId={tenant.id} plan={tenant.plan} />
        </div>
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
