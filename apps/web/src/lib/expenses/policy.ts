/**
 * The Expenses policy (EXPENSES-MODULE.md §8) — every number, threshold
 * and preference in the module, versioned like every other tenant policy.
 *
 * Categories live HERE, not in a table: they are configuration, versioned
 * with the rest, and a claim snapshots the name and rules that applied at
 * submission. A later edit publishes version n+1 and never rewrites what
 * an approver already saw.
 *
 * Pure: no database, no session. Normalisation is the only entry point
 * that reads stored JSON, so a v1 document read by later code still comes
 * out whole.
 */

/** Platform floor. A tenant may keep receipts longer, never shorter (§8). */
export const RECEIPT_RETENTION_FLOOR_YEARS = 7;

export const SETTLEMENT_ROUTES = ["PAYROLL", "OUTSIDE"] as const;
export type SettlementRoute = (typeof SETTLEMENT_ROUTES)[number];

export interface ExpenseCategory {
  /** Stable slug, never shown. */
  key: string;
  /** Shown. */
  name: string;
  receiptRequired: boolean;
  /** Rupees; null = no cap. Over cap is flagged, never refused. */
  maxClaimAmount: number | null;
  /** Retired categories stay for history and cannot be chosen. */
  isActive: boolean;
  sortOrder: number;
}

export interface ExpensesPolicy {
  /** Days after the expense date; later = flagged, never refused. */
  submissionDeadlineDays: number;
  /** Falls back to OUTSIDE when Payroll is unavailable (§12). */
  defaultSettlementRoute: SettlementRoute;
  allowSelfApproval: boolean;
  /** Years after settlement; ≥ RECEIPT_RETENTION_FLOOR_YEARS. */
  receiptRetentionYears: number;
  categories: ExpenseCategory[];
}

/** Offered on first enable — editable, not imposed (§8). */
export const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  { key: "local-travel", name: "Local travel", receiptRequired: false, maxClaimAmount: null, isActive: true, sortOrder: 10 },
  { key: "fuel", name: "Fuel", receiptRequired: true, maxClaimAmount: null, isActive: true, sortOrder: 20 },
  { key: "customer-meals", name: "Customer meals", receiptRequired: true, maxClaimAmount: null, isActive: true, sortOrder: 30 },
  { key: "site-material", name: "Site material", receiptRequired: true, maxClaimAmount: null, isActive: true, sortOrder: 40 },
  { key: "phone-data", name: "Phone / data", receiptRequired: false, maxClaimAmount: null, isActive: true, sortOrder: 50 },
  { key: "other", name: "Other", receiptRequired: true, maxClaimAmount: null, isActive: true, sortOrder: 60 },
];

export const DEFAULT_EXPENSES_POLICY: ExpensesPolicy = {
  submissionDeadlineDays: 30,
  defaultSettlementRoute: "PAYROLL",
  allowSelfApproval: false,
  receiptRetentionYears: RECEIPT_RETENTION_FLOOR_YEARS,
  categories: DEFAULT_CATEGORIES,
};

/** Category keys are slugs of the name; stable once published. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

/** Two decimal places at most, never negative. */
export function roundMoney(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100;
}

function normalizeCategory(raw: unknown, index: number): ExpenseCategory | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name, "").trim().slice(0, 60);
  if (!name) return null;
  const key = slugify(str(r.key, "")) || slugify(name);
  if (!key) return null;
  const capRaw = r.maxClaimAmount;
  const cap =
    typeof capRaw === "number" && Number.isFinite(capRaw) && capRaw > 0
      ? roundMoney(capRaw)
      : null;
  return {
    key,
    name,
    receiptRequired: bool(r.receiptRequired, true),
    maxClaimAmount: cap,
    isActive: bool(r.isActive, true),
    sortOrder: Math.round(num(r.sortOrder, (index + 1) * 10)),
  };
}

/**
 * Fill defaults, clamp ranges, drop broken categories, de-duplicate keys
 * (first wins). Never throws: a stored document is always readable.
 */
export function normalizeExpensesPolicy(input: unknown): ExpensesPolicy {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const deadline = Math.round(num(raw.submissionDeadlineDays, DEFAULT_EXPENSES_POLICY.submissionDeadlineDays));
  const route = raw.defaultSettlementRoute;
  const retention = Math.round(num(raw.receiptRetentionYears, RECEIPT_RETENTION_FLOOR_YEARS));

  const seen = new Set<string>();
  const categories: ExpenseCategory[] = [];
  if (Array.isArray(raw.categories)) {
    raw.categories.forEach((c, i) => {
      const cat = normalizeCategory(c, i);
      if (!cat || seen.has(cat.key)) return;
      seen.add(cat.key);
      categories.push(cat);
    });
  }
  categories.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  return {
    submissionDeadlineDays: Math.min(3650, Math.max(1, deadline)),
    defaultSettlementRoute:
      route === "OUTSIDE" || route === "PAYROLL" ? route : DEFAULT_EXPENSES_POLICY.defaultSettlementRoute,
    allowSelfApproval: bool(raw.allowSelfApproval, false),
    receiptRetentionYears: Math.min(99, Math.max(RECEIPT_RETENTION_FLOOR_YEARS, retention)),
    categories,
  };
}

export function activeCategories(policy: ExpensesPolicy): ExpenseCategory[] {
  return policy.categories.filter((c) => c.isActive);
}

export function categoryByKey(policy: ExpensesPolicy, key: string): ExpenseCategory | null {
  return policy.categories.find((c) => c.key === key) ?? null;
}

/** The module cannot be used until someone can actually choose a category. */
export function policyIsUsable(policy: ExpensesPolicy): boolean {
  return activeCategories(policy).length > 0;
}
