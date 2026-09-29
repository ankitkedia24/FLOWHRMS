/**
 * Kudos flow — integration against the real database (the sample tenant),
 * same mocking pattern as rewards: only the request-bound layers faked.
 * Proves the weekly-window counts, the caps, and the notify hand-off are
 * wired to the right columns.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const HAS_DB = Boolean(process.env.DATABASE_URL);

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAuditEvent: vi.fn() }));

const notices: Array<{ userId: string; title: string; body?: string }> = [];
vi.mock("@/lib/notifications", () => ({
  notify: {
    performanceMoment: vi.fn(
      async (_s: unknown, userId: string, title: string, body?: string) => {
        notices.push({ userId, title, body });
      },
    ),
  },
}));

let sessionMembershipId = "";
let sessionUserId = "";
let sessionTenant = { id: "", slug: "", name: "", timezone: "Asia/Kolkata" };
vi.mock("@/lib/authz/guard", () => ({
  checkAccess: vi.fn(async () => ({
    session: {
      user: { id: sessionUserId, displayName: "Head Person", email: null, isPlatformAdmin: false },
      tenant: sessionTenant,
      membership: { id: sessionMembershipId, roleKey: "MANAGER", roleName: "Manager", employeeCode: null },
      permissions: new Set(),
      source: "supabase",
    },
    decision: { allowed: true },
  })),
}));

import { getDb } from "@/lib/db";
import { sendKudosAction } from "@/lib/performance/kudos-actions";

const d = describe.skipIf(!HAS_DB);

d("kudos flow (integration, sample tenant)", () => {
  const db = HAS_DB ? getDb() : (null as never);
  let tenantId = "";
  let recipientA = "";
  let recipientAUserId = "";
  let recipientB = "";
  let recipientC = "";
  let recipientD = "";

  beforeAll(async () => {
    const tenant = await db.tenant.findUniqueOrThrow({
      where: { slug: "sunrise-traders-sample" },
    });
    tenantId = tenant.id;
    sessionTenant = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      timezone: tenant.timezone,
    };

    const members = await db.tenantMembership.findMany({
      where: { tenantId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      take: 5,
      include: { user: true },
    });
    sessionMembershipId = members[0].id;
    sessionUserId = members[0].userId;
    recipientA = members[1].id;
    recipientAUserId = members[1].userId;
    recipientB = members[2].id;
    recipientC = members[3].id;
    recipientD = members[4].id;

    // A clean week for the sender, whatever earlier runs left behind.
    await db.kudos.deleteMany({ where: { tenantId, fromMembershipId: sessionMembershipId } });
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await db.kudos.deleteMany({ where: { tenantId, fromMembershipId: sessionMembershipId } });
  });

  it("a kudo lands, with the words delivered to the recipient's bell", async () => {
    const result = await sendKudosAction({
      toMembershipId: recipientA,
      message: "The Thane rush yesterday — handled start to finish.",
    });
    expect(result.ok).toBe(true);
    expect(notices).toContainEqual({
      userId: recipientAUserId,
      title: "Kudos from Head Person",
      body: "The Thane rush yesterday — handled start to finish.",
    });
  });

  it("a second one to the same person this week is refused", async () => {
    const result = await sendKudosAction({
      toMembershipId: recipientA,
      message: "And again!",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Spread it around");
  });

  it("the weekly cap of three holds", async () => {
    expect((await sendKudosAction({ toMembershipId: recipientB, message: "Solid week." })).ok).toBe(true);
    expect((await sendKudosAction({ toMembershipId: recipientC, message: "Solid week." })).ok).toBe(true);
    const fourth = await sendKudosAction({ toMembershipId: recipientD, message: "Solid week." });
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) expect(fourth.error).toContain("3 for the week");
  });

  it("never to yourself", async () => {
    await db.kudos.deleteMany({ where: { tenantId, fromMembershipId: sessionMembershipId } });
    const result = await sendKudosAction({
      toMembershipId: sessionMembershipId,
      message: "I am great.",
    });
    expect(result.ok).toBe(false);
  });
});
