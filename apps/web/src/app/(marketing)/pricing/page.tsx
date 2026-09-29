import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PRICING_FOOTNOTE, annualSaving, rupees } from "@/lib/marketing/plans";
import { loadMarketingPlans } from "@/lib/billing/store";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Priced per employee, per month. Nothing hidden.",
};

/**
 * Pricing (screen M5).
 *
 * This page shipped as a placeholder of `₹ —` under decision D-018, which
 * said no prices until pricing was set. Pricing is now set and published,
 * and D-018 has been updated to record that.
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
  const saving = annualSaving(plans);
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-8">
      <h1 className="font-heading text-h1 text-text-primary">
        Priced per employee. Nothing hidden.
      </h1>
      <p className="mt-3 max-w-[72ch] text-body-lg text-text-secondary">
        Pay for the people on the roster, not for seats you&apos;ll never use.
        {saving > 0 ? ` Annual billing saves up to ${saving}%.` : ""}
      </p>

      <ul className="mt-10 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <li key={plan.key}>
            <Card className="flex h-full flex-col">
              <h2 className="font-heading text-h2 text-text-primary">{plan.name}</h2>
              <p className="mt-1 text-secondary text-text-secondary">{plan.target}</p>

              <p className="mt-4 font-mono text-data-lg font-semibold text-text-primary tabular-nums">
                {rupees(plan.monthly)}
              </p>
              <p className="text-caption text-text-tertiary">
                per employee / month · {rupees(plan.annual)} billed annually
              </p>

              <ul className="mt-4 flex flex-1 flex-col gap-1.5 text-body text-text-secondary">
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
    </div>
  );
}
