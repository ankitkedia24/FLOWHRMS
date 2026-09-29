/**
 * Display helpers for expense amounts and dates. Pure; shared by employee
 * and admin screens so the two never format the same rupee differently.
 *
 * Money renders at its final value — nothing here animates (D-017).
 */

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,42,800.50 — Indian digit grouping, paise always shown. */
export function formatAmount(value: number | string | { toString(): string }): string {
  const n = typeof value === "number" ? value : Number(value.toString());
  return INR.format(Number.isFinite(n) ? n : 0);
}

/** A @db.Date column comes back as UTC midnight; show it as that date. */
export function formatExpenseDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00.000Z`) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** For timestamps: "12 Sept, 4:05 pm" in the tenant's zone. */
export function formatWhen(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(date);
}

/** yyyy-mm-dd for a @db.Date value. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
