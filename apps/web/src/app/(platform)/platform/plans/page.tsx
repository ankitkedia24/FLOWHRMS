import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { MODULES, type ModuleKey } from "@/lib/catalog";
import { loadPlans } from "@/lib/billing/store";
import { PlanEditor } from "./PlanEditor";

export const metadata: Metadata = { title: "Plans" };

/**
 * What Flowacord sells. Prices and bullet points show on the website and
 * in every company's Subscription page as soon as they are saved; module
 * lists apply to a company when it pays, or when "Apply to companies" is
 * pressed here.
 */
export default async function PlansPage() {
  await requirePlatformAdmin();
  const [plans, counts] = await Promise.all([
    loadPlans(),
    getDb().tenant.groupBy({ by: ["billingPlanId"], where: { plan: "PAID" }, _count: true }),
  ]);
  const onPlan = new Map(counts.map((c) => [c.billingPlanId, c._count]));
  const modules = (Object.keys(MODULES) as ModuleKey[])
    .filter((k) => MODULES[k].category !== "CORE")
    .map((k) => ({ key: k, name: MODULES[k].name, optional: MODULES[k].category === "OPTIONAL" }));

  return (
    <>
      <h1 className="font-heading text-h1 text-text-primary">Plans</h1>
      <p className="mt-1 max-w-[720px] text-body text-text-secondary">
        Prices are whole rupees per active employee per month, before GST. Changes show on the website and in the
        app at once, and apply from a company&apos;s next payment. Notifications is always included.
      </p>
      <div className="mt-5 flex flex-col gap-4">
        {plans.map((p) => (
          <PlanEditor
            key={p.id}
            plan={{
              id: p.id,
              key: p.key,
              name: p.name,
              target: p.target,
              priceMonthly: p.priceMonthly,
              priceAnnual: p.priceAnnual,
              modules: p.modules,
              features: p.features.map((f) => (f.strong ? `* ${f.label}` : f.label)).join("\n"),
              flagship: p.flagship,
              active: p.active,
              sortOrder: p.sortOrder,
            }}
            companies={onPlan.get(p.id) ?? 0}
            modules={modules}
          />
        ))}
        <PlanEditor
          plan={null}
          companies={0}
          modules={modules}
          nextSortOrder={Math.max(0, ...plans.map((p) => p.sortOrder)) + 1}
        />
      </div>
    </>
  );
}
