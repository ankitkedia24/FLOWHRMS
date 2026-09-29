"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { privilegeRank } from "@/lib/catalog";

/**
 * Designations: the company's own job titles, each tied to an access level.
 *
 * Anyone who can add employees can add a designation — it is part of adding
 * a person — but never one with more access than they have themselves.
 * Changing the access of a designation people already hold changes what
 * all of them can see, so it needs `roles.manage` and the same guards as
 * changing one person's role: not yourself, not above you, not the last
 * owner.
 */

export type DesignationResult =
  | { ok: true; message: string; detail?: string; id?: string }
  | { ok: false; error: string };

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Name the designation, e.g. Delivery Executive.").max(60),
  roleId: z.string().uuid("Choose what this designation can access."),
});

export async function saveDesignationAction(input: z.input<typeof schema>): Promise<DesignationResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };
  const data = parsed.data;

  const { session, decision } = await checkAccess({ module: "EMPLOYEES", permission: "employees.manage" });
  if (!decision.allowed) return { ok: false, error: decision.message ?? "You don't have access to this." };

  const db = getDb();
  const tenantId = session.tenant.id;
  const role = await db.role.findFirst({ where: { id: data.roleId, tenantId } });
  if (!role) return { ok: false, error: "That access level is no longer available." };

  const myRank = privilegeRank(session.membership.roleKey);
  if (privilegeRank(role.key) > myRank) {
    return { ok: false, error: `You can't create a designation with more access than your own. ${role.name} is above you.` };
  }

  const clash = await db.designation.findFirst({
    where: {
      tenantId,
      name: { equals: data.name, mode: "insensitive" },
      ...(data.id ? { id: { not: data.id } } : {}),
    },
  });
  if (clash) {
    return {
      ok: false,
      error: clash.isActive
        ? `You already have a designation called ${clash.name}.`
        : `${clash.name} exists but is turned off. Turn it back on in Settings → Designations.`,
    };
  }

  if (!data.id) {
    const created = await db.designation.create({ data: { tenantId, name: data.name, roleId: role.id } });
    await recordAuditEvent(session, {
      action: "designation.created",
      entityType: "designation",
      entityId: created.id,
      after: { name: created.name, access: role.key },
    });
    revalidatePath("/admin/settings/designations");
    return { ok: true, message: `${created.name} added, with ${role.name} access.`, id: created.id };
  }

  const before = await db.designation.findFirst({
    where: { id: data.id, tenantId },
    include: { role: true },
  });
  if (!before) return { ok: false, error: "That designation is no longer available." };
  if (privilegeRank(before.role.key) > myRank) {
    return { ok: false, error: `Only someone with ${before.role.name} access or more can change ${before.name}.` };
  }

  const accessChanges = before.roleId !== role.id;
  const holders = await db.tenantMembership.findMany({
    where: { tenantId, designationId: before.id, status: { in: ["ACTIVE", "INVITED"] } },
    select: { id: true, userId: true },
  });

  if (accessChanges && holders.length > 0) {
    if (!session.permissions.has("roles.manage")) {
      return {
        ok: false,
        error: `${holders.length} ${holders.length === 1 ? "person has" : "people have"} this designation, so changing its access changes theirs. Only someone who manages access levels can do that.`,
      };
    }
    if (holders.some((h) => h.userId === session.user.id)) {
      return { ok: false, error: "You hold this designation, so you can't change its access. Ask another owner or admin." };
    }
    if (before.role.key === "OWNER" && role.key !== "OWNER") {
      const otherOwners = await db.tenantMembership.count({
        where: {
          tenantId,
          status: "ACTIVE",
          role: { key: "OWNER" },
          id: { notIn: holders.map((h) => h.id) },
        },
      });
      if (otherOwners === 0) {
        return { ok: false, error: "That would leave the company with no owner. Make someone else an owner first." };
      }
    }
  }

  await db.$transaction(async (tx) => {
    await tx.designation.update({ where: { id: before.id }, data: { name: data.name, roleId: role.id } });
    await tx.tenantMembership.updateMany({
      where: { tenantId, designationId: before.id },
      data: { designation: data.name, ...(accessChanges ? { roleId: role.id } : {}) },
    });
  });

  await recordAuditEvent(session, {
    action: accessChanges ? "designation.access_changed" : "designation.renamed",
    entityType: "designation",
    entityId: before.id,
    before: { name: before.name, access: before.role.key },
    after: { name: data.name, access: role.key },
    metadata: { holders: holders.length },
  });
  revalidatePath("/admin/settings/designations");
  revalidatePath("/admin/employees");
  return {
    ok: true,
    message: `${data.name} saved.`,
    detail:
      accessChanges && holders.length > 0
        ? `${holders.length} ${holders.length === 1 ? "person now has" : "people now have"} ${role.name} access. It takes effect the next time they load a page.`
        : undefined,
    id: before.id,
  };
}

/** Turn a designation off (or back on). Only when nobody holds it. */
export async function setDesignationActiveAction(input: { id: string; active: boolean }): Promise<DesignationResult> {
  const id = z.string().uuid().safeParse(input.id);
  if (!id.success) return { ok: false, error: "That designation is no longer available." };
  const { session, decision } = await checkAccess({ module: "EMPLOYEES", permission: "employees.manage" });
  if (!decision.allowed) return { ok: false, error: decision.message ?? "You don't have access to this." };

  const db = getDb();
  const designation = await db.designation.findFirst({ where: { id: id.data, tenantId: session.tenant.id } });
  if (!designation) return { ok: false, error: "That designation is no longer available." };
  if (!input.active) {
    const holders = await db.tenantMembership.count({
      where: { designationId: designation.id, status: { in: ["ACTIVE", "INVITED"] } },
    });
    if (holders > 0) {
      return {
        ok: false,
        error: `${holders} ${holders === 1 ? "person has" : "people have"} this designation. Give them another one first.`,
      };
    }
  }
  await db.designation.update({ where: { id: designation.id }, data: { isActive: input.active } });
  await recordAuditEvent(session, {
    action: input.active ? "designation.turned_on" : "designation.turned_off",
    entityType: "designation",
    entityId: designation.id,
    after: { name: designation.name, isActive: input.active },
  });
  revalidatePath("/admin/settings/designations");
  return { ok: true, message: `${designation.name} ${input.active ? "turned back on" : "turned off"}.` };
}
