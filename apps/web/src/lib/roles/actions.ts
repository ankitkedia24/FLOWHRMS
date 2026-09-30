"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { ALL_PERMISSION_KEYS } from "@/lib/catalog";
import { matrixRequest, mergePermissions, roleEditRefusal } from "./policy";

/**
 * Role permission changes (user-flows.md §9).
 *
 * - A change is audited with the BEFORE and AFTER permission sets.
 * - Affected users re-evaluate on their next request: entitlements and
 *   permissions are loaded per request, so nothing is cached stale.
 * - A role can never grant more than the platform catalog defines.
 * - You change only levels below your own, and only move permissions you
 *   hold yourself (src/lib/roles/policy.ts).
 */

export type ActionResult =
  | { ok: true; message: string; detail?: string }
  | { ok: false; error: string };

const schema = z.object({
  roleId: z.string().uuid(),
  permissions: z.array(z.string()).max(ALL_PERMISSION_KEYS.length),
});

export async function saveRolePermissionsAction(
  input: z.input<typeof schema>,
): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That change could not be read. Try again." };
  }

  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "roles.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const role = await db.role.findFirst({
    where: { id: parsed.data.roleId, tenantId: session.tenant.id },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) return { ok: false, error: "That role is no longer available." };

  // The Owner role keeps full control; nobody widens their own level or
  // one at or above it.
  const actorRole = await db.role.findFirst({
    where: { tenantId: session.tenant.id, key: session.membership.roleKey },
    select: { id: true },
  });
  const refusal = roleEditRefusal({
    actorRoleKey: session.membership.roleKey,
    actorRoleId: actorRole?.id ?? "",
    role: { id: role.id, key: role.key, name: role.name },
  });
  if (refusal) return { ok: false, error: refusal };

  const before = role.permissions.map((rp) => rp.permission.key).sort();
  // Only permissions that exist in the platform catalog and are on the
  // matrix, and only ones you hold yourself, can be added or removed; the
  // rest stay as they were.
  const requested = matrixRequest({
    current: before,
    requested: parsed.data.permissions,
  });
  const merged = mergePermissions({
    current: before,
    requested,
    mine: session.permissions as ReadonlySet<string>,
  });

  const permissions = await db.permission.findMany({
    where: { key: { in: merged } },
  });
  const after = permissions.map((p) => p.key).sort();
  if (after.join() === before.join()) {
    return { ok: false, error: "Nothing you can change has changed." };
  }

  const affected = await db.tenantMembership.count({
    where: { tenantId: session.tenant.id, roleId: role.id, status: "ACTIVE" },
  });

  await db.$transaction([
    db.rolePermission.deleteMany({ where: { roleId: role.id } }),
    db.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
    }),
  ]);

  const added = after.filter((k) => !before.includes(k));
  const removed = before.filter((k) => !after.includes(k));

  await recordAuditEvent(session, {
    action: "role.permissions_changed",
    entityType: "role",
    entityId: role.id,
    before: { permissions: before },
    after: { permissions: after, added, removed, affectedUsers: affected },
  });

  revalidatePath("/admin/roles");

  return {
    ok: true,
    message: `${role.name} updated.`,
    detail:
      affected > 0
        ? `${affected} ${affected === 1 ? "person" : "people"} will see this on their next request.`
        : undefined,
  };
}
