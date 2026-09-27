import "server-only";

import { cache } from "react";
import { getDb } from "@/lib/db";
import type { PermissionKey } from "@/lib/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { devFixtureRole, fixtureSession } from "./fixture";
import type { AppSession } from "./types";

/**
 * Resolve the tenant-aware session for this request.
 * Order (SYSTEM-ARCHITECTURE.md security boundary): authenticate the user
 * first; resolve tenant membership second. Permission, module and feature
 * checks happen afterwards in authz/.
 *
 * Cached per request via React cache().
 */
/**
 * Does Supabase recognise this visitor, regardless of FlowHRMS access?
 *
 * The gap between this and `getAppSession()` is the whole point: someone
 * can hold a perfectly valid auth cookie and still have no usable account
 * here — deactivated, membership removed, tenant closed, or invited but
 * not yet linked. Callers that only check `getAppSession()` treat all of
 * those as "signed out", which is how a stale cookie turns into a silent
 * bounce back to the marketing page.
 */
export const hasSupabaseUser = cache(async (): Promise<boolean> => {
  if (devFixtureRole()) return true;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
});

export const getAppSession = cache(async (): Promise<AppSession | null> => {
  const fixtureRole = devFixtureRole();
  if (fixtureRole) return await fixtureSession(fixtureRole);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const db = getDb();
  let user = await db.user.findUnique({ where: { authUserId: authUser.id } });

  // Link a provisioned (invited) user record to its Supabase account on
  // first sign-in, matching by verified email. See SECURITY-NOTES.md.
  if (!user && authUser.email) {
    const byEmail = await db.user.findUnique({
      where: { email: authUser.email },
    });
    if (byEmail && !byEmail.authUserId) {
      user = await db.user.update({
        where: { id: byEmail.id },
        data: { authUserId: authUser.id },
      });
    }
  }
  if (!user || user.status !== "ACTIVE") return null;

  const membership = await db.tenantMembership.findFirst({
    where: { userId: user.id, status: "ACTIVE", tenant: { status: "ACTIVE" } },
    orderBy: { createdAt: "asc" },
    include: {
      tenant: true,
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });
  if (!membership) return null;

  const permissions = new Set<PermissionKey>(
    membership.role.permissions.map(
      (rp) => rp.permission.key as PermissionKey,
    ),
  );

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
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
    },
    membership: {
      id: membership.id,
      roleKey: membership.role.key,
      roleName: membership.role.name,
      employeeCode: membership.employeeCode,
    },
    permissions,
    source: "supabase",
  };
});
