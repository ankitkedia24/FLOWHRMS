/**
 * Branch filter validation — pure, no I/O.
 *
 * The selected location travels in the URL so a filtered review queue is
 * shareable and deep-linkable. A URL is client input: it is validated
 * against the tenant's own locations here, and an id from anywhere else
 * is treated as absent. It must never reach a query unchecked
 * (Constitution §2).
 */

export interface BranchOption {
  id: string;
  name: string;
}

/**
 * Resolve `?branch=` into a location id to filter by, or null for "all".
 * Returns null for absent, "all", malformed, and — importantly — any id
 * that does not belong to this tenant.
 */
export function resolveBranchFilter(
  raw: string | undefined,
  allowed: ReadonlySet<string>,
): string | null {
  if (!raw || raw === "all") return null;
  return allowed.has(raw) ? raw : null;
}

/** The selected location's name, for filter-aware empty states. */
export function branchName(
  branchId: string | null,
  options: readonly BranchOption[],
): string | null {
  if (!branchId) return null;
  return options.find((option) => option.id === branchId)?.name ?? null;
}
