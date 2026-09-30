import "server-only";

import type { PermissionKey } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import type { AppSession } from "./types";

/**
 * Flowacord support inside a company (DECISIONS.md D-PL-03,
 * docs/md/SUPPORT-ACCESS.md).
 *
 * A platform admin opens a company from /platform (support-actions.ts). From
 * then on, while the cookie below names an open session of theirs, the app
 * runs as that company's hidden SUPPORT member: the Owner's permissions,
 * the company's data, no time limit. Whatever they change is recorded under
 * their "Flowacord support" identity — never under one of the company's
 * own people — and the company's activity log shows it as Flowacord
 * support. Only the support person sees the strip that says they are
 * inside someone else's company.
 */

/** Names an open support session; httpOnly, set by startSupportSessionAction. */
export const SUPPORT_COOKIE = "fh_support";

/** How the support identity appears to the company. */
export const SUPPORT_DISPLAY_NAME = "Flowacord support";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The company session for an open support session, or null if the cookie
 * doesn't name one that belongs to this platform admin and is still open
 * (then the admin simply gets their own session).
 */
export async function supportSessionFor(
  platformUser: { id: string; displayName: string },
  sessionId: string | undefined,
): Promise<AppSession | null> {
  if (!sessionId || !UUID.test(sessionId)) return null;
  const row = await getDb().supportSession.findFirst({
    where: { id: sessionId, platformUserId: platformUser.id, endedAt: null },
    include: {
      membership: {
        include: {
          user: true,
          tenant: true,
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    },
  });
  if (!row) return null;
  const { membership } = row;
  if (membership.status !== "SUPPORT" || membership.tenant.status !== "ACTIVE") return null;

  return {
    user: {
      id: membership.user.id,
      displayName: membership.user.displayName,
      email: null,
      isPlatformAdmin: false,
    },
    tenant: {
      id: membership.tenant.id,
      slug: membership.tenant.slug,
      name: membership.tenant.name,
      timezone: membership.tenant.timezone,
      plan: membership.tenant.plan,
      trialEndsAt: membership.tenant.trialEndsAt,
      selfSignup: membership.tenant.selfSignup,
      ownerEmailVerifiedAt: membership.tenant.ownerEmailVerifiedAt,
      paidUntil: membership.tenant.paidUntil,
    },
    membership: {
      id: membership.id,
      roleKey: membership.role.key,
      roleName: membership.role.name,
      employeeCode: null,
    },
    permissions: new Set<PermissionKey>(membership.role.permissions.map((rp) => rp.permission.key as PermissionKey)),
    source: "support",
    support: { sessionId: row.id, platformUserId: platformUser.id, platformUserName: platformUser.displayName },
  };
}
