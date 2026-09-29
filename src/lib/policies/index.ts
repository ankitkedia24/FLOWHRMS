import "server-only";

import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";

/**
 * Versioned tenant policy storage (Constitution §1: configuration before
 * custom code; edge-cases.md: a policy change never rewrites past days).
 *
 * Writing a policy creates a NEW version and retires the previous one, so
 * a record can always name the version that applied on its date.
 */

// "pay_setup" is deliberately its own key rather than part of "payroll":
// the payroll key's version is stamped on approved runs, and choosing a
// salary starter pack must not look like the late policy changed.
export type PolicyKey =
  | "attendance"
  | "leave"
  | "payroll"
  | "notifications"
  | "pay_setup"
  // The published scoring definition (PERFORMANCE-MODULE.md §1.2): its
  // version is stamped on every point row, and publishing it is the gate
  // the leaderboard flag checks.
  | "performance"
  // Expense claim rules (EXPENSES-MODULE.md §8): categories, deadline,
  // settlement default, retention. Every claim stamps the version that
  // applied at submission.
  | "expenses"
  // Weekly offs and holidays (src/lib/attendance/calendar.ts). Its own key
  // so adding a holiday does not look like the late policy changed.
  | "work_calendar"
  // Field visit rules (FIELD-VISITS-MODULE.md §6): the company's word for
  // what people visit, purposes, photo, approvals, vehicles. Every trip
  // stamps the version that applied when it started.
  | "field_visits";

export async function getPolicy<T>(
  tenantId: string,
  key: PolicyKey,
): Promise<T | null> {
  if (devFixtureOffline()) return null;
  const row = await getDb().tenantPolicy.findFirst({
    where: { tenantId, key, isCurrent: true },
    orderBy: { version: "desc" },
  });
  return (row?.value as T) ?? null;
}

export async function getPolicyVersion(
  tenantId: string,
  key: PolicyKey,
): Promise<number> {
  if (devFixtureOffline()) return 1;
  const row = await getDb().tenantPolicy.findFirst({
    where: { tenantId, key, isCurrent: true },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return row?.version ?? 1;
}

/** Store a new version; the previous one is retired, never edited. */
export async function setPolicy(
  tenantId: string,
  key: PolicyKey,
  value: unknown,
  updatedById?: string,
): Promise<{ version: number; previous: unknown }> {
  const db = getDb();
  const current = await db.tenantPolicy.findFirst({
    where: { tenantId, key, isCurrent: true },
    orderBy: { version: "desc" },
  });

  const nextVersion = (current?.version ?? 0) + 1;

  await db.$transaction([
    db.tenantPolicy.updateMany({
      where: { tenantId, key, isCurrent: true },
      data: { isCurrent: false },
    }),
    db.tenantPolicy.create({
      data: {
        tenantId,
        key,
        version: nextVersion,
        value: value as never,
        isCurrent: true,
        updatedById,
      },
    }),
  ]);

  return { version: nextVersion, previous: current?.value ?? null };
}
