/**
 * Published pricing — the fallback list. Since 27 Sept 2026 the live
 * prices are in the database (billing_plans), edited in /platform/plans and
 * read by loadMarketingPlans(); this list is shown only if the database
 * cannot be reached, and seeded the table.
 *
 * Prices went from placeholder to published with the marketing redesign,
 * which is the condition decision D-018 named for reopening ("real pilot
 * outcomes exist and are approved for publication, and pricing is set").
 * The homepage section and the standalone /pricing page both read from
 * here, so the product can never quote two different figures for the same
 * plan — which is the specific failure that made a placeholder safer than
 * a guess in the first place.
 *
 * Figures are per employee per month, in rupees, excluding GST.
 */

export interface Plan {
  key: string;
  name: string;
  /** Who it is for, in the customer's words. */
  target: string;
  monthly: number;
  /** Per-month price when billed annually. */
  annual: number;
  /** The one plan rendered as the flagship. Exactly one should be true. */
  flagship: boolean;
  features: ReadonlyArray<{ label: string; strong?: boolean }>;
}

export const PLANS: readonly Plan[] = [
  {
    key: "starter",
    name: "Starter",
    target: "Small shop / office teams",
    monthly: 49,
    annual: 39,
    flagship: false,
    features: [
      { label: "Attendance" },
      { label: "Tasks" },
      { label: "Leave" },
      { label: "Daily summary" },
    ],
  },
  {
    key: "operations",
    name: "Operations",
    target: "Warehouse, dispatch, delivery teams",
    monthly: 79,
    annual: 69,
    flagship: true,
    features: [
      { label: "Everything in Starter", strong: true },
      { label: "Payroll inputs" },
      { label: "Payslips" },
      { label: "Reports & export" },
      { label: "Module controls" },
    ],
  },
  {
    key: "multi-branch",
    name: "Multi-Branch",
    target: "Companies with multiple branches",
    monthly: 119,
    annual: 99,
    flagship: false,
    features: [
      { label: "Everything in Operations", strong: true },
      { label: "Branch-level review" },
      { label: "Roles & permissions" },
      { label: "Activity log" },
    ],
  },
];

export const PRICING_FOOTNOTE =
  "All plans include the phone app for every employee. Prices exclude GST.";

/** The best yearly saving across plans, as a whole percent ("Save up to 20%"). */
export function annualSaving(plans: readonly Plan[]): number {
  const cuts = plans
    .filter((p) => p.monthly > 0 && p.annual < p.monthly)
    .map((p) => (1 - p.annual / p.monthly) * 100);
  return cuts.length ? Math.round(Math.max(...cuts)) : 0;
}

/** Rupees, no decimals — these are whole-rupee prices by design. */
export function rupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}
