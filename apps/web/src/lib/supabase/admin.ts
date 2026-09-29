import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase admin client — creates and updates auth accounts.
 *
 * **This key bypasses Row Level Security and can read every row in the
 * project.** Three rules, enforced by construction rather than by memory:
 *
 * 1. `server-only` at the top of this file. If a client component ever
 *    imports it, even transitively, the build fails rather than shipping
 *    the key to a browser.
 * 2. The variable is NOT prefixed `NEXT_PUBLIC_`, so Next.js will not
 *    inline it into client bundles.
 * 3. Nothing here takes a tenant id from the caller and trusts it. Tenant
 *    scoping happens in the calling action, against the session — this
 *    module only ever touches `auth.users`, never tenant tables.
 *
 * Absent configuration is a stated condition, not a crash: invitations are
 * refused with an explanation an admin can act on (SECURITY-NOTES.md).
 */

let cached: SupabaseClient | null = null;

function secretKey(): string | undefined {
  // Supabase's newer `sb_secret_…` key, falling back to the legacy
  // service_role JWT for projects that have not rotated yet.
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    undefined
  );
}

export function supabaseAdminConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && secretKey());
}

/** Null when unconfigured — callers must say so rather than throwing. */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = secretKey();
  if (!url || !key) return null;

  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

export const ADMIN_KEY_MISSING =
  "Sign-in accounts aren't connected yet. Ask whoever set up FlowHRMS to add the Supabase secret key (DEPLOY.md, step 3).";
