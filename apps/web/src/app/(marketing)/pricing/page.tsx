import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import {
  ENTERPRISE_CONTACT,
  ENTERPRISE_NOTE,
  PRICING_FOOTNOTE,
  monthsFreeAcross,
  rupees,
} from "@/lib/marketing/plans";
import { loadMarketingPlans } from "@/lib/billing/store";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Three plans — CORE, PRO and BUSINESS. Each covers a set number of employees. Nothing hidden.",
};

/**
 * Pricing (screen M5).
 *
 * This page shipped as a placeholder of `₹ —` under decision D-018, which
 * said no prices until pricing was set. Pricing is now set and published,
 * and D-018 has been updated to record that. Since 29 Sept 2026 the plans
 * are CORE / PRO / BUSINESS: a base price covering a number of employees,
 * plus a price per extra employee (docs/md/PRICING_MIGRATION_PLAN.md).
 *
 * The figures come from the database (edited in /platform/plans) through
 * loadMarketingPlans() — the same call the homepage section makes. That is the whole point of the module: a
 * customer who compares this page with the homepage must never find two
 * different numbers for the same plan.
 *
 * The page keeps the product's original design language rather than the
 * marketing redesign, which covers the homepage and sign-in only.
 */
/** Re-read hourly, and at once when a plan is saved (revalidatePath). */
export const revalidate = 3600;

export default async function PricingPage() {
  const plans = await loadMarketingPlans();
  const free = monthsFreeAcross(plans);
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-8">
      <h1 className="font-heading text-h1 text-text-primary">Three plans. Nothing hidden.</h1>
      <p className="mt-3 max-w-[72ch] text-body-lg text-text-secondary">
        Each plan covers a set number of employees. Grow past it and you pay only for the extra people.
        {free > 0 ? ` Pay for a year at once and save ${free} ${free === 1 ? "month" : "months"}.` : ""}
      </p>

      <ul className="mt-10 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <li key={plan.key}>
            <Card className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-h2 text-text-primary">{plan.name}</h2>
                {plan.flagship && (
                  <span className="rounded-full bg-brand-primary px-2.5 py-0.5 text-caption font-semibold text-text-on-primary">
                    Most popular
                  </span>
                )}
              </div>
              <p className="mt-1 text-secondary text-text-secondary">{plan.target}</p>

              <p className="mt-4 font-mono text-data-lg font-semibold text-text-primary tabular-nums">
                {rupees(plan.monthly)}
                <span className="font-sans text-body font-normal text-text-secondary"> / month</span>
              </p>
              <p className="text-caption text-text-tertiary">or {rupees(plan.annual)} / year, billed yearly</p>

              <ul className="mt-4 flex flex-1 flex-col gap-1.5 text-body text-text-secondary">
                <li className="font-semibold text-text-primary">{plan.includedEmployees} employees included</li>
                <li>
                  {rupees(plan.extraMonthly)} per additional employee / month ({rupees(plan.extraAnnual)} / year)
                </li>
                {plan.features.map((f) => (
                  <li key={f.label} className={f.strong ? "font-semibold text-text-primary" : undefined}>
                    {f.label}
                  </li>
                ))}
              </ul>

              <Link
                href="/start"
                className="mt-5 inline-flex h-11 items-center justify-center rounded-button border-[1.5px] border-border-strong bg-surface-default px-5 font-heading text-label text-text-primary hover:bg-surface-sunken"
              >
                Start free trial
              </Link>
            </Card>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-caption text-text-tertiary">{PRICING_FOOTNOTE}</p>
      <p className="mt-2 text-secondary text-text-secondary">
        {ENTERPRISE_NOTE}{" "}
        <a href={ENTERPRISE_CONTACT} className="font-semibold text-brand-primary underline-offset-2 hover:underline">
          Talk to us
        </a>
      </p>
    </div>
  );
}
