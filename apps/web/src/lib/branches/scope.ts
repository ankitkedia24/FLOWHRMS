import "server-only";

import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import type { BranchOption } from "./filter";

/**
 * Loading the tenant's locations for the "All branches ▾" filter.
 * The validation that goes with it is pure and lives in ./filter.
 */
export type { BranchOption } from "./filter";
export { branchName, resolveBranchFilter } from "./filter";

export async function loadBranchOptions(
  tenantId: string,
): Promise<BranchOption[]> {
  if (devFixtureOffline()) return [];
  return getDb().branch.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
