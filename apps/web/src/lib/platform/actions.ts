"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { provisionTenant } from "./provision";
import type { DemoRequestStatusKey } from "./demo-requests";

type Result =
  | { ok: true; message: string; detail?: string; inviteLink?: string }
  | { ok: false; error: string; field?: string };

/** Create a customer company from the platform area. */
export async function createTenantAction(input: {
  name: string;
  ownerName: string;
  ownerEmail: string;
  slug?: string;
  timezone?: string;
  fromDemoRequestId?: string;
}): Promise<Result> {
  const session = await requirePlatformAdmin();
  const db = getDb();

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://hrms.flowacord.com";

  const result = await provisionTenant(db, {
    name: input.name,
    ownerName: input.ownerName,
    ownerEmail: input.ownerEmail,
    slug: input.slug,
    timezone: input.timezone,
    origin,
    actor: { type: "USER", userId: session.user.id, via: "platform area" },
  });

  if (!result.ok) return { ok: false, error: result.error };

  // Close the loop when this came from an enquiry, so the inbox reflects
  // reality without anyone having to remember.
  if (input.fromDemoRequestId) {
    await db.demoRequest.updateMany({
      where: { id: input.fromDemoRequestId, status: { not: "CONVERTED" } },
      data: {
        status: "CONVERTED",
        handledById: session.user.id,
        handledAt: new Date(),
      },
    });
  }

  revalidatePath("/platform");
  revalidatePath("/platform/enquiries");

  return {
    ok: true,
    message: `${input.name.trim()} is set up.`,
    detail: result.alsoOwns.length
      ? `Note: this email already belongs to ${result.alsoOwns.join(", ")}. They now have both.`
      : "Send the owner the link below. It works once, for 7 days.",
    inviteLink: result.inviteLink,
  };
}

/**
 * Suspend or restore a company.
 *
 * Suspending stops everyone in it signing in, because getAppSession()
 * resolves no membership when the tenant is not ACTIVE. Nothing is deleted
 * — attendance, payroll and documents stay exactly as recorded — and
 * restoring puts it all back. That is the difference between "they stopped
 * paying" and "they left", and the two must not be the same button.
 */
export async function setTenantStatusAction(input: {
  tenantId: string;
  status: "ACTIVE" | "SUSPENDED";
  reason: string;
}): Promise<Result> {
  const session = await requirePlatformAdmin();
  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, error: "Say why. It goes on the record." };
  }

  const db = getDb();
  const tenant = await db.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) return { ok: false, error: "That company no longer exists." };
  if (tenant.status === input.status) {
    return { ok: true, message: `${tenant.name} is already ${input.status.toLowerCase()}.` };
  }

  await db.tenant.update({
    where: { id: tenant.id },
    data: { status: input.status },
  });

  await db.auditEvent.create({
    data: {
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorType: "USER",
      action: input.status === "SUSPENDED" ? "tenant.suspended" : "tenant.restored",
      entityType: "tenant",
      entityId: tenant.id,
      reason,
      before: { status: tenant.status },
      after: { status: input.status },
    },
  });

  revalidatePath("/platform");

  return {
    ok: true,
    message:
      input.status === "SUSPENDED"
        ? `${tenant.name} is suspended. Nobody there can sign in.`
        : `${tenant.name} is active again.`,
    detail:
      input.status === "SUSPENDED"
        ? "Their data is untouched and comes back when you restore them."
        : undefined,
  };
}

/** Move an enquiry along, with a note about what happened. */
export async function updateDemoRequestAction(input: {
  id: string;
  status: DemoRequestStatusKey;
  note?: string;
}): Promise<Result> {
  const session = await requirePlatformAdmin();
  const db = getDb();

  const existing = await db.demoRequest.findUnique({ where: { id: input.id } });
  if (!existing) return { ok: false, error: "That enquiry no longer exists." };

  await db.demoRequest.update({
    where: { id: input.id },
    data: {
      status: input.status,
      handledById: session.user.id,
      handledAt: new Date(),
      handledNote: input.note?.trim() || existing.handledNote,
    },
  });

  await db.auditEvent.create({
    data: {
      // Platform-level: this enquiry belongs to no company.
      tenantId: null,
      actorUserId: session.user.id,
      actorType: "USER",
      action: "demo_request.updated",
      entityType: "demo_request",
      entityId: input.id,
      before: { status: existing.status },
      after: { status: input.status },
    },
  });

  revalidatePath("/platform/enquiries");
  return { ok: true, message: "Updated." };
}
