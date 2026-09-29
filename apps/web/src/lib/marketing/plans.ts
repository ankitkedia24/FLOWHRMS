/**
 * Published pricing — the fallback list. Since 27 Sept 2026 the live
 * prices are in the database (billing_plans), edited in /platform/plans and
 * read by loadMarketingPlans(); this list is shown only if the database
 * cannot be reached or offers no plan.
 *
 * Since 29 Sept 2026 FlowHRMS sells exactly three public plans — CORE, PRO
 * and BUSINESS (docs/md/PRICING_MIGRATION_PLAN.md). Each is a base price
 * that covers a number of active employees, plus a price for each employee
 * above that. A year paid at once costs ten months, for the base and for
 * each extra employee.
 *
 * The homepage section and the standalone /pricing page both read from
 * here, so the product can never quote two different figures for the same
 * plan. What each plan unlocks is decided tier by tier later; until then
 * the cards show prices only, no module list.
 *
 * Figures are whole rupees, excluding GST.
 */

export interface Plan {
  key: string;
  name: string;
  /** Who it is for, in the customer's words. */
  target: string;
  /** Base price for a month. */
  monthly: number;
  /** Base price for a year paid at once. */
  annual: number;
  /** Active employees the base price covers. */
  includedEmployees: number;
  /** Each employee above that, per month (monthly billing). */
  extraMonthly: number;
  /** Each employee above that, per year (annual billing). */
  extraAnnual: number;
  /** The one plan rendered as "Most popular". Exactly one should be true. */
  flagship: boolean;
  features: ReadonlyArray<{ label: string; strong?: boolean }>;
}

export const PLANS: readonly Plan[] = [
  {
    key: "core",
    name: "CORE",
    target: "Small businesses and first-time HRMS buyers",
    monthly: 1499,
    annual: 14990,
    includedEmployees: 25,
    extraMonthly: 49,
    extraAnnual: 490,
    flagship: false,
    features: [],
  },
  {
    key: "pro",
    name: "PRO",
    target: "Growing businesses and distributed teams",
    monthly: 2999,
    annual: 29990,
    includedEmployees: 50,
    extraMonthly: 59,
    extraAnnual: 590,
    flagship: true,
    features: [],
  },
  {
    key: "business",
    name: "BUSINESS",
    target: "Organisations with 100 or more employees",
    monthly: 6999,
    annual: 69990,
    includedEmployees: 100,
    extraMonthly: 49,
    extraAnnual: 490,
    flagship: false,
    features: [],
  },
];

export const PRICING_FOOTNOTE =
  "Every employee gets the phone app. Prices exclude GST.";

/** Below the plans (pricing brief §14): larger and private deployments are a conversation. */
export const ENTERPRISE_NOTE = "Need private deployment or 1,000+ employees?";
export const ENTERPRISE_CONTACT = "mailto:help@flowacord.com?subject=FlowHRMS%20for%20a%20larger%20organisation";

/**
 * Whole months a year paid at once saves, across the plans ("Save 2
 * months"). The smallest, so the badge never promises more than every
 * plan gives.
 */
export function monthsFreeAcross(plans: readonly Plan[]): number {
  const free = plans
    .filter((p) => p.monthly > 0)
    .map((p) => Math.max(0, Math.floor((p.monthly * 12 - p.annual) / p.monthly)));
  return free.length ? Math.min(...free) : 0;
}

/** Rupees, no decimals — these are whole-rupee prices by design. */
export function rupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}
