import { checkDatabase } from "@/lib/platform/health";

export const dynamic = "force-dynamic";

/**
 * For the uptime monitor (OPERATIONS.md → Monitoring): 200 and "ok" when
 * the site and its database answer, 503 and "down" when the database does
 * not. It says nothing else — no data, no versions, no host names — so it
 * is safe to leave open to the world. It skips the sign-in check (proxy.ts),
 * so it measures the site and database, not Supabase Auth.
 */
export async function GET() {
  const database = await checkDatabase();
  return Response.json(
    { status: database.ok ? "ok" : "down", database: database.ok ? "ok" : "down", ms: database.ms },
    { status: database.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
