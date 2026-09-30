import { ALL_PERMISSION_KEYS, isPermissionBuilt, privilegeRank } from "@/lib/catalog";

/**
 * Who may change an access level, and which permissions they may move —
 * pure, so the Roles screen and the save action agree (MODULE_GAP_AUDIT.md,
 * security 2).
 *
 * Without these, anyone who could manage roles could widen the level they
 * hold themselves, or one above it, and hand out permissions they were
 * never given — e.g. a Super Admin adding salary approval to their own role.
 */

/** Why `actor` may not edit this role, or null if they may. */
export function roleEditRefusal(input: {
  actorRoleKey: string;
  actorRoleId: string;
  role: { id: string; key: string; name: string };
}): string | null {
  const { role } = input;
  if (role.key === "OWNER") {
    return "The Owner always keeps full access. Change another access level instead.";
  }
  if (role.id === input.actorRoleId) {
    return `You hold ${role.name} access yourself, so someone above you has to change it.`;
  }
  if (privilegeRank(role.key) >= privilegeRank(input.actorRoleKey)) {
    return `Only someone with more access than ${role.name} can change it.`;
  }
  return null;
}

/**
 * The permission set a save produces. You can only add or remove what you
 * hold yourself; anything you don't hold stays exactly as it was, so a
 * save can't hand out — or quietly strip — a permission above you.
 */
export function mergePermissions(input: {
  current: readonly string[];
  requested: readonly string[];
  mine: ReadonlySet<string>;
}): string[] {
  const kept = input.current.filter((p) => !input.mine.has(p));
  const chosen = input.requested.filter((p) => input.mine.has(p));
  return [...new Set([...kept, ...chosen])].sort();
}

/**
 * What a save asks for, before mergePermissions. Permissions no code checks
 * yet (catalog `built: false`) are not on the matrix, so the request can't
 * speak for them: a role keeps the ones it already holds and gains none.
 * Keys outside the catalog are dropped.
 */
export function matrixRequest(input: {
  current: readonly string[];
  requested: readonly string[];
}): string[] {
  return [
    ...input.requested.filter((p) => isPermissionBuilt(p)),
    ...input.current.filter(
      (p) => (ALL_PERMISSION_KEYS as string[]).includes(p) && !isPermissionBuilt(p),
    ),
  ];
}
