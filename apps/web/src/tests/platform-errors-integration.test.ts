/**
 * Server errors are recorded and emailed at most once an hour per kind —
 * against the real database, with email faked. Uses routes nobody else
 * writes (/test-errors-<stamp>/…) and removes its rows afterwards. Also
 * checks the uptime monitor's /api/health answer. Skips without a database.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const HAS_DB = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

vi.mock("server-only", () => ({}));
const mail = vi.hoisted(() => ({
  sent: [] as Array<{ to: string; subject: string; text: string }>,
  sendMail: vi.fn(async (input: { to: string; subject: string; text: string }) => {
    mail.sent.push(input);
    return { sent: true };
  }),
}));
vi.mock("@/lib/email/send", () => ({ sendMail: mail.sendMail, emailConfigured: () => true }));

describe.skipIf(!HAS_DB)("server errors on the live site (database)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let record: typeof import("@/lib/platform/errors").recordServerError;
  let health: typeof import("@/app/api/health/route").GET;
  const stamp = Date.now().toString(36);
  const route = `/test-errors-${stamp}/[id]`;

  beforeAll(async () => {
    ({ getDb } = await import("@/lib/db"));
    ({ recordServerError: record } = await import("@/lib/platform/errors"));
    ({ GET: health } = await import("@/app/api/health/route"));
  });

  afterAll(async () => {
    if (!getDb) return;
    await getDb().platformError.deleteMany({ where: { route: { startsWith: `/test-errors-${stamp}` } } });
  });

  const rows = () => getDb().platformError.findMany({ where: { route: { startsWith: `/test-errors-${stamp}` } } });

  it("records the first of a kind and emails info@flowacord.com, without the email address in the message", async () => {
    await record({
      error: new Error("Claim 41 not found for asha@example.test"),
      path: "/admin/expenses/41?tab=x",
      method: "GET",
      routePath: route,
      routeType: "render",
    });
    const [row] = await rows();
    expect(row.count).toBe(1);
    expect(row.message).toBe("Claim 41 not found for [email]");
    expect(row.route).toBe(route);
    expect(row.lastEmailedAt).not.toBeNull();
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toBe("info@flowacord.com");
    expect(mail.sent[0].text).not.toContain("asha@example.test");
  });

  it("counts the same kind again without another email", async () => {
    await record({ error: new Error("Claim 42 not found for ravi@example.test"), method: "GET", routePath: route, routeType: "render" });
    await record({ error: new Error("Claim 43 not found for ravi@example.test"), method: "GET", routePath: route, routeType: "render" });
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0].count).toBe(3);
    expect(mail.sent).toHaveLength(1);
  });

  it("emails again once an hour has passed", async () => {
    const [row] = await rows();
    await getDb().platformError.update({
      where: { id: row.id },
      data: { lastEmailedAt: new Date(Date.now() - 61 * 60_000) },
    });
    await record({ error: new Error("Claim 44 not found for dev@example.test"), method: "GET", routePath: route, routeType: "render" });
    expect(mail.sent).toHaveLength(2);
    expect(mail.sent[1].text).toContain("Seen 4 times");
  });

  it("ignores redirects and not-found pages", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/sign-in;307;" });
    await record({ error: redirect, method: "GET", routePath: `/test-errors-${stamp}/redirect`, routeType: "render" });
    expect((await rows()).some((r) => r.route.endsWith("/redirect"))).toBe(false);
  });

  it("never throws, even when the error isn't an Error", async () => {
    await expect(
      record({ error: { weird: true }, method: "POST", routePath: `/test-errors-${stamp}/odd`, routeType: "action" }),
    ).resolves.toBeUndefined();
  });

  it("answers the uptime monitor with ok, and nothing more", async () => {
    const response = await health();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(Object.keys(body).sort()).toEqual(["database", "ms", "status"]);
  });
});
