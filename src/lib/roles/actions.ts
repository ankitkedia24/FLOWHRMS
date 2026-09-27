"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { ALL_PERMISSION_KEYS } from "@/lib/catalog";

/**
 * Role permission changes (user-flows.md §9).
 *
 * - A change is audited with the BEFORE and AFTER permission sets.
 * - Affected users re-evaluate on their next request: entitlements and
 *   permissions are loaded per request, so nothing is cached stale.
 * - A role can never grant more than the platform catalog defines.
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

  // The Owner role must keep full control of its own company.
  if (role.key === "OWNER") {
    return {
      ok: false,
      error:
        "The Owner always keeps full access. Change another access level instead.",
    };
  }

  // Only permissions that exist in the platform catalog may be granted.
  const requested = parsed.data.permissions.filter((key) =>
    (ALL_PERMISSION_KEYS as string[]).includes(key),
  );

  const permissions = await db.permission.findMany({
    where: { key: { in: requested } },
  });

  const before = role.permissions.map((rp) => rp.permission.key).sort();
  const after = permissions.map((p) => p.key).sort();

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
