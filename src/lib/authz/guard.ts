import "server-only";

import { redirect } from "next/navigation";
import type { ModuleKey, PermissionKey } from "@/lib/catalog";
import { getAppSession } from "@/lib/auth/session";
import type { AppSession } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { outstandingNotices } from "@/lib/consent/record";
import { trialExpired } from "@/lib/signup/validate";
import { loadEntitlements } from "./entitlements";
import { evaluateAccess, type AccessDecision } from "./flags";

/**
 * Server-side route and action guards. These are the enforcement layer —
 * navigation only *reflects* these decisions, it never replaces them
 * (Product Constitution §5).
 */

/**
 * Require a signed-in, tenant-resolved session.
 * - Anonymous → /sign-in.
 * - Authenticated but not provisioned (no user row / no active membership)
 *   → /unauthorized. Never back to /sign-in: the proxy bounces signed-in
 *   users off that route, which would loop.
 */
export async function requireSession(): Promise<AppSession> {
  const session = await getAppSession();
  if (!session) {
    const supabase = await createSupabaseServerClient();
    const authUser = supabase
      ? (await supabase.auth.getUser()).data.user
      : null;
    redirect(authUser ? "/unauthorized" : "/sign-in");
  }
  // DPDP Act s.6: no processing without consent to the notice that applies
  // to this person, at its current version. Everything in the app passes
  // through here, so this is the one place it is enforced. /consent itself
  // does not call requireSession.
  if ((await outstandingNotices(session)).length > 0) redirect("/consent");
  // A trial that has run out pauses the company: data is kept, nothing can
  // be done until Flowacord extends it or it moves to a paid plan.
  // /trial-ended itself does not call requireSession.
  if (trialExpired(session.tenant, new Date())) redirect("/trial-ended");
  return session;
}

/**
 * Require the Platform Super Admin, who operates the SaaS across companies.
 *
 * This is the ONLY guard in the codebase that admits someone to data
 * belonging to more than one tenant, so it is deliberately narrow: a single
 * boolean on the user record, set in the database, with no permission or
 * role that can grant it. A tenant Owner cannot reach it however many
 * permissions they collect.
 *
 * It does NOT confer the right to act inside a company. There is no
 * impersonation here — that needs a time bound, a reason, and the visible
 * "Support session" band (SECURITY-NOTES.md), and none of those exist yet.
 * What this allows is the operator's own work: listing companies, creating
 * one, suspending one, reading enquiries.
 */
export async function requirePlatformAdmin(): Promise<AppSession> {
  const session = await requireSession();
  if (!session.user.isPlatformAdmin) redirect("/unauthorized");
  return session;
}

/** Require the admin area entry permission or show the unauthorized state. */
export async function requireAdminArea(): Promise<AppSession> {
  const session = await requireSession();
  if (!session.permissions.has("admin.access")) redirect("/unauthorized");
  return session;
}

/**
 * Evaluate module/feature/permission access for the current request.
 * Returns the decision — callers choose redirect, 403 response, or
 * in-place explanation (module-disabled empty state).
 */
export async function checkAccess(input: {
  module: ModuleKey;
  feature?: string;
  permission?: PermissionKey;
}): Promise<{ session: AppSession; decision: AccessDecision }> {
  const session = await requireSession();
  const entitlements = await loadEntitlements(
    session.tenant.id,
    session.user.id,
  );
  const decision = evaluateAccess({ session, entitlements, ...input });
  return { session, decision };
}

/** Guard a page: redirect to the unauthorized state when denied. */
export async function requireAccess(input: {
  module: ModuleKey;
  feature?: string;
  permission?: PermissionKey;
}): Promise<AppSession> {
  const { session, decision } = await checkAccess(input);
  if (!decision.allowed) redirect("/unauthorized");
  return session;
}

export function hasPermission(
  session: AppSession,
  permission: PermissionKey,
): boolean {
  return session.permissions.has(permission);
}
