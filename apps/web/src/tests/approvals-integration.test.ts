/**
 * Who may decide a leave request or an attendance exception — the real
 * actions against the real database, in the placeholder company (slug
 * demo-co), with only the request-bound layers mocked (who is signed in,
 * audit writes, cache, notifications, points). Everything it creates is
 * removed afterwards. Skips itself without a database.
 *
 * Proves what the pure rules can't: the refusals are wired to the right
 * columns, two approvers pressing at once produce exactly one decision
 * (and one notification), a question keeps a request decidable, and an
 * Owner's own request reaches the Owner's tiles while nobody else's does.
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
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => null, ADMIN_KEY_MISSING: "no key" }));

const spy = vi.hoisted(() => ({
  audit: [] as Array<{ action: string; entityId?: string }>,
  told: [] as Array<{ userId: string; decision: string }>,
}));
vi.mock("@/lib/audit", () => ({
  recordAuditEvent: vi.fn(async (_s: unknown, e: { action: string; entityId?: string }) => {
    spy.audit.push({ action: e.action, entityId: e.entityId });
  }),
}));
vi.mock("@/lib/notifications", () => ({
  notify: {
    leaveRequested: vi.fn(),
    attendanceException: vi.fn(),
    leaveDecision: vi.fn(async (_s: unknown, userId: string, decision: string) => {
      spy.told.push({ userId, decision });
    }),
    attendanceDecision: vi.fn(async (_s: unknown, userId: string, decision: string) => {
      spy.told.push({ userId, decision });
    }),
  },
  unreadNotificationCount: vi.fn(async () => 0),
}));
// Points are their own module with their own tests; here they only add rows.
vi.mock(import("@/lib/performance/award"), async (original) => ({
  ...(await original()),
  awardForLeaveApproval: vi.fn(),
  awardForCheckIn: vi.fn(),
  awardForCheckOut: vi.fn(),
}));

const who = vi.hoisted(() => ({
  session: null as null | Record<string, unknown>,
}));
vi.mock("@/lib/authz/guard", () => ({
  checkAccess: vi.fn(async () => ({ session: who.session, decision: { allowed: true } })),
  requireSession: vi.fn(async () => who.session),
}));

describe.skipIf(!HAS_DB)("who may decide leave and attendance (database)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let decideLeave: typeof import("@/lib/leave/actions").decideLeaveAction;
  let requestLeave: typeof import("@/lib/leave/actions").requestLeaveAction;
  let reviewAttendance: typeof import("@/lib/attendance/actions").reviewAttendanceAction;

  const stamp = Date.now().toString(36);
  let tenant: { id: string; slug: string; name: string; timezone: string };
  const roleId: Record<string, string> = {};
  const people: Record<string, { membershipId: string; userId: string; roleKey: string }> = {};

  const APPROVER = ["leave.approve", "leave.view", "attendance.review", "attendance.view"];

  const signIn = (key: string) => {
    const p = people[key];
    who.session = {
      user: { id: p.userId, displayName: `Approvals ${key}`, email: null, isPlatformAdmin: false },
      tenant: { ...tenant, plan: "INTERNAL", trialEndsAt: null, selfSignup: false, ownerEmailVerifiedAt: null, paidUntil: null },
      membership: { id: p.membershipId, roleKey: p.roleKey, roleName: p.roleKey, employeeCode: null },
      permissions: new Set(APPROVER),
      source: "supabase",
    };
  };

  /** A pending leave request, written directly so no tile or bell fires. */
  let day = 0;
  const leaveFor = async (key: string, status: "PENDING" | "DETAILS_REQUESTED" = "PENDING") => {
    day += 1;
    const date = new Date(Date.UTC(2031, 0, day));
    const r = await getDb().leaveRequest.create({
      data: {
        tenantId: tenant.id,
        membershipId: people[key].membershipId,
        type: "FULL_DAY",
        startDate: date,
        endDate: date,
        reason: "Approvals test",
        unpaidDays: 1,
        status,
      },
    });
    return r.id;
  };
  const exceptionFor = async (key: string) => {
    day += 1;
    const r = await getDb().attendanceRecord.create({
      data: {
        tenantId: tenant.id,
        membershipId: people[key].membershipId,
        workDate: new Date(Date.UTC(2031, 0, day)),
        checkInAt: new Date(Date.UTC(2031, 0, day, 4)),
        checkInOutcome: "OUTSIDE",
        reviewStatus: "PENDING",
      },
    });
    return r.id;
  };
  const leaveStatus = async (id: string) =>
    getDb().leaveRequest.findUniqueOrThrow({ where: { id }, select: { status: true, decisionReason: true } });

  beforeAll(async () => {
    ({ getDb } = await import("@/lib/db"));
    ({ decideLeaveAction: decideLeave, requestLeaveAction: requestLeave } = await import("@/lib/leave/actions"));
    ({ reviewAttendanceAction: reviewAttendance } = await import("@/lib/attendance/actions"));
    const db = getDb();
    tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-co" } });
    for (const r of await db.role.findMany({ where: { tenantId: tenant.id } })) roleId[r.key] = r.id;

    const add = async (key: string, roleKey: string, reportingTo?: string) => {
      const user = await db.user.create({
        data: { displayName: `Approvals ${key}`, email: `approvals-${key}-${stamp}@example.test`, status: "ACTIVE" },
      });
      const m = await db.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: roleId[roleKey],
          status: "ACTIVE",
          reportingToId: reportingTo ? people[reportingTo].membershipId : null,
        },
      });
      people[key] = { membershipId: m.id, userId: user.id, roleKey };
    };
    await add("owner", "OWNER");
    await add("admin", "ADMIN");
    await add("mgr", "MANAGER");
    await add("report", "EMPLOYEE", "mgr");
  });

  afterAll(async () => {
    if (!tenant) return;
    const db = getDb();
    const ids = Object.values(people).map((p) => p.membershipId);
    const records = await db.attendanceRecord.findMany({ where: { membershipId: { in: ids } }, select: { id: true } });
    await db.actionRequest.deleteMany({ where: { tenantId: tenant.id, aboutMembershipId: { in: ids } } });
    await db.attendancePunch.deleteMany({ where: { recordId: { in: records.map((r) => r.id) } } });
    await db.attendanceRecord.deleteMany({ where: { membershipId: { in: ids } } });
    await db.leaveRequest.deleteMany({ where: { membershipId: { in: ids } } });
    await db.notification.deleteMany({ where: { userId: { in: Object.values(people).map((p) => p.userId) } } });
    await db.tenantMembership.updateMany({ where: { id: { in: ids } }, data: { reportingToId: null } });
    await db.tenantMembership.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: Object.values(people).map((p) => p.userId) } } });
  });

  it("refuses a Manager approving their own leave, and leaves it waiting", async () => {
    const id = await leaveFor("mgr");
    signIn("mgr");
    const r = await decideLeave({ requestId: id, decision: "APPROVED", paid: true });
    expect(!r.ok && r.error).toBe("You can't decide your own leave. Another approver has to.");
    expect((await leaveStatus(id)).status).toBe("PENDING");
  });

  it("lets an Owner approve their own leave", async () => {
    const id = await leaveFor("owner");
    signIn("owner");
    const r = await decideLeave({ requestId: id, decision: "APPROVED", paid: true });
    expect(r.ok).toBe(true);
    expect((await leaveStatus(id)).status).toBe("APPROVED");
  });

  it("lets a Manager approve their direct report's leave", async () => {
    const id = await leaveFor("report");
    signIn("mgr");
    const r = await decideLeave({ requestId: id, decision: "APPROVED", paid: false });
    expect(r.ok).toBe(true);
    expect((await leaveStatus(id)).status).toBe("APPROVED");
  });

  it("gives two approvers pressing at once exactly one decision, one audit and one notification", async () => {
    const id = await leaveFor("report");
    spy.audit.length = 0;
    spy.told.length = 0;
    signIn("admin");
    const first = decideLeave({ requestId: id, decision: "APPROVED", paid: true });
    signIn("mgr");
    const second = decideLeave({ requestId: id, decision: "REJECTED", reason: "Busy week" });
    const results = await Promise.all([first, second]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const loser = results.find((r) => !r.ok);
    expect(loser && !loser.ok && loser.error).toBe("Already decided. Open the activity log to see who decided.");
    expect(spy.audit.filter((a) => a.entityId === id)).toHaveLength(1);
    expect(spy.told.filter((t) => t.userId === people.report.userId)).toHaveLength(1);

    // And a later attempt on the decided request is refused the same way.
    signIn("owner");
    const late = await decideLeave({ requestId: id, decision: "APPROVED", paid: true });
    expect(!late.ok && late.error).toMatch(/^Already decided/);
  });

  it("keeps a request decidable after asking for details, and clears the question on approval", async () => {
    const id = await leaveFor("report");
    signIn("admin");
    const noQuestion = await decideLeave({ requestId: id, decision: "DETAILS_REQUESTED" });
    expect(noQuestion.ok).toBe(false);
    const asked = await decideLeave({ requestId: id, decision: "DETAILS_REQUESTED", reason: "Which city?" });
    expect(asked.ok).toBe(true);
    expect(await leaveStatus(id)).toEqual({ status: "DETAILS_REQUESTED", decisionReason: "Which city?" });
    expect(spy.told.some((t) => t.userId === people.report.userId && t.decision === "DETAILS_REQUESTED")).toBe(true);

    const approved = await decideLeave({ requestId: id, decision: "APPROVED", paid: true });
    expect(approved.ok).toBe(true);
    expect(await leaveStatus(id)).toEqual({ status: "APPROVED", decisionReason: null });
  });

  it("applies the same rules to attendance exceptions", async () => {
    const own = await exceptionFor("mgr");
    signIn("mgr");
    const refused = await reviewAttendance({ recordId: own, decision: "APPROVED" });
    expect(!refused.ok && refused.error).toBe("You can't review your own attendance. Another approver has to.");

    const ownerOwn = await exceptionFor("owner");
    signIn("owner");
    expect((await reviewAttendance({ recordId: ownerOwn, decision: "APPROVED" })).ok).toBe(true);

    const reports = await exceptionFor("report");
    signIn("admin");
    expect((await reviewAttendance({ recordId: reports, decision: "DETAILS_REQUESTED", reason: "Where were you?" })).ok).toBe(true);
    signIn("mgr");
    expect((await reviewAttendance({ recordId: reports, decision: "APPROVED" })).ok).toBe(true);
    signIn("admin");
    const again = await reviewAttendance({ recordId: reports, decision: "REJECTED", reason: "No" });
    expect(!again.ok && again.error).toMatch(/^Already decided/);
    const row = await getDb().attendanceRecord.findUniqueOrThrow({ where: { id: reports } });
    expect(row.reviewStatus).toBe("APPROVED");
    expect(row.reviewReason).toBeNull();
  });

  it("sends an Owner's own leave to the Owner's tiles, and nobody else's to themselves", async () => {
    const db = getDb();
    const recipientsOf = async (key: string) => {
      const request = await db.leaveRequest.findFirstOrThrow({
        where: { membershipId: people[key].membershipId, reason: `Tile ${stamp}` },
      });
      const tile = await db.actionRequest.findFirst({
        where: { tenantId: tenant.id, subjectId: request.id },
        include: { recipients: true },
      });
      return new Set(tile?.recipients.map((r) => r.userId) ?? []);
    };

    signIn("owner");
    expect((await requestLeave({ type: "FULL_DAY", startDate: "2032-03-01", endDate: "2032-03-01", reason: `Tile ${stamp}` })).ok).toBe(true);
    expect((await recipientsOf("owner")).has(people.owner.userId)).toBe(true);

    signIn("admin");
    expect((await requestLeave({ type: "FULL_DAY", startDate: "2032-03-02", endDate: "2032-03-02", reason: `Tile ${stamp}` })).ok).toBe(true);
    const adminTile = await recipientsOf("admin");
    expect(adminTile.has(people.admin.userId)).toBe(false);
    expect(adminTile.has(people.owner.userId)).toBe(true);
  });
});
