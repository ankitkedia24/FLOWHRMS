/**
 * Held invitations — against the real database, with email faked (no
 * message leaves the machine).
 *
 * A self-serve company's invitations wait until its owner confirms their
 * email. This proves, in the placeholder company (slug demo-co, switched
 * to "self-serve, not confirmed" for the test and put back afterwards):
 * only people with an email and no invitation ever issued are held; the
 * confirmation sends each of them exactly one invitation, even when the
 * link is opened twice at the same moment; a failed email is reported by
 * name; and nothing is sent twice. Everything it makes is removed. Skips
 * itself without a database.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const HAS_DB = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
const mail = vi.hoisted(() => ({
  sendMail: vi.fn(async (input: { to: string }) => {
    if (input.to.startsWith("held-throw")) throw new Error("connection reset");
    return input.to.startsWith("held-bounce")
      ? { sent: false, reason: "The email didn't go through: mailbox unavailable." }
      : { sent: true };
  }),
}));
vi.mock("@/lib/email/send", () => ({ sendMail: mail.sendMail, emailConfigured: () => true }));

describe.skipIf(!HAS_DB)("held invitations (database)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let held: typeof import("@/lib/invites/held");
  let redeem: typeof import("@/lib/signup/verify").redeemEmailVerification;
  let hash: typeof import("@/lib/invites/token").hashInviteToken;

  const stamp = Date.now().toString(36);
  const token = `held-test-token-${stamp}-0123456789abcdef`;
  const started = new Date();
  let tenantId: string;
  let before: { selfSignup: boolean; ownerEmailVerifiedAt: Date | null };
  const userIds: string[] = [];
  const members: Record<"waiting" | "noEmail" | "revoked" | "bounce" | "throws", string> = {
    waiting: "",
    noEmail: "",
    revoked: "",
    bounce: "",
    throws: "",
  };

  beforeAll(async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://hrms.example.test");
    ({ getDb } = await import("@/lib/db"));
    held = await import("@/lib/invites/held");
    ({ redeemEmailVerification: redeem } = await import("@/lib/signup/verify"));
    ({ hashInviteToken: hash } = await import("@/lib/invites/token"));
    const db = getDb();

    const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-co" } });
    tenantId = tenant.id;
    before = { selfSignup: tenant.selfSignup, ownerEmailVerifiedAt: tenant.ownerEmailVerifiedAt };
    await db.tenant.update({ where: { id: tenantId }, data: { selfSignup: true, ownerEmailVerifiedAt: null } });

    const role = await db.role.findFirstOrThrow({ where: { tenantId, key: "EMPLOYEE" } });
    const add = async (key: keyof typeof members, name: string, email: string | null) => {
      const user = await db.user.create({ data: { displayName: name, email, status: "INVITED" } });
      userIds.push(user.id);
      const m = await db.tenantMembership.create({
        data: { tenantId, userId: user.id, roleId: role.id, status: "INVITED" },
      });
      members[key] = m.id;
    };
    await add("waiting", "Held Asha", `held-asha-${stamp}@example.test`);
    await add("noEmail", "Held Ravi", null);
    await add("revoked", "Held Meena", `held-meena-${stamp}@example.test`);
    await add("bounce", "Held Kiran", `held-bounce-${stamp}@example.test`);
    await add("throws", "Held Dev", `held-throw-${stamp}@example.test`);
    // Meena's invitation was issued once and withdrawn: not held, not resent.
    await db.employeeInvite.create({
      data: {
        tenantId,
        membershipId: members.revoked,
        tokenHash: hash(`held-revoked-${stamp}-0123456789abcdef`),
        status: "REVOKED",
        sentToEmail: `held-meena-${stamp}@example.test`,
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: new Date(),
      },
    });
    await db.emailVerification.create({
      data: {
        tenantId,
        userId: userIds[0],
        email: `held-owner-${stamp}@example.test`,
        tokenHash: hash(token),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
  });

  afterAll(async () => {
    if (!tenantId) return;
    const db = getDb();
    const ids = Object.values(members).filter(Boolean);
    await db.auditEvent.deleteMany({
      where: {
        tenantId,
        createdAt: { gte: started },
        action: { in: ["tenant.owner_email_verified", "employee.invite_sent"] },
      },
    });
    await db.employeeInvite.deleteMany({ where: { membershipId: { in: ids } } });
    // Anyone else in the placeholder company who was waiting got one too.
    await db.employeeInvite.deleteMany({ where: { tenantId, createdAt: { gte: started } } });
    await db.tenantMembership.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.emailVerification.deleteMany({ where: { tokenHash: hash(token) } });
    await db.tenant.update({ where: { id: tenantId }, data: before });
  });

  it("counts only people with an email and no invitation ever issued", async () => {
    // Other INVITED people already in the placeholder company may count too.
    const count = await held.countHeldInvitations(tenantId);
    const mine = await getDb().tenantMembership.count({
      where: { id: { in: [members.waiting, members.bounce, members.throws] }, invites: { none: {} } },
    });
    expect(mine).toBe(3);
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it("sends nothing while the owner has not confirmed", async () => {
    expect(await held.sendHeldInvitations(tenantId)).toEqual({ sent: [], failed: [], unfinished: false });
    expect(mail.sendMail).not.toHaveBeenCalled();
  });

  it("confirms once and sends each held invitation once, even when the link is opened twice at once", async () => {
    const [a, b] = await Promise.all([redeem(token), redeem(token)]);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const winner = a.already ? b : a;
    const loser = a.already ? a : b;
    expect(loser.already).toBe(true);
    expect(loser.invitations).toEqual({ sent: [], failed: [], unfinished: false });
    expect(winner.already).toBe(false);
    expect(winner.invitations.sent).toContain("Held Asha");
    expect(winner.invitations.failed).toContain("Held Kiran");
    // A mail server that throws fails that one person, not the rest.
    expect(winner.invitations.failed).toContain("Held Dev");
    expect(winner.invitations.unfinished).toBe(false);
    expect(winner.invitations.sent).not.toContain("Held Ravi");
    expect(winner.invitations.sent).not.toContain("Held Meena");

    const db = getDb();
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    expect(tenant.ownerEmailVerifiedAt).not.toBeNull();

    const invites = await db.employeeInvite.findMany({
      where: { membershipId: { in: Object.values(members) } },
    });
    const of = (id: string) => invites.filter((i) => i.membershipId === id);
    expect(of(members.waiting)).toHaveLength(1);
    expect(of(members.waiting)[0]).toMatchObject({ status: "PENDING", sentToEmail: `held-asha-${stamp}@example.test` });
    // A failed email still leaves an invitation, so "Send again" gives a link.
    expect(of(members.bounce)).toHaveLength(1);
    expect(of(members.noEmail)).toHaveLength(0);
    expect(of(members.revoked)).toHaveLength(1);
    expect(of(members.revoked)[0].status).toBe("REVOKED");

    const toMine = mail.sendMail.mock.calls.filter(([m]) => m.to.includes(stamp));
    expect(toMine.map(([m]) => m.to).sort()).toEqual(
      [`held-asha-${stamp}@example.test`, `held-bounce-${stamp}@example.test`, `held-throw-${stamp}@example.test`].sort(),
    );

    const audits = await db.auditEvent.findMany({
      where: { tenantId, action: "employee.invite_sent", entityId: { in: [members.waiting, members.bounce, members.throws] } },
    });
    expect(audits).toHaveLength(3);
    expect(audits.find((e) => e.entityId === members.bounce)?.metadata).toMatchObject({ delivered: false });
  });

  it("never sends the same held invitation twice", async () => {
    const calls = mail.sendMail.mock.calls.length;
    const again = await held.sendHeldInvitations(tenantId);
    expect(again.sent).not.toContain("Held Asha");
    expect(again.failed).not.toContain("Held Kiran");
    expect(mail.sendMail.mock.calls.filter(([m]) => m.to.includes(stamp)).length).toBe(
      mail.sendMail.mock.calls.slice(0, calls).filter(([m]) => m.to.includes(stamp)).length,
    );
    expect(await redeem(token)).toMatchObject({ ok: true, already: true });
  });
});
