import "server-only";

import { getDb } from "@/lib/db";
import { SUPPORT_TERMS_KEY } from "./support-policy";

/**
 * The newest version of the support-allowing Terms (support-policy.ts) the
 * company's owner has accepted and not withdrawn, or null.
 */
export async function ownerTermsVersion(tenantId: string): Promise<number | null> {
  const db = getDb();
  const owner = await db.tenantMembership.findFirst({
    where: { tenantId, status: "ACTIVE", role: { key: "OWNER" } },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  if (!owner) return null;
  const latest = await db.consentRecord.findFirst({
    where: { tenantId, userId: owner.userId, noticeKey: SUPPORT_TERMS_KEY },
    orderBy: { seq: "desc" },
    select: { action: true, noticeVersion: true },
  });
  return latest?.action === "GRANTED" ? latest.noticeVersion : null;
}
