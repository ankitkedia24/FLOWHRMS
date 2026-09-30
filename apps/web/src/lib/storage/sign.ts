import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Mint a short-lived link to a private file (employee documents, expense
 * receipts, task proof).
 *
 * WHY the service-role key: those buckets deliberately have no read policy
 * for signed-in users (scripts/setup-storage.ts — "reads are signed-URL
 * only, minted server-side"), so a link signed with the user's own session
 * is refused and the file never opens. The service role can read every
 * company's files, which is exactly why this function checks nothing
 * itself: callers MUST have checked the viewer's permission and the stored
 * path (src/lib/storage/paths.ts) first. company-media does the same in
 * src/lib/media/urls.ts.
 */
export type SignResult =
  | { ok: true; url: string }
  | { ok: false; reason: "unconfigured" | "failed" };

export async function signPrivateFile(
  bucket: string,
  path: string,
  ttlSeconds: number,
): Promise<SignResult> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, reason: "unconfigured" };
  try {
    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUrl(path, ttlSeconds);
    if (error || !data?.signedUrl) return { ok: false, reason: "failed" };
    return { ok: true, url: data.signedUrl };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
