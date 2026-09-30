/**
 * Task proof review, old task links and kudos (Hardening 7E) — the real
 * actions and the real page against the real database, in the placeholder
 * company (slug demo-co), with only the request-bound layers mocked (who is
 * signed in, audit writes, cache, notifications, points, the redirect).
 * Everything it creates is removed afterwards; no file is uploaded (proof
 * rows name paths only). Skips itself without a database.
 *
 * Proves what the pure rules can't: two reviewers pressing at once produce
 * one decision, one audit, one notification and at most one award; an
 * Admin is refused on their own proof while an Owner may review theirs —
 * and the Owner's own proof reaches the Owner's tiles while an Admin's
 * never reaches the Admin; a stored /admin/tasks/{id} link forwards to the
 * proof card or the task list; a Manager's kudos stay inside their team.
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
  decisions: [] as Array<{ userId: string; taskId: string; decision: string }>,
  submitted: [] as Array<{ userId: string; taskId: string }>,
  kudos: [] as Array<{ userId: string }>,
  awards: [] as Array<{ taskId: string }>,
}));
vi.mock("@/lib/audit", () => ({
  recordAuditEvent: vi.fn(async (_s: unknown, e: { action: string; entityId?: string }) => {
    spy.audit.push({ action: e.action, entityId: e.entityId });
  }),
}));
vi.mock("@/lib/notifications", () => ({
  notify: {
    proofSubmitted: vi.fn(async (_s: unknown, userId: string, _title: string, taskId: string) => {
      spy.submitted.push({ userId, taskId });
    }),
    proofDecision: vi.fn(
      async (_s: unknown, userId: string, _title: string, taskId: string, decision: string) => {
        spy.decisions.push({ userId, taskId, decision });
      },
    ),
    performanceMoment: vi.fn(async (_s: unknown, userId: string) => {
      spy.kudos.push({ userId });
    }),
  },
}));
// Points are their own module with their own tests; here only the call counts.
vi.mock(import("@/lib/performance/award"), async (original) => ({
  ...(await original()),
  awardForTaskCompletion: vi.fn(async (input: { taskId: string }) => {
    spy.awards.push({ taskId: input.taskId });
  }),
}));

const who = vi.hoisted(() => ({ session: null as null | Record<string, unknown> }));
vi.mock("@/lib/authz/guard", () => ({
  checkAccess: vi.fn(async () => ({ session: who.session, decision: { allowed: true } })),
  requireSession: vi.fn(async () => who.session),
}));

// redirect() ends a render by throwing; here it throws where it would go.
const nav = vi.hoisted(() => {
  class Redirect extends Error {
    url: string;
    constructor(url: string) {
      super(`redirect to ${url}`);
      this.url = url;
    }
  }
  return { Redirect };
});
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new nav.Redirect(url);
  }),
}));

describe.skipIf(!HAS_DB)("task proof, old task links and kudos (database)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let reviewProof: typeof import("@/lib/tasks/actions").reviewProofAction;
  let submitProof: typeof import("@/lib/tasks/actions").submitProofAction;
  let sendKudos: typeof import("@/lib/performance/kudos-actions").sendKudosAction;
  let reviewableProofWhere: typeof import("@/lib/tasks/review").reviewableProofWhere;
  let proofPath: typeof import("@/lib/storage/paths").proofPath;
  let proofReviewHref: typeof import("@/lib/tasks/links").proofReviewHref;
  let openTaskLink: (props: { params: Promise<{ taskId: string }> }) => Promise<unknown>;

  const ALREADY_DECIDED = "Already decided. Open the activity log to see who decided.";
  const OWN_PROOF = "You can't review your own proof. Another approver has to.";
  const OUTSIDE_TEAM = "That person isn't in your team.";

  const stamp = Date.now().toString(36);
  let tenant: { id: string; slug: string; name: string; timezone: string };
  const roleId: Record<string, string> = {};
  const people: Record<string, { membershipId: string; userId: string; roleKey: string }> = {};

  const signIn = (key: string) => {
    const p = people[key];
    who.session = {
      user: { id: p.userId, displayName: `Proof ${key}`, email: null, isPlatformAdmin: false },
      tenant: { ...tenant, plan: "INTERNAL", trialEndsAt: null, selfSignup: false, ownerEmailVerifiedAt: null, paidUntil: null },
      membership: { id: p.membershipId, roleKey: p.roleKey, roleName: p.roleKey, employeeCode: null },
      permissions: new Set(["tasks.view", "tasks.manage"]),
      source: "supabase",
    };
  };

  /** A task waiting on review with one pending proof, written directly. */
  const awaitingReview = async (assignee: string, creator: string) => {
    const db = getDb();
    const task = await db.task.create({
      data: {
        tenantId: tenant.id,
        createdById: people[creator].membershipId,
        assigneeId: people[assignee].membershipId,
        title: `zz-proof-test ${stamp}`,
        status: "SUBMITTED_FOR_REVIEW",
      },
    });
    await db.taskProof.create({
      data: { tenantId: tenant.id, taskId: task.id, submittedById: people[assignee].membershipId, note: "Test proof" },
    });
    return task.id;
  };
  const proofOf = (taskId: string) =>
    getDb().taskProof.findFirstOrThrow({ where: { taskId }, select: { decision: true, decidedById: true } });

  /** Where the old per-task link sends whoever is signed in. */
  const landing = async (taskId: string): Promise<string> => {
    try {
      await openTaskLink({ params: Promise.resolve({ taskId }) });
    } catch (error) {
      if (error instanceof nav.Redirect) return error.url;
      throw error;
    }
    throw new Error("The page rendered instead of forwarding.");
  };

  beforeAll(async () => {
    ({ getDb } = await import("@/lib/db"));
    ({ reviewProofAction: reviewProof, submitProofAction: submitProof } = await import("@/lib/tasks/actions"));
    ({ sendKudosAction: sendKudos } = await import("@/lib/performance/kudos-actions"));
    ({ reviewableProofWhere } = await import("@/lib/tasks/review"));
    ({ proofPath } = await import("@/lib/storage/paths"));
    ({ proofReviewHref } = await import("@/lib/tasks/links"));
    ({ default: openTaskLink } = await import("@/app/(admin)/admin/tasks/[taskId]/page"));
    const db = getDb();
    tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-co" } });
    for (const r of await db.role.findMany({ where: { tenantId: tenant.id } })) roleId[r.key] = r.id;

    const add = async (key: string, roleKey: string, reportingTo?: string) => {
      const user = await db.user.create({
        data: { displayName: `Proof ${key}`, email: `proof-${key}-${stamp}@example.test`, status: "ACTIVE" },
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
    await add("outsider", "EMPLOYEE");
  });

  afterAll(async () => {
    if (!tenant) return;
    const db = getDb();
    const ids = Object.values(people).map((p) => p.membershipId);
    const userIds = Object.values(people).map((p) => p.userId);
    // Tiles about these people, with their recipients (cascade).
    await db.actionRequest.deleteMany({ where: { tenantId: tenant.id, aboutMembershipId: { in: ids } } });
    const tasks = await db.task.findMany({
      where: { tenantId: tenant.id, OR: [{ assigneeId: { in: ids } }, { createdById: { in: ids } }] },
      select: { id: true },
    });
    // Proof files go with their proof (cascade).
    await db.taskProof.deleteMany({ where: { taskId: { in: tasks.map((t) => t.id) } } });
    await db.task.deleteMany({ where: { id: { in: tasks.map((t) => t.id) } } });
    await db.kudos.deleteMany({
      where: { tenantId: tenant.id, OR: [{ fromMembershipId: { in: ids } }, { toMembershipId: { in: ids } }] },
    });
    await db.notification.deleteMany({ where: { userId: { in: userIds } } });
    await db.tenantMembership.updateMany({ where: { id: { in: ids } }, data: { reportingToId: null } });
    await db.tenantMembership.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  });

  // ---- 7E.3: the first decision wins, and only it has consequences.

  it("gives two reviewers pressing at once exactly one decision, one audit, one notification", async () => {
    const taskId = await awaitingReview("report", "admin");
    spy.audit.length = 0;
    spy.decisions.length = 0;
    spy.awards.length = 0;

    signIn("admin");
    const first = reviewProof({ taskId, decision: "APPROVED" });
    signIn("mgr");
    const second = reviewProof({ taskId, decision: "REJECTED", reason: "Blurry photo" });
    const results = await Promise.all([first, second]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const loser = results.find((r) => !r.ok);
    expect(loser && !loser.ok && loser.error).toBe(ALREADY_DECIDED);

    expect(spy.audit.filter((a) => a.entityId === taskId && a.action.startsWith("task.proof_"))).toHaveLength(1);
    expect(spy.decisions.filter((d) => d.taskId === taskId)).toHaveLength(1);

    // The row, the task and the points all tell the winner's story.
    const proof = await proofOf(taskId);
    const task = await getDb().task.findUniqueOrThrow({ where: { id: taskId }, select: { status: true } });
    const approved = proof.decision === "APPROVED";
    expect(proof.decidedById).toBe(approved ? people.admin.membershipId : people.mgr.membershipId);
    expect(task.status).toBe(approved ? "COMPLETED" : "IN_PROGRESS");
    expect(spy.decisions[0].decision).toBe(proof.decision);
    expect(spy.awards.filter((a) => a.taskId === taskId)).toHaveLength(approved ? 1 : 0);

    // A later attempt is refused the same way, with nothing recorded.
    signIn("owner");
    const late = await reviewProof({ taskId, decision: "APPROVED" });
    expect(!late.ok && late.error).toBe(ALREADY_DECIDED);
    expect(spy.audit.filter((a) => a.entityId === taskId && a.action.startsWith("task.proof_"))).toHaveLength(1);
  });

  // ---- 7E.4: nobody reviews their own proof, except an Owner.

  it("refuses an Admin (and a Manager) on their own proof, and leaves it waiting", async () => {
    const adminsOwn = await awaitingReview("admin", "owner");
    signIn("admin");
    const refused = await reviewProof({ taskId: adminsOwn, decision: "APPROVED" });
    expect(!refused.ok && refused.error).toBe(OWN_PROOF);
    expect((await proofOf(adminsOwn)).decision).toBe("PENDING");

    const mgrsOwn = await awaitingReview("mgr", "mgr");
    signIn("mgr");
    const mgr = await reviewProof({ taskId: mgrsOwn, decision: "APPROVED" });
    expect(!mgr.ok && mgr.error).toBe(OWN_PROOF);

    // Someone else may review it: here the Owner.
    signIn("owner");
    expect((await reviewProof({ taskId: adminsOwn, decision: "APPROVED" })).ok).toBe(true);
  });

  it("lets an Owner review their own proof", async () => {
    const ownersOwn = await awaitingReview("owner", "admin");
    signIn("owner");
    const r = await reviewProof({ taskId: ownersOwn, decision: "APPROVED" });
    expect(r.ok).toBe(true);
    expect(await proofOf(ownersOwn)).toEqual({ decision: "APPROVED", decidedById: people.owner.membershipId });
  });

  it("keeps an Admin's own proof out of their queue, and an Owner's in theirs", async () => {
    const adminsOwn = await awaitingReview("admin", "owner");
    const ownersOwn = await awaitingReview("owner", "admin");
    const reports = await awaitingReview("report", "mgr");
    const queue = async (key: string) =>
      new Set(
        (
          await getDb().task.findMany({
            where: {
              tenantId: tenant.id,
              status: "SUBMITTED_FOR_REVIEW",
              id: { in: [adminsOwn, ownersOwn, reports] },
              ...reviewableProofWhere({ membershipId: people[key].membershipId, roleKey: people[key].roleKey }, "all"),
            },
            select: { id: true },
          })
        ).map((t) => t.id),
      );
    expect(await queue("admin")).toEqual(new Set([ownersOwn, reports]));
    expect(await queue("owner")).toEqual(new Set([adminsOwn, ownersOwn, reports]));
  });

  /** Send proof for `key`'s own task through the real action; the tile's recipients. */
  const submitOwnProof = async (key: string) => {
    const db = getDb();
    const task = await db.task.create({
      data: {
        tenantId: tenant.id,
        createdById: people[key].membershipId,
        assigneeId: people[key].membershipId,
        title: `zz-proof-test ${stamp}`,
        proofRequirement: "FILE",
        status: "IN_PROGRESS",
      },
    });
    signIn(key);
    const sent = await submitProof({
      taskId: task.id,
      files: [
        {
          path: proofPath(tenant.id, task.id, "zz-proof-test.pdf"),
          name: "zz-proof-test.pdf",
          mime: "application/pdf",
          sizeBytes: 1024,
        },
      ],
    });
    expect(sent.ok).toBe(true);
    const tile = await db.actionRequest.findFirst({
      where: { tenantId: tenant.id, subjectId: task.id },
      include: { recipients: true },
    });
    return { taskId: task.id, recipients: new Set(tile?.recipients.map((r) => r.userId) ?? []) };
  };

  it("sends an Owner's own proof to the Owner's tiles, and never an Admin's to the Admin", async () => {
    spy.submitted.length = 0;
    const owners = await submitOwnProof("owner");
    expect(owners.recipients.has(people.owner.userId)).toBe(true);

    const admins = await submitOwnProof("admin");
    expect(admins.recipients.has(people.admin.userId)).toBe(false);
    expect(admins.recipients.has(people.owner.userId)).toBe(true);

    // Nobody is belled about proof they sent on a task they set themselves.
    expect(spy.submitted.filter((s) => s.taskId === owners.taskId || s.taskId === admins.taskId)).toEqual([]);
  });

  // ---- 7E.2: links already stored for /admin/tasks/{id}.

  it("forwards an old task link to the proof card, or to the task list", async () => {
    const reports = await awaitingReview("report", "admin");
    const outsiders = await awaitingReview("outsider", "admin");

    signIn("mgr");
    expect(await landing(reports)).toBe(proofReviewHref(reports));
    expect(await landing(outsiders)).toBe("/admin/tasks");
    expect(await landing(crypto.randomUUID())).toBe("/admin/tasks");
    expect(await landing("not-a-task")).toBe("/admin/tasks");

    signIn("admin");
    expect(await landing(outsiders)).toBe(proofReviewHref(outsiders));
  });

  // ---- 7E.5: a Manager's kudos stay inside their team.

  it("refuses a Manager's kudos outside their team, and sends them within it", async () => {
    spy.kudos.length = 0;
    signIn("mgr");
    const outside = await sendKudos({ toMembershipId: people.outsider.membershipId, message: "Great work on the stock count." });
    expect(!outside.ok && outside.error).toBe(OUTSIDE_TEAM);

    const inside = await sendKudos({ toMembershipId: people.report.membershipId, message: "Great work on the stock count." });
    expect(inside.ok).toBe(true);
    expect(spy.kudos).toEqual([{ userId: people.report.userId }]);

    const self = await sendKudos({ toMembershipId: people.mgr.membershipId, message: "Great work, me." });
    expect(self.ok).toBe(false);

    // A company-wide role reaches anyone.
    signIn("admin");
    expect((await sendKudos({ toMembershipId: people.outsider.membershipId, message: "Thanks for covering." })).ok).toBe(true);

    const sent = await getDb().kudos.findMany({
      where: { tenantId: tenant.id, fromMembershipId: { in: [people.mgr.membershipId, people.admin.membershipId] } },
      select: { fromMembershipId: true, toMembershipId: true },
    });
    expect(sent).toHaveLength(2);
  });
});
