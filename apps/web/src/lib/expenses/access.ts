import "server-only";

import type { AppSession } from "@/lib/auth/types";
import { getPolicy, getPolicyVersion } from "@/lib/policies";
import { workDateInTimezone } from "@/lib/attendance/policy";
import { normalizeExpensesPolicy, type ExpensesPolicy } from "./policy";
import { toIsoDate } from "./format";

/**
 * Shared server-side helpers for the Expenses module (EXPENSES-MODULE.md
 * §5, §8). Small on purpose: the rules live in the pure modules; this file
 * only fetches and threads them.
 */

export interface PublishedExpensesPolicy {
  policy: ExpensesPolicy;
  version: number;
}

/** The current published policy, or null when nothing has been published. */
export async function loadExpensesPolicy(
  tenantId: string,
): Promise<PublishedExpensesPolicy | null> {
  const raw = await getPolicy<unknown>(tenantId, "expenses");
  if (!raw) return null;
  const version = await getPolicyVersion(tenantId, "expenses");
  return { policy: normalizeExpensesPolicy(raw), version };
}

/** `expenses.approve` implies `expenses.view` in evaluation (§5). */
export function canViewOthersClaims(session: AppSession): boolean {
  return (
    session.permissions.has("expenses.view") ||
    session.permissions.has("expenses.approve")
  );
}

export function canApproveClaims(session: AppSession): boolean {
  return session.permissions.has("expenses.approve");
}

/** Today as yyyy-mm-dd in the tenant’s timezone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return toIsoDate(workDateInTimezone(now, timeZone));
}
