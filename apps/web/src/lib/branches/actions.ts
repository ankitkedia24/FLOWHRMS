"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";

/**
 * Company locations (branches) — MODULES.md puts these under Tenant
 * Settings, screen A24 lists them, and the copy deck has "Add branch".
 *
 * A location's radius is optional: null means it inherits the tenant's
 * attendance policy, so a warehouse can be given more room than a shop
 * without detaching it from the company default.
 */

export type ActionResult =
  /** `id`: the saved record, so a form can select what it just created. */
  | { ok: true; message: string; detail?: string; id?: string }
  | { ok: false; error: string };

const schema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name the location.").max(120),
  address: z.string().trim().max(300).optional(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  /** Null = inherit the tenant's permitted-area radius. */
  radiusM: z.number().int().min(50).max(5000).nullable(),
  isActive: z.boolean(),
  /** Required when deactivating a location people are assigned to. */
  reason: z.string().trim().max(500).optional(),
});

export async function saveBranchAction(
  input: z.input<typeof schema>,
): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the location details.",
    };
  }

  const { session, decision } = await checkAccess({
    module: "ATTENDANCE",
    permission: "settings.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  // Coordinates come as a pair: one without the other cannot be checked.
  if ((parsed.data.lat == null) !== (parsed.data.lng == null)) {
    return {
      ok: false,
      error: "Give both latitude and longitude, or leave both blank.",
    };
  }

  const db = getDb();
  const existing = parsed.data.branchId
    ? await db.branch.findFirst({
        where: { id: parsed.data.branchId, tenantId: session.tenant.id },
      })
    : null;

  if (parsed.data.branchId && !existing) {
    return { ok: false, error: "That location is no longer available." };
  }

  // Deactivating a location people work at needs a stated reason — their
  // check-ins stop matching it (Constitution §3).
  const assigned = existing
    ? await db.tenantMembership.count({
        where: {
          tenantId: session.tenant.id,
          branchId: existing.id,
          status: "ACTIVE",
        },
      })
    : 0;

  if (existing?.isActive && !parsed.data.isActive) {
    if (assigned > 0 && !parsed.data.reason?.trim()) {
      return {
        ok: false,
        error: `${assigned} ${assigned === 1 ? "person works" : "people work"} at this location. Give a reason to turn it off.`,
      };
    }
  }

  const data = {
    name: parsed.data.name,
    address: parsed.data.address || null,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    radiusM: parsed.data.radiusM,
    isActive: parsed.data.isActive,
  };

  const branch = existing
    ? await db.branch.update({ where: { id: existing.id }, data })
    : await db.branch.create({
        data: { ...data, tenantId: session.tenant.id },
      });

  await recordAuditEvent(session, {
    action: existing ? "settings.branch_updated" : "settings.branch_created",
    entityType: "branch",
    entityId: branch.id,
    reason: parsed.data.reason?.trim(),
    before: existing
      ? {
          name: existing.name,
          lat: existing.lat,
          lng: existing.lng,
          radiusM: existing.radiusM,
          isActive: existing.isActive,
        }
      : undefined,
    after: data,
    metadata: { assignedEmployees: assigned },
  });

  revalidatePath("/admin/settings/attendance");
  revalidatePath("/admin/attendance");

  const radiusNote =
    parsed.data.radiusM == null
      ? " It uses the company's permitted-area radius."
      : ` Its permitted area is ${parsed.data.radiusM} m.`;

  return {
    ok: true,
    message: `${branch.name} saved.`,
    id: branch.id,
    detail: parsed.data.isActive ? radiusNote.trim() : "It is turned off.",
  };
}
