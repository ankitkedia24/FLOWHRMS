import "server-only";

import { getDb } from "@/lib/db";
import { PLANS, type Plan } from "@/lib/marketing/plans";
import { normaliseSeller, type SellerSettings } from "./seller";

/**
 * Reading and writing what Flowacord sells (plans) and who is selling it
 * (the seller details on every invoice).
 */

export interface PlanFeature {
  label: string;
  strong?: boolean;
}

export interface PlanView {
  id: string;
  key: string;
  name: string;
  target: string;
  priceMonthly: number;
  priceAnnual: number;
  includedEmployees: number;
  extraEmployeeMonthly: number;
  extraEmployeeAnnual: number;
  modules: string[];
  features: PlanFeature[];
  flagship: boolean;
  active: boolean;
  sortOrder: number;
}

export function parseFeatures(raw: unknown): PlanFeature[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((f) =>
    f && typeof f === "object" && typeof (f as PlanFeature).label === "string"
      ? [{ label: (f as PlanFeature).label, ...((f as PlanFeature).strong ? { strong: true } : {}) }]
      : [],
  );
}

type PlanRow = {
  id: string;
  key: string;
  name: string;
  target: string;
  priceMonthly: number;
  priceAnnual: number;
  includedEmployees: number;
  extraEmployeeMonthly: number;
  extraEmployeeAnnual: number;
  modules: string[];
  features: unknown;
  flagship: boolean;
  active: boolean;
  sortOrder: number;
};

export function toPlanView(row: PlanRow): PlanView {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    target: row.target,
    priceMonthly: row.priceMonthly,
    priceAnnual: row.priceAnnual,
    includedEmployees: row.includedEmployees,
    extraEmployeeMonthly: row.extraEmployeeMonthly,
    extraEmployeeAnnual: row.extraEmployeeAnnual,
    modules: row.modules,
    features: parseFeatures(row.features),
    flagship: row.flagship,
    active: row.active,
    sortOrder: row.sortOrder,
  };
}

export async function loadPlans(options?: { activeOnly?: boolean }): Promise<PlanView[]> {
  const rows = await getDb().billingPlan.findMany({
    where: options?.activeOnly ? { active: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(toPlanView);
}

/**
 * The plans on the website. Read from the database so a price changed in
 * /platform/plans shows everywhere at once; if the database cannot be
 * reached, the last published list is shown rather than an empty section.
 */
export async function loadMarketingPlans(): Promise<Plan[]> {
  try {
    const plans = await loadPlans({ activeOnly: true });
    if (plans.length === 0) return [...PLANS];
    return plans.map((p) => ({
      key: p.key,
      name: p.name,
      target: p.target,
      monthly: p.priceMonthly,
      annual: p.priceAnnual,
      includedEmployees: p.includedEmployees,
      extraMonthly: p.extraEmployeeMonthly,
      extraAnnual: p.extraEmployeeAnnual,
      flagship: p.flagship,
      features: p.features,
    }));
  } catch {
    return [...PLANS];
  }
}

const SELLER_KEY = "billing_seller";

export async function loadSeller(): Promise<SellerSettings> {
  const row = await getDb().platformSetting.findUnique({ where: { key: SELLER_KEY } });
  return normaliseSeller(row?.value);
}

export async function saveSeller(
  value: unknown,
  updatedById: string,
): Promise<{ before: SellerSettings; after: SellerSettings }> {
  const before = await loadSeller();
  const after = normaliseSeller(value);
  await getDb().platformSetting.upsert({
    where: { key: SELLER_KEY },
    update: { value: after as unknown as object, updatedById },
    create: { key: SELLER_KEY, value: after as unknown as object, updatedById },
  });
  return { before, after };
}

/** People counted for billing: everyone active in the company right now. */
export async function activeEmployeeCount(tenantId: string): Promise<number> {
  return getDb().tenantMembership.count({ where: { tenantId, status: "ACTIVE" } });
}
