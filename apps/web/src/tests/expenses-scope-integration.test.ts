/**
 * Hardening batch 7 — expense claims follow record scope, and nobody but
 * the Owner decides or settles their own. The real actions, read models
 * and tile queue against the real database, in the sample company, with
 * only the request-bound layers mocked: who is signed in, audit writes,
 * cache, bell notifications, the entitlement snapshot (Payroll "on", so
 * the payroll route is offered and reaches its own refusal), and signing.
 *
 * Everyone it uses is a throwaway person under a unique stamp, with a
 * throwaway team-scoped role that holds expenses.approve (the Manager
 * template doesn't): two managers, a report, an outsider, an Admin and an
 * Owner. Every row it makes is removed afterwards; the sample company's
 * own people and claims are only read. Skips itself without a database.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const HAS_DB = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 30_000, hookTimeout: 90_000 });

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(), cookies: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAuditEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications", () => ({ notify: { expenseUpdate: vi.fn(async () => {}) } }));
vi.mock("@/lib/authz/entitlements", () => ({
  loadEntitlements: vi.fn(async () => ({
    modules: { PAYROLL: true, EXPENSES: true, EMPLOYEES: true, ATTENDANCE: true },
    features: {},
    userExceptions: {},
  })),
}));

// Signing is the service-role step: the refusals must come before it.
const signing = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("@/lib/storage/sign", () => ({
  signPrivateFile: vi.fn(async (_bucket: string, path: string) => {
    signing.calls.push(path);
    return { ok: true, url: "https://example.test/signed" };
  }),
}));

const who = vi.hoisted(() => ({ session: null as null | Record<string, unknown> }));
vi.mock("@/lib/authz/guard", () => ({
  checkAccess: vi.fn(async () => ({ session: who.session, decision: { allowed: true } })),
}));

const OUTSIDE_TEAM = "That person isn't in your team.";
const OWN_DECIDE = "You can't decide your own claim. Ask another approver.";
const OWN_SETTLE = "You can't settle your own claim. Another approver has to.";

describe.skipIf(!HAS_DB)("expense claims stay inside the approver's team (database)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let actions: typeof import("@/lib/expenses/actions");
  let queries: typeof import("@/lib/expenses/queries");
  let receiptPath: typeof import("@/lib/storage/paths").receiptPath;

  const stamp = Date.now().toString(36);
  const roleKey = `ZZ_EXPENSE_SCOPE_${stamp.toUpperCase()}`;
  let tenant: { id: string; slug: string; name: string; timezone: string };
  let customRoleId = "";
  const people: Record<string, { membershipId: string; userId: string; roleKey: string }> = {};
  const claimIds: string[] = [];
  const claims: Record<string, string> = {};

  const APPROVER = ["admin.access", "expenses.approve", "expenses.view"];

  const signIn = (key: string) => {
    const p = people[key];
    const approver = ["mgr", "mgr2", "admin", "owner"].includes(key);
    who.session = {
      user: { id: p.userId, displayName: `Expense scope ${key}`, email: null, isPlatformAdmin: false },
      tenant: { ...tenant, plan: "INTERNAL", trialEndsAt: null, selfSignup: false, ownerEmailVerifiedAt: null, paidUntil: null },
      membership: { id: p.membershipId, roleKey: p.roleKey, roleName: p.roleKey, employeeCode: null },
      permissions: new Set(approver ? APPROVER : []),
      source: "supabase",
    };
    return who.session as unknown as import("@/lib/auth/types").AppSession;
  };

  let day = 0;
  /** A claim submitted through the real action, so its tile is raised too. */
  const submitAs = async (key: string, amount: number) => {
    signIn(key);
    day += 1;
    const r = await actions.submitClaimAction({
      categoryKey: "local-travel",
      amount,
      expenseDate: new Date(Date.now() - day * 86_400_000).toISOString().slice(0, 10),
      description: `Expense scope test ${stamp}`,
      receipts: [],
    });
    if (!r.ok || !r.claimId) throw new Error(`submit failed for ${key}: ${r.ok ? "no id" : r.error}`);
    claimIds.push(r.claimId);
    return r.claimId;
  };

  const status = async (id: string) =>
    (await getDb().expenseClaim.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;

  const approveAs = async (key: string, claimId: string) => {
    signIn(key);
    return actions.decideClaimAction({ claimId, decision: "APPROVE" });
  };

  const tileRecipients = async (claimId: string) => {
    const tile = await getDb().actionRequest.findFirst({
      where: { tenantId: tenant.id, subjectType: "expense_claim", subjectId: claimId },
      include: { recipients: true },
    });
    return new Set(tile?.recipients.map((r) => r.userId) ?? []);
  };

  beforeAll(async () => {
    ({ getDb } = await import("@/lib/db"));
    actions = await import("@/lib/expenses/actions");
    queries = await import("@/lib/expenses/queries");
    ({ receiptPath } = await import("@/lib/storage/paths"));
    const { getPolicy, setPolicy } = await import("@/lib/policies");
    const { DEFAULT_EXPENSES_POLICY } = await import("@/lib/expenses/policy");
    const db = getDb();
    tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "sunrise-traders-sample" } });

    const roleId: Record<string, string> = {};
    for (const r of await db.role.findMany({ where: { tenantId: tenant.id } })) roleId[r.key] = r.id;

    // A team-scoped role (not one of the four company-wide keys) that can
    // approve, so the tile audience has a Manager to include or leave out.
    const custom = await db.role.create({
      data: { tenantId: tenant.id, key: roleKey, name: `zz expense scope ${stamp}` },
    });
    customRoleId = custom.id;
    const permissions = await db.permission.findMany({
      where: { key: { in: ["expenses.approve", "expenses.view"] } },
      select: { id: true },
    });
    await db.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: custom.id, permissionId: p.id })),
    });
    roleId[roleKey] = custom.id;

    const add = async (key: string, role: string, reportingTo?: string) => {
      const user = await db.user.create({
        data: { displayName: `Expense scope ${key}`, email: `expense-scope-${key}-${stamp}@example.test`, status: "ACTIVE" },
      });
      const m = await db.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: roleId[role],
          status: "ACTIVE",
          reportingToId: reportingTo ? people[reportingTo].membershipId : null,
        },
      });
      people[key] = { membershipId: m.id, userId: user.id, roleKey: role };
    };
    await add("owner", "OWNER");
    await add("admin", "ADMIN");
    await add("mgr", roleKey);
    await add("mgr2", roleKey);
    await add("report", "EMPLOYEE", "mgr");
    await add("outsider", "EMPLOYEE");

    // The same fixture the expenses suite leaves: published rules.
    if (!(await getPolicy(tenant.id, "expenses"))) {
      await setPolicy(tenant.id, "expenses", DEFAULT_EXPENSES_POLICY, people.owner.userId);
    }

    claims.report = await submitAs("report", 410);
    claims.outsider = await submitAs("outsider", 420);
    claims.mgr = await submitAs("mgr", 430);
  });

  afterAll(async () => {
    if (!tenant) return;
    const db = getDb();
    const ids = Object.values(people).map((p) => p.membershipId);
    await db.actionRequest.deleteMany({ where: { tenantId: tenant.id, aboutMembershipId: { in: ids } } });
    if (claimIds.length) {
      await db.expenseSettlement.deleteMany({ where: { claimId: { in: claimIds } } });
      await db.expenseReceipt.deleteMany({ where: { claimId: { in: claimIds } } });
      await db.expenseClaim.deleteMany({ where: { id: { in: claimIds } } });
    }
    // Leave the counter at its baseline when the company has no claims.
    if ((await db.expenseClaim.count({ where: { tenantId: tenant.id } })) === 0) {
      await db.expenseCounter.deleteMany({ where: { tenantId: tenant.id } });
    }
    await db.tenantMembership.updateMany({ where: { id: { in: ids } }, data: { reportingToId: null } });
    await db.tenantMembership.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: Object.values(people).map((p) => p.userId) } } });
    if (customRoleId) await db.role.delete({ where: { id: customRoleId } });
  });

  it("lists only the Manager's team's claims, and not their own in the queue", async () => {
    const mine = await queries.listAdminClaims(signIn("mgr"));
    const waiting = new Set(mine.waiting.map((c) => c.id));
    expect(waiting.has(claims.report)).toBe(true);
    expect(waiting.has(claims.outsider)).toBe(false);
    expect(waiting.has(claims.mgr)).toBe(false);
    // Nothing from anyone outside the team, in any list.
    const everyone = [...mine.waiting, ...mine.unsettled, ...mine.recent].map((c) => c.membership.id);
    expect(everyone.every((id) => [people.mgr.membershipId, people.report.membershipId].includes(id))).toBe(true);

    // An Owner sees the whole company.
    const all = await queries.listAdminClaims(signIn("owner"));
    const allWaiting = new Set(all.waiting.map((c) => c.id));
    for (const id of [claims.report, claims.outsider, claims.mgr]) expect(allWaiting.has(id)).toBe(true);
  });

  it("opens a report's claim for their Manager but not an outsider's", async () => {
    const mgr = signIn("mgr");
    expect(await queries.loadClaimForViewer(mgr, claims.outsider)).toBeNull();
    expect(await queries.loadClaimForViewer(mgr, claims.report)).not.toBeNull();
    expect(await queries.loadClaimForViewer(mgr, claims.mgr)).not.toBeNull(); // their own
    expect(await queries.loadClaimForViewer(signIn("admin"), claims.outsider)).not.toBeNull();
  });

  it("refuses a Manager approving or settling an outsider's claim, by either route", async () => {
    const refused = await approveAs("mgr", claims.outsider);
    expect(!refused.ok && refused.error).toBe(OUTSIDE_TEAM);
    expect(await status(claims.outsider)).toBe("SUBMITTED");

    expect((await approveAs("owner", claims.outsider)).ok).toBe(true);
    signIn("mgr");
    const outside = await actions.settleClaimAction({ claimId: claims.outsider, route: "OUTSIDE", reference: "Cash, voucher 7" });
    expect(!outside.ok && outside.error).toBe(OUTSIDE_TEAM);
    const payroll = await actions.settleClaimAction({ claimId: claims.outsider, route: "PAYROLL" });
    expect(!payroll.ok && payroll.error).toBe(OUTSIDE_TEAM);
    expect(await status(claims.outsider)).toBe("APPROVED");
    expect(await getDb().expenseSettlement.count({ where: { claimId: claims.outsider } })).toBe(0);

    // Nor is it offered to them on the payroll screen.
    const awaiting = await queries.listClaimsAwaitingPayroll(signIn("mgr"));
    expect(awaiting.some((c) => c.id === claims.outsider)).toBe(false);
  });

  it("lets a Manager approve and settle their direct report's claim", async () => {
    expect((await approveAs("mgr", claims.report)).ok).toBe(true);
    expect(await status(claims.report)).toBe("APPROVED");
    signIn("mgr");
    const settled = await actions.settleClaimAction({ claimId: claims.report, route: "OUTSIDE", reference: "UPI, 30 Sept" });
    expect(settled.ok).toBe(true);
    expect(await status(claims.report)).toBe("SETTLED");
  });

  it("refuses a Manager approving or settling their own claim, and leaves it out of their queues", async () => {
    const own = await approveAs("mgr", claims.mgr);
    expect(!own.ok && own.error).toBe(OWN_DECIDE);
    expect(await status(claims.mgr)).toBe("SUBMITTED");

    expect((await approveAs("owner", claims.mgr)).ok).toBe(true);
    signIn("mgr");
    for (const route of ["OUTSIDE", "PAYROLL"] as const) {
      const r = await actions.settleClaimAction({ claimId: claims.mgr, route, reference: "Cash to myself" });
      expect(!r.ok && r.error).toBe(OWN_SETTLE);
    }
    expect(await status(claims.mgr)).toBe("APPROVED");
    const lists = await queries.listAdminClaims(signIn("mgr"));
    expect(lists.unsettled.some((c) => c.id === claims.mgr)).toBe(false);
    expect((await queries.listClaimsAwaitingPayroll(signIn("mgr"))).some((c) => c.id === claims.mgr)).toBe(false);
  });

  it("refuses a company-wide settler settling their own approved claim (the audit's finding)", async () => {
    const id = await submitAs("admin", 440);
    expect((await approveAs("owner", id)).ok).toBe(true);
    signIn("admin");
    const r = await actions.settleClaimAction({ claimId: id, route: "OUTSIDE", reference: "Cash to myself" });
    expect(!r.ok && r.error).toBe(OWN_SETTLE);
    expect(await status(id)).toBe("APPROVED");
    const lists = await queries.listAdminClaims(signIn("admin"));
    expect(lists.unsettled.some((c) => c.id === id)).toBe(false);

    // Someone else can.
    signIn("owner");
    expect((await actions.settleClaimAction({ claimId: id, route: "OUTSIDE", reference: "Cash, voucher 9" })).ok).toBe(true);
  });

  it("lets an Owner approve and settle their own claim, recorded as self-approved", async () => {
    const id = await submitAs("owner", 450);
    expect((await tileRecipients(id)).has(people.owner.userId)).toBe(true);
    const owner = signIn("owner");
    expect((await queries.listAdminClaims(owner)).waiting.some((c) => c.id === id)).toBe(true);

    const approved = await actions.decideClaimAction({ claimId: id, decision: "APPROVE" });
    expect(approved.ok).toBe(true);
    const transition = await getDb().expenseClaimTransition.findFirstOrThrow({
      where: { claimId: id, toStatus: "APPROVED" },
    });
    expect(transition.selfApproved).toBe(true);

    expect((await queries.listAdminClaims(signIn("owner"))).unsettled.some((c) => c.id === id)).toBe(true);
    const settled = await actions.settleClaimAction({ claimId: id, route: "OUTSIDE", reference: "Cash, voucher 10" });
    expect(settled.ok).toBe(true);
    expect(await status(id)).toBe("SETTLED");
  });

  it("refuses a receipt link for an outsider's claim before anything is signed", async () => {
    const db = getDb();
    const receipt = async (claimKey: string, personKey: string) =>
      (
        await db.expenseReceipt.create({
          data: {
            tenantId: tenant.id,
            claimId: claims[claimKey],
            // A path the claimant's folder rule accepts: only scope refuses it.
            path: receiptPath(tenant.id, people[personKey].membershipId, crypto.randomUUID(), "zz-scope.pdf"),
            name: "zz-scope.pdf",
            mime: "application/pdf",
            sizeBytes: 10,
            uploadedById: people[personKey].userId,
          },
        })
      ).id;
    const outsiders = await receipt("outsider", "outsider");
    const reports = await receipt("report", "report");

    signing.calls.length = 0;
    signIn("mgr");
    const refused = await actions.getReceiptUrlAction(outsiders);
    expect(!refused.ok && refused.error).toBe(OUTSIDE_TEAM);
    expect(signing.calls).toHaveLength(0);

    const opened = await actions.getReceiptUrlAction(reports);
    expect(opened.ok).toBe(true);
    expect(signing.calls).toHaveLength(1);
  });

  it("sends a team member's claim tile to their Manager, not to a Manager outside the team", async () => {
    const reportTile = await tileRecipients(claims.report);
    expect(reportTile.has(people.mgr.userId)).toBe(true);
    expect(reportTile.has(people.mgr2.userId)).toBe(false);
    expect(reportTile.has(people.owner.userId)).toBe(true); // company-wide

    const outsiderTile = await tileRecipients(claims.outsider);
    expect(outsiderTile.has(people.mgr.userId)).toBe(false);
    expect(outsiderTile.has(people.mgr2.userId)).toBe(false);
    expect(outsiderTile.has(people.admin.userId)).toBe(true);

    // A Manager's own claim never reaches their own tiles.
    expect((await tileRecipients(claims.mgr)).has(people.mgr.userId)).toBe(false);
  });
});
