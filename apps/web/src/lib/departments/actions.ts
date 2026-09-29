"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { DECIDING_PERMISSION } from "@/lib/actions/audience";

/**
 * Departments — organisational units, distinct from Branch, which is a
 * place. Dispatch and Accounts can share one warehouse; one Dispatch
 * department can span three.
 *
 * The head matters operationally, not decoratively: they receive action
 * tiles for their people alongside the admins. So naming a head whose role
 * cannot approve anything is a silent dead end, and this action refuses to
 * let that happen quietly — it saves, and it tells the admin.
 */

export type ActionResult =
  /** `id`: the saved record, so a form can select what it just created. */
  | { ok: true; message: string; detail?: string; id?: string }
  | { ok: false; error: string };

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Give the department a name.").max(80),
  headId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
});

export async function saveDepartmentAction(
  input: z.input<typeof schema>,
): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const data = parsed.data;

  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "settings.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const tenantId = session.tenant.id;

  const clash = await db.department.findFirst({
    where: {
      tenantId,
      name: data.name,
      ...(data.id ? { id: { not: data.id } } : {}),
    },
  });
  if (clash) {
    return { ok: false, error: `You already have a department called ${data.name}.` };
  }

  let headWarning: string | undefined;
  if (data.headId) {
    const head = await db.tenantMembership.findFirst({
      where: { id: data.headId, tenantId, status: "ACTIVE" },
      include: {
        user: true,
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });
    if (!head) return { ok: false, error: "That person is no longer available." };

    const decidingKeys = new Set(Object.values(DECIDING_PERMISSION));
    const canDecideSomething = head.role.permissions.some((p) =>
      decidingKeys.has(p.permission.key as never),
    );
    if (!canDecideSomething) {
      headWarning = `${head.user.displayName} is the head, but the ${head.role.name} role can't approve anything — so approvals for this team will still go to admins only. Change their role to involve them.`;
    }
  }

  const before = data.id
    ? await db.department.findFirst({
        where: { id: data.id, tenantId },
        include: { head: { include: { user: true } } },
      })
    : null;
  if (data.id && !before) {
    return { ok: false, error: "That department is no longer available." };
  }

  const saved = data.id
    ? await db.department.update({
        where: { id: data.id },
        data: { name: data.name, headId: data.headId ?? null, isActive: data.isActive },
      })
    : await db.department.create({
        data: {
          tenantId,
          name: data.name,
          headId: data.headId ?? null,
          isActive: data.isActive,
        },
      });

  await recordAuditEvent(session, {
    action: data.id ? "department.updated" : "department.created",
    entityType: "department",
    entityId: saved.id,
    before: before
      ? {
          name: before.name,
          head: before.head?.user.displayName ?? null,
          isActive: before.isActive,
        }
      : undefined,
    after: { name: saved.name, headId: saved.headId, isActive: saved.isActive },
  });

  revalidatePath("/admin/settings/departments");
  revalidatePath("/admin/employees");

  return {
    ok: true,
    message: data.id ? `${saved.name} saved.` : `${saved.name} added.`,
    detail: headWarning,
    id: saved.id,
  };
}

const removeSchema = z.object({ id: z.string().uuid() });

/**
 * Deactivate, not delete. People point at departments, and past records
 * should keep saying which department someone was in.
 */
export async function deactivateDepartmentAction(
  input: z.input<typeof removeSchema>,
): Promise<ActionResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That didn't work." };

  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "settings.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const department = await db.department.findFirst({
    where: { id: parsed.data.id, tenantId: session.tenant.id },
    include: { _count: { select: { members: true } } },
  });
  if (!department) return { ok: false, error: "That department is no longer available." };

  await db.department.update({
    where: { id: department.id },
    data: { isActive: false },
  });

  await recordAuditEvent(session, {
    action: "department.deactivated",
    entityType: "department",
    entityId: department.id,
    metadata: { membersAffected: department._count.members },
  });

  revalidatePath("/admin/settings/departments");

  return {
    ok: true,
    message: `${department.name} is switched off.`,
    detail:
      department._count.members > 0
        ? `${department._count.members} ${department._count.members === 1 ? "person stays" : "people stay"} on the record as having been in it. Their approvals now go to admins only.`
        : "Nobody was in it.",
  };
}
