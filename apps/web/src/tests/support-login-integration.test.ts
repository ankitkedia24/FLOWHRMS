/**
 * Flowacord support login — against the real database, with the platform
 * admin, the cookie jar and navigation faked.
 *
 * Opens the placeholder company (demo-co) and the sample company, never a
 * real one; checks a real company is refused without touching it. Removes
 * the two throwaway admins, their support identities, members, sessions
 * and audit rows afterwards, and puts demo-co's status back. Skips without
 * a database.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const HAS_DB = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

vi.mock("server-only", () => ({}));

const jar = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    get: (name: string) => (values.has(name) ? { name, value: values.get(name)! } : undefined),
    set: (name: string, value: string) => void values.set(name, value),
    delete: (name: string) => void values.delete(name),
  };
});
vi.mock("next/headers", () => ({ cookies: async () => jar, headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
const who = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("@/lib/authz/guard", () => ({ requirePlatformAdmin: vi.fn(async () => who.session) }));

/** Run a server action that ends in redirect(); return where it went. */
async function redirectOf(run: () => Promise<unknown>): Promise<string> {
  try {
    const result = await run();
    throw new Error(`expected a redirect, got ${JSON.stringify(result)}`);
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (!url) throw error;
    return url;
  }
}

describe.skipIf(!HAS_DB)("Flowacord support login (database)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let actions: typeof import("@/lib/platform/support-actions");
  let supportSessionFor: typeof import("@/lib/auth/support").supportSessionFor;
  let recordAuditEvent: typeof import("@/lib/audit").recordAuditEvent;

  const stamp = Date.now().toString(36);
  const admins: Array<{ id: string; displayName: string }> = [];
  let demo: { id: string; status: "ACTIVE" | "SUSPENDED" | "ARCHIVED" };
  let sample: { id: string };

  const as = (i: number) => {
    who.session = { user: { ...admins[i], email: null, isPlatformAdmin: true } };
  };
  const openSessionId = () => jar.values.get("fh_support");

  beforeAll(async () => {
    ({ getDb } = await import("@/lib/db"));
    actions = await import("@/lib/platform/support-actions");
    ({ supportSessionFor } = await import("@/lib/auth/support"));
    ({ recordAuditEvent } = await import("@/lib/audit"));
    const db = getDb();
    const d = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-co" } });
    demo = { id: d.id, status: d.status };
    sample = await db.tenant.findUniqueOrThrow({ where: { slug: "sunrise-traders-sample" }, select: { id: true } });
    for (const n of [1, 2]) {
      const u = await db.user.create({
        data: { displayName: `Support Tester ${n}`, email: `support-tester${n}-${stamp}@example.test`, isPlatformAdmin: true },
      });
      admins.push({ id: u.id, displayName: u.displayName });
    }
  });

  beforeEach(() => as(0));

  afterAll(async () => {
    if (!admins.length) return;
    const db = getDb();
    const adminIds = admins.map((a) => a.id);
    const identities = await db.user.findMany({ where: { supportOfUserId: { in: adminIds } }, select: { id: true } });
    const identityIds = identities.map((i) => i.id);
    await db.supportSession.deleteMany({ where: { platformUserId: { in: adminIds } } });
    await db.auditEvent.deleteMany({ where: { actorUserId: { in: [...adminIds, ...identityIds] } } });
    await db.tenantMembership.deleteMany({ where: { userId: { in: identityIds }, status: "SUPPORT" } });
    await db.user.deleteMany({ where: { id: { in: identityIds } } });
    await db.user.deleteMany({ where: { id: { in: adminIds } } });
    await db.tenant.update({ where: { id: demo.id }, data: { status: demo.status } });
  });

  it("refuses a real company until its Terms allow support, without touching it", async () => {
    const db = getDb();
    const real = await db.tenant.findFirst({
      where: { slug: { notIn: ["demo-co", "sunrise-traders-sample"] }, status: "ACTIVE" },
      select: { id: true },
    });
    if (!real) return;
    const r = await actions.startSupportSessionAction({ tenantId: real.id });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("the Terms don't cover support access");
    expect(await db.supportSession.count({ where: { tenantId: real.id, platformUserId: admins[0].id } })).toBe(0);
  });

  it("opens the placeholder company as Flowacord support with the Owner's access", async () => {
    const db = getDb();
    const before = await db.tenantMembership.count({ where: { tenantId: demo.id } });
    expect(await redirectOf(() => actions.startSupportSessionAction({ tenantId: demo.id }))).toBe("/admin");

    const identity = await db.user.findUniqueOrThrow({ where: { supportOfUserId: admins[0].id } });
    expect(identity.displayName).toBe("Flowacord support");
    expect(identity.authUserId).toBeNull();
    const member = await db.tenantMembership.findUniqueOrThrow({
      where: { tenantId_userId: { tenantId: demo.id, userId: identity.id } },
      include: { role: true },
    });
    expect(member.status).toBe("SUPPORT");
    expect(member.role.key).toBe("OWNER");

    const session = await supportSessionFor(admins[0], openSessionId());
    expect(session?.source).toBe("support");
    expect(session?.tenant.id).toBe(demo.id);
    expect(session?.membership.roleKey).toBe("OWNER");
    expect(session?.permissions.has("admin.access")).toBe(true);
    expect(session?.user.displayName).toBe("Flowacord support");
    expect(session?.support).toMatchObject({ platformUserId: admins[0].id, platformUserName: "Support Tester 1" });

    // Hidden from the company: not counted, not listed, not an owner.
    expect(await db.tenantMembership.count({ where: { tenantId: demo.id } })).toBe(before);
    const listed = await db.tenantMembership.findMany({ where: { tenantId: demo.id }, select: { id: true } });
    expect(listed.map((m) => m.id)).not.toContain(member.id);
    const owners = await db.tenantMembership.findMany({
      where: { tenantId: demo.id, role: { key: "OWNER" }, status: { not: "DEACTIVATED" } },
      select: { id: true },
    });
    expect(owners.map((m) => m.id)).not.toContain(member.id);
    expect(await db.$transaction((tx) => tx.tenantMembership.count({ where: { tenantId: demo.id } }))).toBe(before);
    // …but found when asked for by name, or by id.
    expect(await db.tenantMembership.count({ where: { tenantId: demo.id, status: "SUPPORT" } })).toBe(1);
    expect((await db.tenantMembership.findUnique({ where: { id: member.id } }))?.id).toBe(member.id);

    // Flowacord's record: no company id on it.
    const opened = await db.auditEvent.findFirstOrThrow({
      where: { action: "platform.support_session_started", actorUserId: admins[0].id },
    });
    expect(opened.tenantId).toBeNull();
  });

  it("records a change made in support as Flowacord support, never as one of the company's people", async () => {
    const session = await supportSessionFor(admins[0], openSessionId());
    if (!session) throw new Error("no support session");
    await recordAuditEvent(session, { action: "test.support_change", entityType: "test", metadata: { note: "x" } });
    const row = await getDb().auditEvent.findFirstOrThrow({
      where: { tenantId: demo.id, action: "test.support_change" },
      include: { actor: true },
    });
    expect(row.actor?.displayName).toBe("Flowacord support");
    expect(row.actorType).toBe("PLATFORM");
    expect(row.metadata).toMatchObject({ note: "x", supportSessionId: session.support!.sessionId, supportBy: admins[0].id });
  });

  it("is useless to another platform admin, and closes while the company is suspended", async () => {
    expect(await supportSessionFor(admins[1], openSessionId())).toBeNull();
    await getDb().tenant.update({ where: { id: demo.id }, data: { status: "SUSPENDED" } });
    expect(await supportSessionFor(admins[0], openSessionId())).toBeNull();
    await getDb().tenant.update({ where: { id: demo.id }, data: { status: "ACTIVE" } });
    expect(await supportSessionFor(admins[0], openSessionId())).not.toBeNull();
  });

  it("works in one company at a time: opening another closes the last", async () => {
    const first = openSessionId();
    expect(await redirectOf(() => actions.startSupportSessionAction({ tenantId: sample.id }))).toBe("/admin");
    const closed = await getDb().supportSession.findUniqueOrThrow({ where: { id: first! } });
    expect(closed.endedAt).not.toBeNull();
    expect((await supportSessionFor(admins[0], openSessionId()))?.tenant.id).toBe(sample.id);
  });

  it("Exit closes the session and forgets it", async () => {
    const id = openSessionId();
    expect(await redirectOf(() => actions.endSupportSessionAction())).toBe(`/platform/companies/${sample.id}`);
    expect(openSessionId()).toBeUndefined();
    expect((await getDb().supportSession.findUniqueOrThrow({ where: { id: id! } })).endedAt).not.toBeNull();
    expect(await supportSessionFor(admins[0], id)).toBeNull();
  });
});
