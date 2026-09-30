/**
 * Opening private files — the real actions, the real database and the
 * real storage buckets, in the placeholder company (slug demo-co), with
 * only the request-bound layers mocked (who is signed in, audit writes,
 * cache, notifications, tiles, points).
 *
 * Proves what the pure path rules can't: a document, a receipt and a
 * proof file uploaded where the uploaders put them really open — the link
 * is signed with the service-role key, fetches with HTTP 200 and serves the
 * same bytes — while a row whose path points at someone else's file (which
 * exists, so signing it WOULD work) is refused, and the saves refuse such
 * paths in the first place. Also: an employee opens their own document
 * without the download permission, and a missing service key gives the
 * friendly message rather than an error.
 *
 * Everything lives under ids this test creates (test people, test tasks,
 * a test claim) with "zz-hardening-test" in every file name, and every
 * object and row is removed afterwards. Signed links are never printed.
 * Skips itself without a database and the storage service key.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const HAS_DB = Boolean(process.env.DATABASE_URL);
const HAS_STORAGE = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
);
vi.setConfig({ testTimeout: 30_000, hookTimeout: 90_000 });

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(), cookies: vi.fn() }));

const audit = vi.hoisted(() => ({ events: [] as Array<{ action: string; entityId?: string }> }));
vi.mock("@/lib/audit", () => ({
  recordAuditEvent: vi.fn(async (_session: unknown, event: { action: string; entityId?: string }) => {
    audit.events.push({ action: event.action, entityId: event.entityId });
  }),
}));

// Guards against side effects if a refusal ever regressed into a success.
vi.mock("@/lib/notifications", () => ({
  notify: { proofSubmitted: vi.fn(async () => {}), expenseUpdate: vi.fn(async () => {}) },
}));
vi.mock("@/lib/actions/raise", () => ({
  raiseTaskProof: vi.fn(async () => {}),
  clearActionRequest: vi.fn(async () => {}),
  SUBJECT: { taskProof: "taskProof" },
}));
vi.mock("@/lib/actions/service", () => ({
  raiseActionRequest: vi.fn(async () => {}),
  resolveActionRequest: vi.fn(async () => {}),
}));
vi.mock("@/lib/performance/award", () => ({
  awardForTaskCompletion: vi.fn(async () => {}),
  awardForOnboarding: vi.fn(async () => {}),
}));

// The real service-role client, with a switch to play "key not configured".
const storageSwitch = vi.hoisted(() => ({ off: false }));
vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/supabase/admin")>();
  return { ...real, getSupabaseAdmin: () => (storageSwitch.off ? null : real.getSupabaseAdmin()) };
});

const who = vi.hoisted(() => ({ session: null as null | Record<string, unknown> }));
vi.mock("@/lib/authz/guard", () => ({
  checkAccess: vi.fn(async () => ({ session: who.session, decision: { allowed: true } })),
}));

const DOCS = "employee-documents";
const RECEIPTS = "expense-receipts";
const PROOF = "task-proof";

describe.skipIf(!HAS_DB || !HAS_STORAGE)("opening private files (database + storage)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let admin: NonNullable<ReturnType<typeof import("@/lib/supabase/admin").getSupabaseAdmin>>;
  let paths: typeof import("@/lib/storage/paths");
  let saveDocument: typeof import("@/lib/employees/documents").saveDocumentAction;
  let documentUrl: typeof import("@/lib/employees/documents").getDocumentUrl;
  let receiptUrl: typeof import("@/lib/expenses/actions").getReceiptUrlAction;
  let proofUrl: typeof import("@/lib/tasks/proof-access").getProofFileUrl;
  let submitProof: typeof import("@/lib/tasks/actions").submitProofAction;

  const stamp = Date.now().toString(36);
  const NOW = Date.now();
  const draft = crypto.randomUUID();
  let tenant: { id: string; slug: string; name: string; timezone: string };
  const people: Record<string, { membershipId: string; userId: string }> = {};
  const uploaded: Record<string, string[]> = { [DOCS]: [], [RECEIPTS]: [], [PROOF]: [] };
  const taskIds: string[] = [];
  let claimId = "";
  const ids = { goodDoc: "", strayDoc: "", goodReceipt: "", strayReceipt: "", goodProof: "", strayProof: "" };
  /** Real objects in someone else's folder, pointed at by the stray rows. */
  const strayPaths = { doc: "", receipt: "", proof: "" };
  const bytes = {
    doc: Buffer.from(`%PDF-1.4\n% zz-hardening-test document ${stamp}\n`),
    receipt: Buffer.from(`%PDF-1.4\n% zz-hardening-test receipt ${stamp}\n`),
    proof: Buffer.from(`%PDF-1.4\n% zz-hardening-test proof ${stamp}\n`),
    other: Buffer.from(`%PDF-1.4\n% zz-hardening-test someone else ${stamp}\n`),
  };
  const FILE = "zz-hardening-test.pdf";

  const signIn = (key: string, roleKey: string, permissions: string[] = []) => {
    audit.events.length = 0;
    who.session = {
      user: { id: people[key].userId, displayName: key, email: null, isPlatformAdmin: false },
      tenant: { ...tenant, plan: "INTERNAL", trialEndsAt: null, selfSignup: false, ownerEmailVerifiedAt: null, paidUntil: null },
      membership: { id: people[key].membershipId, roleKey, roleName: roleKey, employeeCode: null },
      permissions: new Set(permissions),
      source: "supabase",
    };
  };

  const put = async (bucket: string, path: string, body: Buffer) => {
    const { error } = await admin.storage
      .from(bucket)
      .upload(path, body, { contentType: "application/pdf", upsert: false });
    if (error) throw new Error(`test upload to ${bucket} failed: ${error.message}`);
    uploaded[bucket].push(path);
  };

  /** The refusal is the path rule's doing: the object itself is signable. */
  const signableDirectly = async (bucket: string, path: string) => {
    const { data } = await admin.storage.from(bucket).createSignedUrl(path, 30);
    return Boolean(data?.signedUrl);
  };

  /** Fetch a signed link and compare bytes, without ever printing the link. */
  const opens = async (result: { ok: true; url: string } | { ok: false; error: string }, expected: Buffer) => {
    expect(result.ok, result.ok ? "" : result.error).toBe(true);
    if (!result.ok) return;
    expect(new URL(result.url).pathname.includes("/storage/v1/object/sign/")).toBe(true);
    const response = await fetch(result.url);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).equals(expected)).toBe(true);
  };

  beforeAll(async () => {
    ({ getDb } = await import("@/lib/db"));
    paths = await import("@/lib/storage/paths");
    ({ saveDocumentAction: saveDocument, getDocumentUrl: documentUrl } = await import("@/lib/employees/documents"));
    ({ getReceiptUrlAction: receiptUrl } = await import("@/lib/expenses/actions"));
    ({ getProofFileUrl: proofUrl } = await import("@/lib/tasks/proof-access"));
    ({ submitProofAction: submitProof } = await import("@/lib/tasks/actions"));
    const client = (await import("@/lib/supabase/admin")).getSupabaseAdmin();
    if (!client) throw new Error("storage service key not configured");
    admin = client;

    const db = getDb();
    tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-co" } });
    const roleId: Record<string, string> = {};
    for (const r of await db.role.findMany({ where: { tenantId: tenant.id } })) roleId[r.key] = r.id;

    const add = async (key: string, roleKey: string) => {
      const user = await db.user.create({
        data: { displayName: `Files ${key}`, email: `files-${key}-${stamp}@example.test`, status: "ACTIVE" },
      });
      const m = await db.tenantMembership.create({
        data: { tenantId: tenant.id, userId: user.id, roleId: roleId[roleKey], status: "ACTIVE" },
      });
      people[key] = { membershipId: m.id, userId: user.id };
    };
    await add("owner", "EMPLOYEE");
    await add("colleague", "EMPLOYEE");
    await add("hr", "HR");
    const owner = people.owner.membershipId;
    const colleague = people.colleague.membershipId;

    // Documents: the owner's file, and the colleague's (which exists, so
    // signing it for the owner would work if the path were not checked).
    const ownDocPath = paths.documentPath(tenant.id, owner, FILE, NOW);
    const colleagueDocPath = paths.documentPath(tenant.id, colleague, FILE, NOW);
    await put(DOCS, ownDocPath, bytes.doc);
    await put(DOCS, colleagueDocPath, bytes.other);
    const stray = await db.employeeDocument.create({
      data: {
        tenantId: tenant.id, membershipId: owner, kind: "zz-hardening-test", name: FILE,
        path: colleagueDocPath, mime: "application/pdf", sizeBytes: bytes.other.length,
      },
    });
    ids.strayDoc = stray.id;
    strayPaths.doc = colleagueDocPath;

    // Receipts: a claim by the owner with their receipt, and one row that
    // points into the colleague's folder.
    const ownReceiptPath = paths.receiptPath(tenant.id, owner, draft, FILE, NOW);
    const colleagueReceiptPath = paths.receiptPath(tenant.id, colleague, draft, FILE, NOW);
    await put(RECEIPTS, ownReceiptPath, bytes.receipt);
    await put(RECEIPTS, colleagueReceiptPath, bytes.other);
    const claim = await db.expenseClaim.create({
      data: {
        tenantId: tenant.id, membershipId: owner,
        claimNumber: 2_000_000_000 + Math.floor(Math.random() * 100_000_000),
        status: "DRAFT", categoryKey: "zz-hardening-test", categoryName: "zz-hardening-test",
        receiptRequiredAtSubmission: false, claimedAmount: 1, expenseDate: new Date(),
        description: "zz-hardening-test",
      },
    });
    claimId = claim.id;
    const receiptRow = (path: string, size: number) =>
      db.expenseReceipt.create({
        data: { tenantId: tenant.id, claimId, path, name: FILE, mime: "application/pdf", sizeBytes: size, uploadedById: people.owner.userId },
      });
    ids.goodReceipt = (await receiptRow(ownReceiptPath, bytes.receipt.length)).id;
    ids.strayReceipt = (await receiptRow(colleagueReceiptPath, bytes.other.length)).id;
    strayPaths.receipt = colleagueReceiptPath;

    // Proof: the owner's task with its proof, and another task's file.
    const task = (assigneeId: string) =>
      db.task.create({
        data: {
          tenantId: tenant.id, createdById: people.hr.membershipId, assigneeId,
          title: `zz-hardening-test ${stamp}`, proofRequirement: "FILE", status: "IN_PROGRESS",
        },
      });
    const ownTask = await task(owner);
    const otherTask = await task(colleague);
    taskIds.push(ownTask.id, otherTask.id);
    const ownProofPath = paths.proofPath(tenant.id, ownTask.id, FILE, NOW);
    const otherProofPath = paths.proofPath(tenant.id, otherTask.id, FILE, NOW);
    await put(PROOF, ownProofPath, bytes.proof);
    await put(PROOF, otherProofPath, bytes.other);
    const proof = await db.taskProof.create({
      data: {
        tenantId: tenant.id, taskId: ownTask.id, submittedById: owner,
        files: {
          create: [
            { tenantId: tenant.id, path: ownProofPath, name: FILE, mime: "application/pdf", sizeBytes: bytes.proof.length },
            { tenantId: tenant.id, path: otherProofPath, name: "zz-other.pdf", mime: "application/pdf", sizeBytes: bytes.other.length },
          ],
        },
      },
      include: { files: true },
    });
    ids.goodProof = proof.files.find((f) => f.path === ownProofPath)!.id;
    ids.strayProof = proof.files.find((f) => f.path === otherProofPath)!.id;
    strayPaths.proof = otherProofPath;
  });

  afterAll(async () => {
    storageSwitch.off = false;
    if (admin) {
      for (const [bucket, list] of Object.entries(uploaded)) {
        if (list.length) await admin.storage.from(bucket).remove(list);
      }
    }
    if (!tenant) return;
    const db = getDb();
    const members = Object.values(people).map((p) => p.membershipId);
    if (taskIds.length) {
      const proofs = await db.taskProof.findMany({ where: { taskId: { in: taskIds } }, select: { id: true } });
      await db.proofFile.deleteMany({ where: { proofId: { in: proofs.map((p) => p.id) } } });
      await db.taskProof.deleteMany({ where: { taskId: { in: taskIds } } });
      await db.task.deleteMany({ where: { id: { in: taskIds } } });
    }
    if (claimId) {
      await db.expenseReceipt.deleteMany({ where: { claimId } });
      await db.expenseClaim.deleteMany({ where: { id: claimId } });
    }
    await db.employeeDocument.deleteMany({ where: { membershipId: { in: members } } });
    await db.tenantMembership.deleteMany({ where: { id: { in: members } } });
    await db.user.deleteMany({ where: { id: { in: Object.values(people).map((p) => p.userId) } } });
  });

  // ------------------------------------------------------------ documents

  it("refuses to record a document path outside this company's folder for that person", async () => {
    signIn("owner", "EMPLOYEE");
    const owner = people.owner.membershipId;
    const colleague = people.colleague.membershipId;
    const save = (path: string, membershipId?: string) =>
      saveDocument({ membershipId, kind: "zz-hardening-test", name: FILE, path, mime: "application/pdf", sizeBytes: 10 });

    const refused = [
      paths.documentPath(tenant.id, colleague, FILE, NOW), // another person
      paths.documentPath(crypto.randomUUID(), owner, FILE, NOW), // another company
      `${owner}/${NOW}-${FILE}`, // the old layout, no company folder
      `${tenant.id}/${owner}/../${colleague}/${NOW}-${FILE}`, // traversal
      `/${tenant.id}/${owner}/${NOW}-${FILE}`, // absolute
      `${tenant.id}\\${owner}\\${NOW}-${FILE}`, // backslashes
    ];
    for (const path of refused) {
      const result = await save(path);
      expect(result.ok, path).toBe(false);
      expect(!result.ok && result.error).toMatch(/could not be read/);
    }

    // HR adding for someone else must still use that person's folder.
    signIn("hr", "HR", ["employees.manage"]);
    const wrongFolder = await save(paths.documentPath(tenant.id, owner, FILE, NOW), colleague);
    expect(wrongFolder.ok).toBe(false);

    // Nothing was recorded: only the fixture's row exists for these two.
    expect(await getDb().employeeDocument.count({ where: { membershipId: { in: [owner, colleague] } } })).toBe(1);
  });

  it("lets an employee open their own document without the download permission, and audits it", async () => {
    signIn("owner", "EMPLOYEE");
    const path = paths.documentPath(tenant.id, people.owner.membershipId, FILE, NOW);
    const saved = await saveDocument({ kind: "zz-hardening-test", name: FILE, path, mime: "application/pdf", sizeBytes: bytes.doc.length });
    expect(saved.ok).toBe(true);
    const row = await getDb().employeeDocument.findFirstOrThrow({ where: { membershipId: people.owner.membershipId, path } });
    ids.goodDoc = row.id;

    signIn("owner", "EMPLOYEE");
    await opens(await documentUrl(ids.goodDoc), bytes.doc);
    expect(audit.events).toContainEqual({ action: "document.viewed", entityId: ids.goodDoc });
  });

  it("keeps a colleague out, and lets HR with the download permission in", async () => {
    signIn("colleague", "EMPLOYEE");
    const refused = await documentUrl(ids.goodDoc);
    expect(refused.ok).toBe(false);
    expect(audit.events).toHaveLength(0);

    signIn("hr", "HR", ["documents.view", "documents.download"]);
    await opens(await documentUrl(ids.goodDoc), bytes.doc);
  });

  it("never signs a stored document path outside its owner's folder, even for HR", async () => {
    expect(await signableDirectly(DOCS, strayPaths.doc)).toBe(true);
    signIn("hr", "HR", ["documents.view", "documents.download"]);
    const result = await documentUrl(ids.strayDoc);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/can't be opened/);
    expect(audit.events).toHaveLength(0);

    signIn("owner", "EMPLOYEE");
    expect((await documentUrl(ids.strayDoc)).ok).toBe(false);
  });

  // ------------------------------------------------------------- receipts

  it("opens the claimant's receipt for them and for an expenses viewer, audited", async () => {
    signIn("owner", "EMPLOYEE");
    await opens(await receiptUrl(ids.goodReceipt), bytes.receipt);
    expect(audit.events).toContainEqual({ action: "expense.receipt_viewed", entityId: ids.goodReceipt });

    signIn("colleague", "EMPLOYEE");
    expect((await receiptUrl(ids.goodReceipt)).ok).toBe(false);

    signIn("hr", "HR", ["expenses.view"]);
    await opens(await receiptUrl(ids.goodReceipt), bytes.receipt);
  });

  it("never signs a stored receipt path outside the claimant's folder", async () => {
    expect(await signableDirectly(RECEIPTS, strayPaths.receipt)).toBe(true);
    signIn("hr", "HR", ["expenses.view", "expenses.approve"]);
    const result = await receiptUrl(ids.strayReceipt);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/can’t be opened/);
    expect(audit.events).toHaveLength(0);
  });

  // ---------------------------------------------------------------- proof

  it("refuses to record proof outside this company's folder for this task", async () => {
    signIn("owner", "EMPLOYEE");
    const [ownTask, otherTask] = taskIds;
    const refused = [
      paths.proofPath(tenant.id, otherTask, FILE, NOW), // another task
      paths.proofPath(crypto.randomUUID(), ownTask, FILE, NOW), // another company
      `${ownTask}/${NOW}-${FILE}`, // the old layout, no company folder
      `${tenant.id}/${ownTask}/../${otherTask}/${NOW}-${FILE}`, // traversal
    ];
    for (const path of refused) {
      const result = await submitProof({
        taskId: ownTask,
        files: [{ path, name: FILE, mime: "application/pdf", sizeBytes: 10 }],
      });
      expect(result.ok, path).toBe(false);
      expect(!result.ok && result.error).toMatch(/could not be read/);
    }
    expect(await getDb().taskProof.count({ where: { taskId: ownTask } })).toBe(1); // only the fixture's
  });

  it("opens proof for the assignee and for a task manager who can see them, audited", async () => {
    signIn("owner", "EMPLOYEE");
    await opens(await proofUrl(ids.goodProof), bytes.proof);
    expect(audit.events).toContainEqual({ action: "task.proof_file_viewed", entityId: ids.goodProof });

    signIn("colleague", "EMPLOYEE");
    expect((await proofUrl(ids.goodProof)).ok).toBe(false);

    // A company-wide task manager may open it…
    signIn("colleague", "ADMIN", ["tasks.manage"]);
    await opens(await proofUrl(ids.goodProof), bytes.proof);

    // …but a Manager only for people in their team (Hardening batch 6):
    // the assignee doesn't report to this one.
    signIn("colleague", "MANAGER", ["tasks.manage"]);
    const outside = await proofUrl(ids.goodProof);
    expect(!outside.ok && outside.error).toMatch(/isn't in your team/);
  });

  it("never signs a stored proof path outside its task's folder", async () => {
    expect(await signableDirectly(PROOF, strayPaths.proof)).toBe(true);
    signIn("owner", "EMPLOYEE", ["tasks.manage"]);
    const result = await proofUrl(ids.strayProof);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/can't be opened/);
    expect(audit.events).toHaveLength(0);
  });

  // --------------------------------------------------------- no service key

  it("says storage isn't configured when the service key is missing", async () => {
    storageSwitch.off = true;
    try {
      signIn("owner", "EMPLOYEE");
      for (const result of [
        await documentUrl(ids.goodDoc),
        await receiptUrl(ids.goodReceipt),
        await proofUrl(ids.goodProof),
      ]) {
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error).toMatch(/File storage isn.t configured yet/);
      }
      expect(audit.events).toHaveLength(0);
    } finally {
      storageSwitch.off = false;
    }
  });
});
