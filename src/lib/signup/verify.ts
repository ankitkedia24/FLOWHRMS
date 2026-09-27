import "server-only";

import { getDb } from "@/lib/db";
import { hashInviteToken } from "@/lib/invites/token";

/**
 * Redeem an email-verification link. Idempotent for the same token (a
 * second click says "already confirmed"), and reveals nothing about
 * unknown tokens.
 */
export async function redeemEmailVerification(
  token: string,
): Promise<{ ok: true; companyName: string; already: boolean } | { ok: false }> {
  if (!token || token.length < 20) return { ok: false };
  const db = getDb();
  const row = await db.emailVerification.findUnique({
    where: { tokenHash: hashInviteToken(token) },
  });
  if (!row) return { ok: false };
  const tenant = await db.tenant.findUnique({ where: { id: row.tenantId } });
  if (!tenant) return { ok: false };
  if (row.usedAt) return { ok: true, companyName: tenant.name, already: true };
  if (row.expiresAt < new Date()) return { ok: false };

  const now = new Date();
  await db.$transaction([
    db.emailVerification.update({ where: { id: row.id }, data: { usedAt: now } }),
    db.tenant.update({
      where: { id: tenant.id },
      data: { ownerEmailVerifiedAt: tenant.ownerEmailVerifiedAt ?? now },
    }),
    db.auditEvent.create({
      data: {
        tenantId: tenant.id,
        actorType: "SYSTEM",
        action: "tenant.owner_email_verified",
        entityType: "tenant",
        entityId: tenant.id,
        metadata: { email: row.email },
      },
    }),
  ]);
  return { ok: true, companyName: tenant.name, already: false };
}
