import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Card, CardHeader } from "@/components/ui/Card";
import { CompanyForm } from "./CompanyForm";
import { BrandingCard } from "./BrandingCard";
import { loadSettingsBranding } from "@/lib/branding/load";

export const metadata: Metadata = { title: "Company settings" };

/** Company / tenant settings (screen A24). */
export default async function CompanySettingsPage() {
  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "settings.manage",
  });
  if (!decision.allowed) redirect("/unauthorized");

  const counts = devFixtureOffline()
    ? { people: 0, locations: 0 }
    : {
        people: await getDb().tenantMembership.count({
          where: { tenantId: session.tenant.id, status: "ACTIVE" },
        }),
        locations: await getDb().branch.count({
          where: { tenantId: session.tenant.id, isActive: true },
        }),
      };

  // Field visits is optional, switched on per company by Flowacord; its
  // rules link shows only where it is on.
  const fieldVisitsOn = (
    await checkAccess({ module: "FIELD_VISITS", permission: "policy.edit" })
  ).decision.allowed;

  // The logo and animation live in private storage (company-media), shown
  // through short-lived signed links.
  const branding = devFixtureOffline() ? null : await loadSettingsBranding(session.tenant.id);

  return (
    <div className="flex max-w-[760px] flex-col gap-5">
      <h1 className="font-heading text-h1 text-text-primary">
        Company settings
      </h1>

      <CompanyForm
        name={session.tenant.name}
        timezone={session.tenant.timezone}
      />

      <Card>
        <CardHeader title="Your company at a glance" />
        <dl className="flex flex-col gap-2">
          <Row label="People" value={String(counts.people)} />
          <Row label="Locations" value={String(counts.locations)} />
        </dl>
        <div className="mt-3 flex flex-wrap gap-4 border-t border-border-subtle pt-3">
          <Link
            href="/admin/settings/attendance"
            className="text-label text-brand-primary underline-offset-2 hover:underline"
          >
            Locations, shifts &amp; rules
          </Link>
          <Link
            href="/admin/settings/departments"
            className="text-label text-brand-primary underline-offset-2 hover:underline"
          >
            Departments
          </Link>
          <Link
            href="/admin/settings/expenses"
            className="text-label text-brand-primary underline-offset-2 hover:underline"
          >
            Expense rules
          </Link>
          {fieldVisitsOn && (
            <Link
              href="/admin/settings/field-visits"
              className="text-label text-brand-primary underline-offset-2 hover:underline"
            >
              Field visit rules
            </Link>
          )}
          <Link
            href="/admin/settings/notifications"
            className="text-label text-brand-primary underline-offset-2 hover:underline"
          >
            Notifications
          </Link>
          <Link
            href="/admin/employees"
            className="text-label text-brand-primary underline-offset-2 hover:underline"
          >
            Employees
          </Link>
        </div>
      </Card>

      {branding && (
        <BrandingCard
          tenantId={session.tenant.id}
          logoUrl={branding.logoUrl}
          splash={branding.splash}
        />
      )}

      <Card>
        <CardHeader title="Data and privacy" />
        <p className="text-secondary text-text-secondary">
          Employees can ask for a copy of their own records. Deletion
          requests are handled subject to legal obligations. Retention
          windows for location, files, payroll and logs must be agreed
          before production use — they are not set in this build.
        </p>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2 last:border-0">
      <dt className="text-secondary text-text-secondary">{label}</dt>
      <dd className="font-mono text-data text-text-primary tabular-nums">
        {value}
      </dd>
    </div>
  );
}
