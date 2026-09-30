/**
 * Locking a company out needs the code emailed to info@flowacord.com —
 * against the real database, with email faked (no message leaves the
 * machine) and the platform admin faked.
 *
 * Uses the placeholder company (slug demo-co), puts its status, plan and
 * dates back afterwards, and removes the codes, audit rows and the two
 * throwaway admins it made. Skips itself without a database.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const HAS_DB = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const who = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("@/lib/authz/guard", () => ({
  requirePlatformAdmin: vi.fn(async () => who.session),
}));

const mail = vi.hoisted(() => ({
  fail: false,
  sent: [] as Array<{ to: string; subject: string; text: string }>,
  sendMail: vi.fn(async (input: { to: string; subject: string; text: string }) => {
    if (mail.fail) return { sent: false, reason: "mail server down" };
    mail.sent.push(input);
    return { sent: true };
  }),
}));
vi.mock("@/lib/email/send", () => ({ sendMail: mail.sendMail, emailConfigured: () => true }));

describe.skipIf(!HAS_DB)("locking a company out needs the emailed code (database)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let requestCode: typeof import("@/lib/platform/lockout-actions").requestLockoutCodeAction;
  let setStatus: typeof import("@/lib/platform/actions").setTenantStatusAction;
  let endTrial: typeof import("@/lib/platform/company-actions").endTrialAction;
  let extendTrial: typeof import("@/lib/platform/company-actions").extendTrialAction;
  let setPlan: typeof import("@/lib/billing/platform-actions").setCompanyPlanAction;

  const stamp = Date.now().toString(36);
  let tenantId: string;
  let before: { status: "ACTIVE" | "SUSPENDED" | "ARCHIVED"; plan: "TRIAL" | "PAID" | "INTERNAL"; trialEndsAt: Date | null; paidUntil: Date | null };
  const admins: Array<{ id: string; displayName: string; email: string }> = [];

  const as = (i: number) => {
    const a = admins[i];
    who.session = { user: { ...a, isPlatformAdmin: true } };
  };
  /** The code in the last email, as the reader would type it. */
  const lastCode = () => {
    const text = mail.sent.at(-1)?.text ?? "";
    const m = /Code: (\d{3}) (\d{3})/.exec(text);
    return m ? `${m[1]}${m[2]}` : "";
  };
  const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");
  /** Forget the minute between codes and the hourly limit, for the next ask. */
  const ageCodes = () =>
    getDb().platformActionCode.updateMany({
      where: { requestedById: { in: admins.map((a) => a.id) } },
      data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    });
  const setTenant = (data: Partial<typeof before>) => getDb().tenant.update({ where: { id: tenantId }, data });
  const status = async () => (await getDb().tenant.findUniqueOrThrow({ where: { id: tenantId } })).status;
  const ask = async (action: "SUSPEND" | "END_TRIAL", reason = "Test: asked to close their account") => {
    await ageCodes();
    const r = await requestCode({ tenantId, action, reason });
    if (!r.ok) throw new Error(r.error);
    return { codeId: r.codeId, code: lastCode() };
  };

  beforeAll(async () => {
    ({ getDb } = await import("@/lib/db"));
    ({ requestLockoutCodeAction: requestCode } = await import("@/lib/platform/lockout-actions"));
    ({ setTenantStatusAction: setStatus } = await import("@/lib/platform/actions"));
    ({ endTrialAction: endTrial, extendTrialAction: extendTrial } = await import("@/lib/platform/company-actions"));
    ({ setCompanyPlanAction: setPlan } = await import("@/lib/billing/platform-actions"));
    const db = getDb();
    const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-co" } });
    tenantId = tenant.id;
    before = { status: tenant.status, plan: tenant.plan, trialEndsAt: tenant.trialEndsAt, paidUntil: tenant.paidUntil };
    for (const n of [1, 2]) {
      const email = `lockout-admin${n}-${stamp}@example.test`;
      const u = await db.user.create({ data: { displayName: `Lockout Admin ${n}`, email, status: "ACTIVE" } });
      admins.push({ id: u.id, displayName: u.displayName, email });
    }
  });

  beforeEach(async () => {
    mail.fail = false;
    as(0);
    await setTenant({ status: "ACTIVE", plan: "INTERNAL", trialEndsAt: null, paidUntil: null });
  });

  afterAll(async () => {
    if (!tenantId) return;
    const db = getDb();
    const ids = admins.map((a) => a.id);
    await db.platformActionCode.deleteMany({ where: { requestedById: { in: ids } } });
    await db.auditEvent.deleteMany({ where: { actorUserId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.tenant.update({ where: { id: tenantId }, data: before });
  });

  it("refuses to suspend without a code, and the company stays active", async () => {
    const r = await setStatus({ tenantId, status: "SUSPENDED" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Suspending needs the code emailed to info@flowacord.com.");
    expect(await status()).toBe("ACTIVE");
  });

  it("emails the code to info@flowacord.com only, keeps it out of the subject, and stores only a hash", async () => {
    const { codeId, code } = await ask("SUSPEND");
    const email = mail.sent.at(-1)!;
    expect(email.to).toBe("info@flowacord.com");
    expect(email.subject).toBe("FlowHRMS: code to suspend Demo Trading Co. (placeholder)");
    expect(email.text).toContain("Asked by: Lockout Admin 1");
    expect(email.text).toContain("Their reason: Test: asked to close their account");
    const row = await getDb().platformActionCode.findUniqueOrThrow({ where: { id: codeId } });
    expect(code).toMatch(/^\d{6}$/);
    expect(row.codeHash).not.toContain(code);
    expect(row.sentTo).toBe("info@flowacord.com");
    // Flowacord's history, not the company's: no tenantId on the row.
    const audit = await getDb().auditEvent.findFirstOrThrow({
      where: { action: "platform.lockout_code_sent", actorUserId: admins[0].id },
      orderBy: { createdAt: "desc" },
    });
    expect(audit.tenantId).toBeNull();
    expect(audit.entityId).toBe(tenantId);
  });

  it("makes the same admin wait a minute before another code", async () => {
    await ask("SUSPEND");
    const again = await requestCode({ tenantId, action: "SUSPEND", reason: "Test again" });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.waitSeconds).toBeGreaterThan(0);
  });

  it("refuses a wrong code, counts the tries, and keeps the wrong tries out of the company's log", async () => {
    const { codeId, code } = await ask("SUSPEND");
    const r = await setStatus({ tenantId, status: "SUSPENDED", codeId, code: wrong(code) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("That code isn't right. 4 tries left.");
    expect(await status()).toBe("ACTIVE");
    const logged = await getDb().auditEvent.findFirstOrThrow({
      where: { action: "platform.lockout_code_wrong", actorUserId: admins[0].id },
    });
    expect(logged.tenantId).toBeNull();
  });

  it("stops working after five wrong tries — even the right code", async () => {
    const { codeId, code } = await ask("SUSPEND");
    for (let i = 0; i < 5; i++) await setStatus({ tenantId, status: "SUSPENDED", codeId, code: wrong(code) });
    const r = await setStatus({ tenantId, status: "SUSPENDED", codeId, code });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Too many wrong tries. Ask for a new code.");
    expect(await status()).toBe("ACTIVE");
  });

  it("is useless to another admin", async () => {
    const { codeId, code } = await ask("SUSPEND");
    as(1);
    const r = await setStatus({ tenantId, status: "SUSPENDED", codeId, code });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("That code was sent for something else. Ask for a new one.");
    expect(await status()).toBe("ACTIVE");
  });

  it("refuses an expired code", async () => {
    const { codeId, code } = await ask("SUSPEND");
    await getDb().platformActionCode.update({ where: { id: codeId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const r = await setStatus({ tenantId, status: "SUSPENDED", codeId, code });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("That code has expired. Ask for a new one.");
  });

  it("suspends with the right code, once, recording the reason given with the code", async () => {
    const { codeId, code } = await ask("SUSPEND", "Test: unpaid for three months");
    const r = await setStatus({ tenantId, status: "SUSPENDED", codeId, code });
    expect(r.ok).toBe(true);
    expect(await status()).toBe("SUSPENDED");
    const audit = await getDb().auditEvent.findFirstOrThrow({
      where: { tenantId, action: "tenant.suspended", actorUserId: admins[0].id },
      orderBy: { createdAt: "desc" },
    });
    expect(audit.reason).toBe("Test: unpaid for three months");
    expect(audit.metadata).toMatchObject({ confirmedWith: "code emailed to info@flowacord.com", codeId });

    // Restoring needs only a reason; the used code does nothing more.
    expect((await setStatus({ tenantId, status: "ACTIVE", reason: "Test: paid" })).ok).toBe(true);
    const again = await setStatus({ tenantId, status: "SUSPENDED", codeId, code });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toContain("already been used");
    expect(await status()).toBe("ACTIVE");
  });

  it("opens exactly one suspension when the right code is used twice at the same moment", async () => {
    const { codeId, code } = await ask("SUSPEND");
    const results = await Promise.all([
      setStatus({ tenantId, status: "SUSPENDED", codeId, code }),
      setStatus({ tenantId, status: "SUSPENDED", codeId, code }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await status()).toBe("SUSPENDED");
  });

  it("sends nothing usable when the email fails, and changes nothing", async () => {
    await ageCodes();
    mail.fail = true;
    const r = await requestCode({ tenantId, action: "SUSPEND", reason: "Test: mail down" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Nothing has changed");
    expect(
      await getDb().platformActionCode.count({ where: { requestedById: admins[0].id, reason: "Test: mail down" } }),
    ).toBe(0);
  });

  it("ends a trial only with its own code, and only a trial", async () => {
    // Not on a trial: nothing to end, no code sent.
    const refused = await requestCode({ tenantId, action: "END_TRIAL", reason: "Test" });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toContain("Only a free trial can be ended");

    await setTenant({ plan: "TRIAL", trialEndsAt: new Date(Date.now() + 10 * 86_400_000) });
    const suspendCode = await ask("SUSPEND");
    const crossed = await endTrial({ tenantId, codeId: suspendCode.codeId, code: suspendCode.code });
    expect(crossed.ok).toBe(false);
    if (!crossed.ok) expect(crossed.error).toBe("That code was sent for something else. Ask for a new one.");

    const { codeId, code } = await ask("END_TRIAL", "Test: trial abuse");
    const ended = await endTrial({ tenantId, codeId, code });
    expect(ended.ok).toBe(true);
    const t = await getDb().tenant.findUniqueOrThrow({ where: { id: tenantId } });
    expect(t.trialEndsAt!.getTime()).toBeLessThanOrEqual(Date.now());
    const audit = await getDb().auditEvent.findFirstOrThrow({
      where: { tenantId, action: "tenant.trial_ended", actorUserId: admins[0].id },
    });
    expect(audit.reason).toBe("Test: trial abuse");
  });

  it("extends only a trial, and never to an earlier date", async () => {
    const notTrial = await extendTrial({ tenantId, days: 7 });
    expect(notTrial.ok).toBe(false);
    if (!notTrial.ok) expect(notTrial.error).toBe("Only a free trial can be extended. This company isn't on one.");

    const ends = new Date(Date.now() + 20 * 86_400_000);
    await setTenant({ plan: "TRIAL", trialEndsAt: ends });
    const sooner = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    const r = await extendTrial({ tenantId, until: sooner });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("earlier than their trial ends now");
    const t = await getDb().tenant.findUniqueOrThrow({ where: { id: tenantId } });
    expect(t.trialEndsAt?.getTime()).toBe(ends.getTime());

    expect((await extendTrial({ tenantId, days: 7 })).ok).toBe(true);
  });

  it("won't set a paid-until date that pauses a company sooner", async () => {
    await setTenant({ plan: "PAID", paidUntil: new Date(Date.now() + 90 * 86_400_000) });
    const plan = await getDb().billingPlan.findFirstOrThrow();
    const sooner = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const r = await setPlan({ tenantId, planKey: plan.key, cycle: "MONTHLY", until: sooner, reason: "Test: typo" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("pause them sooner");
  });
});
