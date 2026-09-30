"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { SUPPORT_COOKIE, SUPPORT_DISPLAY_NAME } from "@/lib/auth/support";
import { supportRefusal } from "./support-policy";
import { ownerTermsVersion } from "./support-terms";

/**
 * Opening a company as Flowacord support, and leaving it
 * (lib/auth/support.ts has what a support session is).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** "No time limit": the cookie outlives any support session. It ends on Exit or sign-out. */
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export async function startSupportSessionAction(input: { tenantId: string }): Promise<{ ok: false; error: string }> {
  const session = await requirePlatformAdmin();
  if (!UUID.test(input.tenantId)) return { ok: false, error: "That company no longer exists." };
  const db = getDb();
  const tenant = await db.tenant.findUnique({
    where: { id: input.tenantId },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!tenant) return { ok: false, error: "That company no longer exists." };
  const refusal = supportRefusal(tenant, await ownerTermsVersion(tenant.id));
  if (refusal) return { ok: false, error: refusal };
  const ownerRole = await db.role.findFirst({ where: { tenantId: tenant.id, key: "OWNER" }, select: { id: true } });
  if (!ownerRole) return { ok: false, error: "This company has no Owner access level to work as." };

  const supportSessionId = await db.$transaction(async (tx) => {
    // This admin's "Flowacord support" identity: what the company sees.
    const identity = await tx.user.upsert({
      where: { supportOfUserId: session.user.id },
      create: { displayName: SUPPORT_DISPLAY_NAME, status: "ACTIVE", supportOfUserId: session.user.id },
      update: {},
    });
    // Its hidden member in this company, with the Owner's access.
    const member = await tx.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: identity.id } },
      create: { tenantId: tenant.id, userId: identity.id, roleId: ownerRole.id, status: "SUPPORT" },
      update: { roleId: ownerRole.id, status: "SUPPORT" },
    });
    // One company at a time: opening another closes the last.
    await tx.supportSession.updateMany({
      where: { platformUserId: session.user.id, endedAt: null },
      data: { endedAt: new Date() },
    });
    const opened = await tx.supportSession.create({
      data: { platformUserId: session.user.id, tenantId: tenant.id, supportMembershipId: member.id },
    });
    await tx.auditEvent.create({
      data: {
        tenantId: null,
        actorUserId: session.user.id,
        actorType: "PLATFORM",
        action: "platform.support_session_started",
        entityType: "tenant",
        entityId: tenant.id,
        metadata: { supportSessionId: opened.id, company: tenant.name },
      },
    });
    return opened.id;
  });

  (await cookies()).set(SUPPORT_COOKIE, supportSessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  redirect("/admin");
}

/** Close the support session this browser has open, and go back to that company's page. */
export async function endSupportSessionAction(): Promise<void> {
  const session = await requirePlatformAdmin();
  const jar = await cookies();
  const id = jar.get(SUPPORT_COOKIE)?.value;
  let tenantId: string | null = null;
  if (id && UUID.test(id)) {
    const db = getDb();
    const row = await db.supportSession.findFirst({ where: { id, platformUserId: session.user.id } });
    if (row) {
      tenantId = row.tenantId;
      if (!row.endedAt) {
        await db.supportSession.update({ where: { id: row.id }, data: { endedAt: new Date() } });
        await db.auditEvent.create({
          data: {
            tenantId: null,
            actorUserId: session.user.id,
            actorType: "PLATFORM",
            action: "platform.support_session_ended",
            entityType: "tenant",
            entityId: row.tenantId,
            metadata: { supportSessionId: row.id },
          },
        });
      }
    }
  }
  jar.delete(SUPPORT_COOKIE);
  redirect(tenantId ? `/platform/companies/${tenantId}` : "/platform");
}
