/**
 * The arithmetic of a subscription: what a period costs, the GST on it,
 * when it runs, the invoice number, and whether the company has access.
 * Pure — no database, no clock — so every rule here is tested
 * (src/tests/billing.test.ts).
 *
 * A plan is a base price that covers a number of active employees, plus a
 * price for each employee above that (docs/md/PRICING_MIGRATION_PLAN.md).
 * The price list is whole rupees; everything else is paise. 9% and 18% of
 * a whole-rupee amount are whole paise, so nothing here ever rounds.
 */

export type Cycle = "MONTHLY" | "ANNUAL";

/** Access continues this many days after a paid period ends, then pauses. */
export const GRACE_DAYS = 7;
export const GST_RATE_PERCENT = 18;
/** A sanity cap well under the Int column and Razorpay's per-order limit. */
export const MAX_ORDER_PAISE = 50_00_000 * 100; // ₹50 lakh

const DAY = 24 * 60 * 60 * 1000;
/** India Standard Time, for financial years and "end of day". */
const IST_OFFSET = (5 * 60 + 30) * 60 * 1000;

export function monthsIn(cycle: Cycle): number {
  return cycle === "ANNUAL" ? 12 : 1;
}

/** A plan's price list, in whole rupees, excluding GST. */
export interface PlanPrice {
  /** The base price for a month. */
  priceMonthly: number;
  /** The base price for a year paid at once. */
  priceAnnual: number;
  /** Active employees the base price covers. */
  includedEmployees: number;
  /** Each active employee above that, per month (monthly billing). */
  extraEmployeeMonthly: number;
  /** Each active employee above that, per year (annual billing). */
  extraEmployeeAnnual: number;
}

export interface Quote {
  cycle: Cycle;
  months: number;
  /** Active employees counted. */
  employees: number;
  includedEmployees: number;
  /** Employees above the included number, charged at `extraRateRupees`. */
  extraEmployees: number;
  /** The plan's base price for this cycle (a month, or a year). */
  baseRupees: number;
  /** Rupees per extra employee for this cycle (a month, or a year). */
  extraRateRupees: number;
  basePaise: number;
  extraPaise: number;
  subtotalPaise: number;
  /** Buyer and seller in the same state: CGST + SGST. Otherwise IGST. */
  intraState: boolean;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
}

/** The base price and the per-extra-employee price for one cycle. */
export function cyclePrices(plan: PlanPrice, cycle: Cycle): { base: number; extra: number } {
  return cycle === "ANNUAL"
    ? { base: plan.priceAnnual, extra: plan.extraEmployeeAnnual }
    : { base: plan.priceMonthly, extra: plan.extraEmployeeMonthly };
}

/** Whole months a year paid at once saves over twelve monthly payments ("Save 2 months"). */
export function monthsFree(plan: Pick<PlanPrice, "priceMonthly" | "priceAnnual">): number {
  if (plan.priceMonthly <= 0 || plan.priceAnnual >= plan.priceMonthly * 12) return 0;
  return Math.floor((plan.priceMonthly * 12 - plan.priceAnnual) / plan.priceMonthly);
}

export function quote(input: {
  plan: PlanPrice;
  cycle: Cycle;
  /** Active employees now. A company is never charged for fewer than one. */
  employees: number;
  sellerState: string;
  buyerState: string;
}): Quote {
  const months = monthsIn(input.cycle);
  const { base, extra } = cyclePrices(input.plan, input.cycle);
  const employees = Math.max(1, Math.floor(input.employees));
  const includedEmployees = Math.max(0, Math.floor(input.plan.includedEmployees));
  const extraEmployees = Math.max(0, employees - includedEmployees);
  const basePaise = base * 100;
  const extraPaise = extra * extraEmployees * 100;
  const subtotalPaise = basePaise + extraPaise;
  const intraState = sameState(input.sellerState, input.buyerState);
  const cgstPaise = intraState ? (subtotalPaise * 9) / 100 : 0;
  const sgstPaise = cgstPaise;
  const igstPaise = intraState ? 0 : (subtotalPaise * GST_RATE_PERCENT) / 100;
  return {
    cycle: input.cycle,
    months,
    employees,
    includedEmployees,
    extraEmployees,
    baseRupees: base,
    extraRateRupees: extra,
    basePaise,
    extraPaise,
    subtotalPaise,
    intraState,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalPaise: subtotalPaise + cgstPaise + sgstPaise + igstPaise,
  };
}

function sameState(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase() && a.trim() !== "";
}

/** "₹1,234" or "₹1,234.50" from paise. */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

// ------------------------------------------------------------- the period

/** Calendar months later, clamped to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/**
 * When a newly paid period starts. Paying early never loses time: an
 * unexpired trial or paid period runs out first, then the new one begins.
 */
export function periodStart(
  tenant: { plan: string; trialEndsAt: Date | null; paidUntil: Date | null },
  now: Date,
): Date {
  const carried = [now.getTime()];
  if (tenant.plan === "TRIAL" && tenant.trialEndsAt) carried.push(tenant.trialEndsAt.getTime());
  if (tenant.plan === "PAID" && tenant.paidUntil) carried.push(tenant.paidUntil.getTime());
  return new Date(Math.max(...carried));
}

// ------------------------------------------------------------ the invoice

/** "2627" for 1 April 2026 – 31 March 2027, in India time. */
export function financialYear(at: Date): string {
  const ist = new Date(at.getTime() + IST_OFFSET);
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? year : year - 1;
  return `${String(start % 100).padStart(2, "0")}${String((start + 1) % 100).padStart(2, "0")}`;
}

/**
 * "FH/2627/00001". CGST Rules r.46(b): consecutive, unique per financial
 * year, at most 16 characters, only letters, digits, "-" and "/".
 */
export function invoiceNumber(fy: string, sequence: number): string {
  return `FH/${fy}/${String(sequence).padStart(5, "0")}`;
}

/** GST state codes (the first two digits of a GSTIN), by state name. */
export const GST_STATE_CODES: Readonly<Record<string, string>> = {
  "Jammu and Kashmir": "01",
  "Himachal Pradesh": "02",
  Punjab: "03",
  Chandigarh: "04",
  Uttarakhand: "05",
  Haryana: "06",
  Delhi: "07",
  Rajasthan: "08",
  "Uttar Pradesh": "09",
  Bihar: "10",
  Sikkim: "11",
  "Arunachal Pradesh": "12",
  Nagaland: "13",
  Manipur: "14",
  Mizoram: "15",
  Tripura: "16",
  Meghalaya: "17",
  Assam: "18",
  "West Bengal": "19",
  Jharkhand: "20",
  Odisha: "21",
  Chhattisgarh: "22",
  "Madhya Pradesh": "23",
  Gujarat: "24",
  "Dadra and Nagar Haveli and Daman and Diu": "26",
  Maharashtra: "27",
  Karnataka: "29",
  Goa: "30",
  Lakshadweep: "31",
  Kerala: "32",
  "Tamil Nadu": "33",
  Puducherry: "34",
  "Andaman and Nicobar Islands": "35",
  Telangana: "36",
  "Andhra Pradesh": "37",
  Ladakh: "38",
};

export function stateForGstin(gstin: string): string | null {
  const code = gstin.slice(0, 2);
  return Object.keys(GST_STATE_CODES).find((s) => GST_STATE_CODES[s] === code) ?? null;
}

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * A well-formed GSTIN: state code, PAN, entity number, "Z", and the check
 * character (the GSTN mod-36 checksum). It says nothing about whether the
 * registration is active — only a GST portal lookup can.
 */
export function isGstin(value: string): boolean {
  const v = value.trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v)) return false;
  if (!stateForGstin(v)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = GSTIN_CHARS.indexOf(v[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] === v[14];
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below100(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", rest ? below100(rest) : ""].filter(Boolean).join(" ");
}

/** "Rupees One Lakh Twenty Thousand and Fifty Paise Only" — Indian grouping. */
export function rupeesInWords(paise: number): string {
  let rupees = Math.floor(paise / 100);
  const p = paise % 100;
  const parts: string[] = [];
  const crore = Math.floor(rupees / 1_00_00_000);
  rupees %= 1_00_00_000;
  const lakh = Math.floor(rupees / 1_00_000);
  rupees %= 1_00_000;
  const thousand = Math.floor(rupees / 1000);
  rupees %= 1000;
  if (crore) parts.push(`${below1000(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (rupees) parts.push(below1000(rupees));
  const words = parts.join(" ") || "Zero";
  return `Rupees ${words}${p ? ` and ${below100(p)} Paise` : ""} Only`;
}

// ---------------------------------------------------------------- access

export type AccessState =
  /** Flowacord's own and sample companies: never pause. */
  | { kind: "internal" }
  | { kind: "trial"; endsAt: Date | null; daysLeft: number | null }
  | { kind: "trial_ended"; endedAt: Date }
  /** `until` null: made paid by Flowacord with no end date. */
  | { kind: "paid"; until: Date | null; daysLeft: number | null }
  /** The paid period is over; access continues until `pausesAt`. */
  | { kind: "grace"; until: Date; pausesAt: Date; daysLeft: number }
  | { kind: "lapsed"; until: Date; pausedAt: Date };

/** Whole days until `at`; 0 on the day itself, negative once passed. */
export function daysUntil(at: Date, now: Date): number {
  return Math.ceil((at.getTime() - now.getTime()) / DAY);
}

export function accessState(
  tenant: { plan: string; trialEndsAt: Date | null; paidUntil: Date | null },
  now: Date,
): AccessState {
  if (tenant.plan === "TRIAL") {
    if (!tenant.trialEndsAt) return { kind: "trial", endsAt: null, daysLeft: null };
    return tenant.trialEndsAt <= now
      ? { kind: "trial_ended", endedAt: tenant.trialEndsAt }
      : { kind: "trial", endsAt: tenant.trialEndsAt, daysLeft: daysUntil(tenant.trialEndsAt, now) };
  }
  if (tenant.plan === "PAID") {
    const until = tenant.paidUntil;
    if (!until) return { kind: "paid", until: null, daysLeft: null };
    if (until > now) return { kind: "paid", until, daysLeft: daysUntil(until, now) };
    const pausesAt = new Date(until.getTime() + GRACE_DAYS * DAY);
    return pausesAt > now
      ? { kind: "grace", until, pausesAt, daysLeft: daysUntil(pausesAt, now) }
      : { kind: "lapsed", until, pausedAt: pausesAt };
  }
  return { kind: "internal" };
}

/** The company can do nothing but pay, sign out, and use data rights. */
export function isPaused(state: AccessState): boolean {
  return state.kind === "trial_ended" || state.kind === "lapsed";
}
