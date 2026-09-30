import "server-only";

import { getDb } from "@/lib/db";

/** Longest the database may take before the site counts as down. */
export const DATABASE_TIMEOUT_MS = 5000;

/**
 * Does the database answer, and how fast? Shared by /api/health (the uptime
 * monitor) and /platform/system, so the two never disagree.
 */
export async function checkDatabase(): Promise<{ ok: boolean; ms: number }> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      getDb().$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), DATABASE_TIMEOUT_MS);
      }),
    ]);
    return { ok: true, ms: Date.now() - started };
  } catch {
    return { ok: false, ms: Date.now() - started };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
