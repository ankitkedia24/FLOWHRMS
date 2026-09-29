/**
 * Who may change whom — the real actions against the real database, in the
 * placeholder company (slug demo-co), with only the request-bound layers
 * mocked (who is signed in, audit writes, cache, auth sign-out). Everything
 * it creates is removed and the Admin access level is put back exactly.
 * Skips itself without a database.
 *
 * Proves what the pure rules can't: the edit form and the Deactivate
 * button both refuse HR acting on an Owner, nobody changes their own
 * status, the form's "Has left" revokes invitations like the button does,
 * reporting loops and taken employee codes are refused with a message,
 * and a role save can neither touch a level at or above you nor move a
 * permission you don't hold.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const HAS_DB = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => null, ADMIN_KEY_MISSING: "no key" }));

const who = vi.hoisted(() => ({
  session: null as null | Record<string, unknown>,
}));
vi.mock("@/lib/authz/guard", () => ({
  checkAccess: vi.fn(async () => ({ session: who.session, decision: { allowed: true } })),
}));

describe.skipIf(!HAS_DB)("who may change whom (database)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let saveEmployee: typeof import("@/lib/employees/actions").saveEmployeeAction;
  let deactivate: typeof import("@/lib/invites/actions").deactivateEmployeeAction;
  let saveRole: typeof import("@/lib/roles/actions").saveRolePermissionsAction;

  const stamp = Date.now().toString(36);
  let tenant: { id: string; slug: string; name: string; timezone: string };
  const roleId: Record<string, string> = {};
  const people: Record<string, { membershipId: string; userId: string }> = {};
  let adminRoleBefore: string[] = [];
  let adminRoleId = "";
  let superAdminRoleId = "";

  const signIn = (key: string, roleKey: string, permissions: string[] = []) => {
    who.session = {
      user: { id: people[key].userId, displayName: key, email: null, isPlatformAdmin: false },
      tenant: { ...tenant, plan: "INTERNAL", trialEndsAt: null, selfSignup: false, ownerEmailVerifiedAt: null, paidUntil: null },
      membership: { id: people[key].membershipId, roleKey, roleName: roleKey, employeeCode: null },
      permissions: new Set(permissions),
      source: "supabase",
    };
  };

  const form = async (key: string, change: Record<string, unknown> = {}) => {
    const m = await getDb().tenantMembership.findUniqueOrThrow({
      where: { id: people[key].membershipId },
      include: { user: true },
    });
    return {
      membershipId: m.id,
      displayName: m.user.displayName,
      employeeCode: m.employeeCode ?? "",
      branchId: m.branchId,
      shiftId: m.shiftId,
      reportingToId: m.reportingToId,
      canCheckInAtAnyBranch: m.canCheckInAtAnyBranch,
      status: m.status as "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "INVITED",
      joinedOn: "",
      ...change,
    };
  };
  const statusOf = async (key: string) =>
    (await getDb().tenantMembership.findUniqueOrThrow({ where: { id: people[key].membershipId } })).status;

  beforeAll(async () => {
    ({ getDb } = await import("@/lib/db"));
    ({ saveEmployeeAction: saveEmployee } = await import("@/lib/employees/actions"));
    ({ deactivateEmployeeAction: deactivate } = await import("@/lib/invites/actions"));
    ({ saveRolePermissionsAction: saveRole } = await import("@/lib/roles/actions"));
    const db = getDb();
    tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-co" } });
    for (const r of await db.role.findMany({ where: { tenantId: tenant.id } })) roleId[r.key] = r.id;

    const add = async (key: string, roleKey: string, status: "ACTIVE" | "INVITED", code: string | null = null) => {
      const user = await db.user.create({
        data: { displayName: `Guard ${key}`, email: `guard-${key}-${stamp}@example.test`, status: status === "ACTIVE" ? "ACTIVE" : "INVITED" },
      });
      const m = await db.tenantMembership.create({
        data: { tenantId: tenant.id, userId: user.id, roleId: roleId[roleKey], status, employeeCode: code },
      });
      people[key] = { membershipId: m.id, userId: user.id };
    };
    await add("ownerA", "OWNER", "ACTIVE");
    await add("ownerB", "OWNER", "ACTIVE");
    await add("hr", "HR", "ACTIVE");
    await add("invited", "EMPLOYEE", "INVITED");
    await add("empA", "EMPLOYEE", "ACTIVE", `GA-${stamp}`);
    await add("empB", "EMPLOYEE", "ACTIVE", `GB-${stamp}`);
    await db.tenantMembership.update({
      where: { id: people.empB.membershipId },
      data: { reportingToId: people.empA.membershipId },
    });
    await db.employeeInvite.create({
      data: {
        tenantId: tenant.id,
        membershipId: people.invited.membershipId,
        tokenHash: `guard-${stamp}-${"0".repeat(40)}`,
        status: "PENDING",
        sentToEmail: `guard-invited-${stamp}@example.test`,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    adminRoleId = roleId.ADMIN;
    superAdminRoleId = roleId.SUPER_ADMIN;
    adminRoleBefore = (
      await db.rolePermission.findMany({ where: { roleId: adminRoleId }, include: { permission: true } })
    ).map((rp) => rp.permission.key);
  });

  afterAll(async () => {
    if (!tenant) return;
    const db = getDb();
    // The Admin access level exactly as it was.
    const perms = await db.permission.findMany({ where: { key: { in: adminRoleBefore } } });
    await db.$transaction([
      db.rolePermission.deleteMany({ where: { roleId: adminRoleId } }),
      db.rolePermission.createMany({ data: perms.map((p) => ({ roleId: adminRoleId, permissionId: p.id })) }),
    ]);
    const ids = Object.values(people).map((p) => p.membershipId);
    await db.employeeInvite.deleteMany({ where: { membershipId: { in: ids } } });
    await db.tenantMembership.updateMany({ where: { id: { in: ids } }, data: { reportingToId: null } });
    await db.tenantMembership.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: Object.values(people).map((p) => p.userId) } } });
  });

  it("refuses HR suspending an Owner, from the form and from the Deactivate button", async () => {
    signIn("hr", "HR");
    const viaForm = await saveEmployee(await form("ownerB", { status: "SUSPENDED" }));
    expect(viaForm).toMatchObject({ ok: false });
    expect(!viaForm.ok && viaForm.error).toMatch(/more access than you/);
    const viaButton = await deactivate({ membershipId: people.ownerB.membershipId, reason: "test" });
    expect(!viaButton.ok && viaButton.error).toMatch(/more access than you/);
    expect(await statusOf("ownerB")).toBe("ACTIVE");
  });

  it("refuses changing your own status", async () => {
    signIn("hr", "HR");
    const r = await saveEmployee(await form("hr", { status: "SUSPENDED" }));
    expect(!r.ok && r.error).toMatch(/your own status/);
    expect(await statusOf("hr")).toBe("ACTIVE");
  });

  it("lets an owner suspend a co-owner, and bring them back", async () => {
    signIn("ownerA", "OWNER");
    expect((await saveEmployee(await form("ownerB", { status: "SUSPENDED" }))).ok).toBe(true);
    expect(await statusOf("ownerB")).toBe("SUSPENDED");
    expect((await saveEmployee(await form("ownerB", { status: "ACTIVE" }))).ok).toBe(true);
    expect(await statusOf("ownerB")).toBe("ACTIVE");
  });

  it("makes the form's 'Has left' revoke a pending invitation, as the button does", async () => {
    signIn("ownerA", "OWNER");
    const r = await saveEmployee(await form("invited", { status: "DEACTIVATED" }));
    expect(r.ok).toBe(true);
    const invite = await getDb().employeeInvite.findFirstOrThrow({ where: { membershipId: people.invited.membershipId } });
    expect(invite.status).toBe("REVOKED");
  });

  it("refuses a reporting loop and a taken employee code, with a message", async () => {
    signIn("ownerA", "OWNER");
    const loop = await saveEmployee(await form("empA", { reportingToId: people.empB.membershipId }));
    expect(!loop.ok && loop.error).toMatch(/already reports to/);
    const code = await saveEmployee(await form("empB", { employeeCode: `GA-${stamp}` }));
    expect(!code.ok && code.error).toMatch(/is already/);
  });

  it("refuses editing your own access level or one above it", async () => {
    signIn("hr", "SUPER_ADMIN", ["employees.view"]);
    const own = await saveRole({ roleId: superAdminRoleId, permissions: [] });
    expect(!own.ok && own.error).toMatch(/yourself/);
    signIn("hr", "ADMIN", ["employees.view"]);
    const above = await saveRole({ roleId: superAdminRoleId, permissions: [] });
    expect(!above.ok && above.error).toMatch(/Only someone with more access/);
  });

  it("moves only permissions you hold; the rest stay exactly as they were", async () => {
    signIn("hr", "SUPER_ADMIN", ["employees.view"]);
    // Asks to grant payroll approval (not held) and clear everything else.
    const r = await saveRole({ roleId: adminRoleId, permissions: ["payroll.approve"] });
    const after = (
      await getDb().rolePermission.findMany({ where: { roleId: adminRoleId }, include: { permission: true } })
    )
      .map((rp) => rp.permission.key)
      .sort();
    const expected = adminRoleBefore.filter((k) => k !== "employees.view").sort();
    if (adminRoleBefore.includes("employees.view")) {
      expect(r.ok).toBe(true);
    } else {
      expect(!r.ok && r.error).toMatch(/Nothing you can change/);
    }
    expect(after).toEqual(expected);
    expect(after.includes("payroll.approve")).toBe(adminRoleBefore.includes("payroll.approve"));
  });
});
