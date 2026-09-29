import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { MEDIA_BUCKET } from "./bucket";

/**
 * Short-lived links to private company media, minted server-side for a page
 * the viewer is already allowed to see. Links last an hour and are reused
 * for 45 minutes, so a logo on every page is not a storage call per page.
 */
const TTL_SECONDS = 60 * 60;
const REUSE_MS = 45 * 60 * 1000;
const cache = new Map<string, { url: string; at: number }>();

export async function mediaUrls(paths: Array<string | null | undefined>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const now = Date.now();
  const missing: string[] = [];
  for (const p of new Set(paths.filter((x): x is string => Boolean(x)))) {
    const hit = cache.get(p);
    if (hit && now - hit.at < REUSE_MS) out.set(p, hit.url);
    else missing.push(p);
  }
  if (missing.length === 0) return out;
  const admin = getSupabaseAdmin();
  if (!admin) return out;
  const { data } = await admin.storage.from(MEDIA_BUCKET).createSignedUrls(missing, TTL_SECONDS);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl && !row.error) {
      out.set(row.path, row.signedUrl);
      cache.set(row.path, { url: row.signedUrl, at: now });
    }
  }
  if (cache.size > 5000) cache.clear();
  return out;
}

export async function mediaUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  return (await mediaUrls([path])).get(path) ?? null;
}

/** True when the browser really uploaded this file (it came back as a path). */
export async function mediaExists(path: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const slash = path.lastIndexOf("/");
  const { data } = await admin.storage
    .from(MEDIA_BUCKET)
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
  return Boolean(data?.some((f) => f.name === path.slice(slash + 1)));
}

/** Remove files no longer used (a replaced logo, photo or design). Best effort. */
export async function removeMedia(paths: Array<string | null | undefined>): Promise<void> {
  const list = paths.filter((x): x is string => Boolean(x));
  if (list.length === 0) return;
  const admin = getSupabaseAdmin();
  await admin?.storage.from(MEDIA_BUCKET).remove(list).catch(() => undefined);
  for (const p of list) cache.delete(p);
}
