import "server-only";

import { getDb } from "@/lib/db";
import { hashInviteToken } from "@/lib/invites/token";
import { NOTHING_HELD, sendHeldInvitations, type HeldResult } from "@/lib/invites/held";

/**
 * Redeem an email-verification link. Idempotent for the same token (a
 * second click says "already confirmed"), and reveals nothing about
 * unknown tokens.
 *
 * The redemption that actually confirms the owner's email also sends the
 * invitations that were held until then (held.ts). The token and the
 * company are each claimed with a conditional update, so two clicks at
 * the same moment confirm once and send once.
 */
export async function redeemEmailVerification(
  token: string,
): Promise<
  | { ok: true; companyName: string; already: boolean; invitations: HeldResult }
  | { ok: false }
> {
  if (!token || token.length < 20) return { ok: false };
  const db = getDb();
  const row = await db.emailVerification.findUnique({
    where: { tokenHash: hashInviteToken(token) },
  });
  if (!row) return { ok: false };
  const tenant = await db.tenant.findUnique({ where: { id: row.tenantId } });
  if (!tenant) return { ok: false };
  const already = { ok: true as const, companyName: tenant.name, already: true, invitations: NOTHING_HELD };
  if (row.usedAt) return already;
  if (row.expiresAt < new Date()) return { ok: false };

  const now = new Date();
  const confirmedNow = await db.$transaction(async (tx) => {
    const claimed = await tx.emailVerification.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: now },
    });
    if (claimed.count === 0) return null; // the same link, clicked twice at once
    const flipped = await tx.tenant.updateMany({
      where: { id: tenant.id, ownerEmailVerifiedAt: null },
      data: { ownerEmailVerifiedAt: now },
    });
    await tx.auditEvent.create({
      data: {
        tenantId: tenant.id,
        actorType: "SYSTEM",
        action: "tenant.owner_email_verified",
        entityType: "tenant",
        entityId: tenant.id,
        metadata: { email: row.email },
      },
    });
    return flipped.count === 1;
  });
  if (confirmedNow === null) return already;

  const invitations = confirmedNow ? await sendHeldInvitations(tenant.id) : NOTHING_HELD;
  return { ok: true, companyName: tenant.name, already: false, invitations };
}
