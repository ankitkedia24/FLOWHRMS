"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { provisionTenant } from "./provision";
import { LockoutRefused, redeemLockoutCode } from "./lockout-code";
import { PLATFORM_APPROVAL_EMAIL, lockoutPrecondition } from "./lockout-policy";
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
 *
 * Suspending needs the code emailed to info@flowacord.com
 * (requestLockoutCodeAction, then this with the code), whoever is asking —
 * owner decision, 30 Sept 2026. The reason is the one given when the code
 * was sent. Restoring lets people back in, so it needs only a reason.
 */
export async function setTenantStatusAction(input: {
  tenantId: string;
  status: "ACTIVE" | "SUSPENDED";
  /** Restoring. */
  reason?: string;
  /** Suspending: the code emailed to info@flowacord.com, and its id. */
  codeId?: string;
  code?: string;
}): Promise<Result> {
  const session = await requirePlatformAdmin();
  const db = getDb();

  if (input.status === "SUSPENDED") {
    if (!input.codeId || !input.code?.trim()) {
      return { ok: false, error: `Suspending needs the code emailed to ${PLATFORM_APPROVAL_EMAIL}.` };
    }
    const redeemed = await redeemLockoutCode(
      { codeId: input.codeId, code: input.code, actorId: session.user.id, tenantId: input.tenantId, action: "SUSPEND" },
      async (tx, reason) => {
        const tenant = await tx.tenant.findUnique({ where: { id: input.tenantId } });
        if (!tenant) throw new LockoutRefused("That company no longer exists.");
        const refusal = lockoutPrecondition("SUSPEND", tenant, new Date());
        if (refusal) throw new LockoutRefused(refusal);
        await tx.tenant.update({ where: { id: tenant.id }, data: { status: "SUSPENDED" } });
        await tx.auditEvent.create({
          data: {
            tenantId: tenant.id,
            actorUserId: session.user.id,
            actorType: "USER",
            action: "tenant.suspended",
            entityType: "tenant",
            entityId: tenant.id,
            reason,
            before: { status: tenant.status },
            after: { status: "SUSPENDED" },
            metadata: { confirmedWith: `code emailed to ${PLATFORM_APPROVAL_EMAIL}`, codeId: input.codeId },
          },
        });
        return tenant.name;
      },
    );
    if (!redeemed.ok) return { ok: false, error: redeemed.error };
    revalidatePath("/platform");
    revalidatePath(`/platform/companies/${input.tenantId}`);
    return {
      ok: true,
      message: `${redeemed.value} is suspended. Nobody there can sign in.`,
      detail: "Their data is untouched and comes back when you restore them.",
    };
  }

  const reason = input.reason?.trim();
  if (!reason) {
    return { ok: false, error: "Say why. It goes on the record." };
  }
  const tenant = await db.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) return { ok: false, error: "That company no longer exists." };
  if (tenant.status === "ACTIVE") {
    return { ok: true, message: `${tenant.name} is already active.` };
  }

  await db.tenant.update({
    where: { id: tenant.id },
    data: { status: "ACTIVE" },
  });

  await db.auditEvent.create({
    data: {
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorType: "USER",
      action: "tenant.restored",
      entityType: "tenant",
      entityId: tenant.id,
      reason,
      before: { status: tenant.status },
      after: { status: "ACTIVE" },
    },
  });

  revalidatePath("/platform");
  revalidatePath(`/platform/companies/${tenant.id}`);

  return { ok: true, message: `${tenant.name} is active again.` };
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
