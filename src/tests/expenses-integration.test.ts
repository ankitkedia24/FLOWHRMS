/**
 * Expenses E1 — integration against the real database (the sample
 * tenant), with only the request-bound layers mocked: session resolution,
 * cache revalidation, notifications, and the tile queue (captured for
 * assertion rather than written).
 *
 * What this proves that the pure tests cannot: the row lock serialises a
 * withdrawal racing an approval, the counter hands out one number per
 * claim, transitions and audit events land in the same transaction, and
 * the settlement record is what makes SETTLED true.
 *
 * Leaves the sample tenant with Expenses enabled and a published policy —
 * the fixture the browser check uses. Skips itself without a database.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const HAS_DB = Boolean(process.env.DATABASE_URL);

// Other database suites (rewards, payroll settlement) share the sample
// tenant and run in parallel workers; give real round trips room.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/notifications", () => ({
  notify: { expenseUpdate: vi.fn(async () => {}) },
}));

const raised: Array<{ kind: string; subjectId: string }> = [];
const resolved: Array<{ subjectId: string; resolution?: string }> = [];
vi.mock("@/lib/actions/service", () => ({
  raiseActionRequest: vi.fn(async (input: { kind: string; subjectId: string }) => {
    raised.push({ kind: input.kind, subjectId: input.subjectId });
  }),
  resolveActionRequest: vi.fn(async (input: { subjectId: string; resolution?: string }) => {
    resolved.push({ subjectId: input.subjectId, resolution: input.resolution });
  }),
}));

// The session under test — swapped per step by the tests.
import type { AppSession } from "@/lib/auth/types";
let current: AppSession;
vi.mock("@/lib/authz/guard", () => ({
  checkAccess: vi.fn(async () => ({ session: current, decision: { allowed: true } })),
}));

import { getDb } from "@/lib/db";
import { getPolicy, setPolicy } from "@/lib/policies";
import { DEFAULT_EXPENSES_POLICY } from "@/lib/expenses/policy";
import {
  decideClaimAction,
  settleClaimAction,
  submitClaimAction,
  withdrawClaimAction,
} from "@/lib/expenses/actions";
import { transitionClaim } from "@/lib/expenses/transition";

const d = describe.skipIf(!HAS_DB);

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

d("expenses flow (integration, sample tenant)", () => {
  const db = HAS_DB ? getDb() : (null as never);
  let tenantId = "";
  let employee: AppSession;
  let approver: AppSession;
  const claimIds: string[] = [];

  async function submitAs(
    who: AppSession,
    input: Partial<Parameters<typeof submitClaimAction>[0]> = {},
  ) {
    current = who;
    const result = await submitClaimAction({
      categoryKey: "local-travel",
      amount: 250,
      expenseDate: isoDaysAgo(1),
      description: "Auto to the customer site",
      receipts: [],
      ...input,
    });
    if (result.ok && result.claimId) claimIds.push(result.claimId);
    return result;
  }

  async function claim(id: string) {
    return db.expenseClaim.findUniqueOrThrow({
      where: { id },
      include: { transitions: true, receipts: true, settlement: true },
    });
  }

  async function audit(entityId: string, action: string) {
    return db.auditEvent.findFirst({ where: { tenantId, entityId, action } });
  }

  beforeAll(async () => {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "sunrise-traders-sample" } });
    tenantId = tenant.id;

    // Fixture: the module on, and rules published — left in place afterwards.
    const mod = await db.module.findUniqueOrThrow({ where: { key: "EXPENSES" } });
    await db.tenantModuleSetting.upsert({
      where: { tenantId_moduleId: { tenantId, moduleId: mod.id } },
      update: { enabled: true },
      create: { tenantId, moduleId: mod.id, enabled: true },
    });

    const roles = ["OWNER", "SUPER_ADMIN", "ADMIN", "HR"];
    const [emp, appr] = await Promise.all([
      db.tenantMembership.findFirstOrThrow({
        where: { tenantId, status: "ACTIVE", role: { key: "EMPLOYEE" } },
        include: { user: true, role: true },
        orderBy: { createdAt: "asc" },
      }),
      db.tenantMembership.findFirstOrThrow({
        where: { tenantId, status: "ACTIVE", role: { key: { in: roles } } },
        include: { user: true, role: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    if (!(await getPolicy(tenantId, "expenses"))) {
      await setPolicy(tenantId, "expenses", DEFAULT_EXPENSES_POLICY, appr.userId);
    }

    const session = (m: typeof emp, perms: string[]): AppSession => ({
      user: { id: m.user.id, displayName: m.user.displayName, email: null, isPlatformAdmin: false },
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, timezone: tenant.timezone, plan: "INTERNAL", trialEndsAt: null, selfSignup: false, ownerEmailVerifiedAt: null },
      membership: { id: m.id, roleKey: m.role.key, roleName: m.role.name, employeeCode: null },
      permissions: new Set(perms) as AppSession["permissions"],
      source: "supabase",
    });
    employee = session(emp, []);
    approver = session(appr, ["admin.access", "expenses.approve", "expenses.view"]);
  });

  afterAll(async () => {
    if (!HAS_DB || claimIds.length === 0) return;
    const receipts = await db.expenseReceipt.findMany({
      where: { claimId: { in: claimIds } },
      select: { id: true },
    });
    await db.auditEvent.deleteMany({
      where: {
        tenantId,
        entityId: { in: [...claimIds, ...receipts.map((r) => r.id)] },
      },
    });
    await db.expenseSettlement.deleteMany({ where: { claimId: { in: claimIds } } });
    await db.expenseClaim.deleteMany({ where: { id: { in: claimIds } } });
    // Leave the counter at its baseline when nothing else was claimed
    // meanwhile, so the sample tenant's next real claim is EXP-000001 again.
    if ((await db.expenseClaim.count({ where: { tenantId } })) === 0) {
      await db.expenseCounter.deleteMany({ where: { tenantId } });
    }
  });

  it("a required receipt blocks; an optional category submits, numbers, records and raises the tile", async () => {
    const blocked = await submitAs(employee, { categoryKey: "fuel" });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toContain("receipt");

    const sent = await submitAs(employee);
    expect(sent.ok).toBe(true);
    if (!sent.ok || !sent.claimId) return;

    const row = await claim(sent.claimId);
    expect(row.status).toBe("SUBMITTED");
    expect(row.claimNumber).toBeGreaterThanOrEqual(1);
    expect(row.policyVersion).toBeGreaterThanOrEqual(1);
    expect(row.submittedAt).not.toBeNull();
    expect(row.categoryName).toBe("Local travel");
    expect(row.receiptRequiredAtSubmission).toBe(false);
    expect(row.transitions.map((t) => `${t.fromStatus}->${t.toStatus}`)).toEqual(["DRAFT->SUBMITTED"]);
    expect(await audit(row.id, "expense.submitted")).not.toBeNull();
    expect(raised).toContainEqual({ kind: "EXPENSE_CLAIM", subjectId: row.id });
  });

  it("claim numbers are unique and increasing within the tenant", async () => {
    const a = await submitAs(employee, { amount: 10 });
    const b = await submitAs(employee, { amount: 11 });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok || !a.claimId || !b.claimId) return;
    const [ra, rb] = await Promise.all([claim(a.claimId), claim(b.claimId)]);
    // Strictly greater, not +1: the payroll-settlement suite shares this
    // tenant and may take a number in between. Uniqueness is the point.
    expect(rb.claimNumber).toBeGreaterThan(ra.claimNumber);
    expect(await db.expenseClaim.count({ where: { tenantId, claimNumber: rb.claimNumber } })).toBe(1);
  });

  it("receipts land with the claim and their own audit; a path outside the tenant prefix is refused", async () => {
    const outside = await submitAs(employee, {
      categoryKey: "fuel",
      receipts: [{ path: "someone-else/x.jpg", name: "x.jpg", mime: "image/jpeg", sizeBytes: 1000 }],
    });
    expect(outside.ok).toBe(false);

    const sent = await submitAs(employee, {
      categoryKey: "fuel",
      amount: 1240.5,
      receipts: [{ path: `${tenantId}/test/fuel.jpg`, name: "fuel.jpg", mime: "image/jpeg", sizeBytes: 1000 }],
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok || !sent.claimId) return;
    const row = await claim(sent.claimId);
    expect(row.receipts).toHaveLength(1);
    expect(row.receiptRequiredAtSubmission).toBe(true);
    expect(await audit(row.receipts[0].id, "expense.receipt_uploaded")).not.toBeNull();
  });

  it("late and duplicate flags are facts on the row; a withdrawn twin stops counting", async () => {
    const late = await submitAs(employee, { amount: 77, expenseDate: isoDaysAgo(40) });
    expect(late.ok).toBe(true);
    if (late.ok && late.claimId) expect((await claim(late.claimId)).isLate).toBe(true);

    const first = await submitAs(employee, { amount: 333, expenseDate: isoDaysAgo(2) });
    const twin = await submitAs(employee, { amount: 333, expenseDate: isoDaysAgo(2) });
    expect(first.ok && twin.ok).toBe(true);
    if (!first.ok || !twin.ok || !first.claimId || !twin.claimId) return;
    expect((await claim(first.claimId)).isPossibleDuplicate).toBe(false);
    expect((await claim(twin.claimId)).isPossibleDuplicate).toBe(true);

    current = employee;
    expect((await withdrawClaimAction({ claimId: first.claimId })).ok).toBe(true);
    expect((await withdrawClaimAction({ claimId: twin.claimId })).ok).toBe(true);
    const third = await submitAs(employee, { amount: 333, expenseDate: isoDaysAgo(2) });
    expect(third.ok).toBe(true);
    if (third.ok && third.claimId) expect((await claim(third.claimId)).isPossibleDuplicate).toBe(false);
  });

  it("withdrawal: claimant only, terminal, tile resolved", async () => {
    const sent = await submitAs(employee, { amount: 42 });
    expect(sent.ok).toBe(true);
    if (!sent.ok || !sent.claimId) return;
    const id = sent.claimId;

    current = approver;
    expect((await withdrawClaimAction({ claimId: id })).ok).toBe(false);

    current = employee;
    const ok = await withdrawClaimAction({ claimId: id, reason: "Wrong amount, resubmitting." });
    expect(ok.ok).toBe(true);
    const row = await claim(id);
    expect(row.status).toBe("WITHDRAWN");
    expect(row.withdrawnAt).not.toBeNull();
    expect(row.withdrawalReason).toBe("Wrong amount, resubmitting.");
    expect(row.decidedById).toBeNull();
    expect(row.approvedAmount).toBeNull();
    expect(await audit(id, "expense.withdrawn")).not.toBeNull();
    expect(resolved).toContainEqual({ subjectId: id, resolution: "withdrawn" });

    expect((await withdrawClaimAction({ claimId: id })).ok).toBe(false);
    current = approver;
    const after = await decideClaimAction({ claimId: id, decision: "APPROVE" });
    expect(after.ok).toBe(false);
    if (!after.ok) expect(after.error.toLowerCase()).toContain("withdrawn");
  });

  it("self-approval is refused under the default policy", async () => {
    const sent = await submitAs(employee, { amount: 60 });
    expect(sent.ok).toBe(true);
    if (!sent.ok || !sent.claimId) return;
    current = { ...employee, permissions: new Set(["expenses.approve"]) as AppSession["permissions"] };
    const own = await decideClaimAction({ claimId: sent.claimId, decision: "APPROVE" });
    expect(own.ok).toBe(false);
    if (!own.ok) expect(own.error).toContain("own claim");
  });

  it("rejecting needs a reason; a lower amount is partial; full is APPROVED; settlement needs a reference", async () => {
    const sent = await submitAs(employee, { amount: 100 });
    expect(sent.ok).toBe(true);
    if (!sent.ok || !sent.claimId) return;
    const id = sent.claimId;
    current = approver;

    expect((await decideClaimAction({ claimId: id, decision: "REJECT" })).ok).toBe(false);
    expect((await decideClaimAction({ claimId: id, decision: "APPROVE_AMOUNT", approvedAmount: 60 })).ok).toBe(false);

    const partial = await decideClaimAction({ claimId: id, decision: "APPROVE_AMOUNT", approvedAmount: 60, reason: "Standard rate applies." });
    expect(partial.ok).toBe(true);
    let row = await claim(id);
    expect(row.status).toBe("PARTIALLY_APPROVED");
    expect(Number(row.approvedAmount)).toBe(60);
    expect(row.decisionReason).toBe("Standard rate applies.");
    expect(await audit(id, "expense.partially_approved")).not.toBeNull();
    expect(resolved).toContainEqual({ subjectId: id, resolution: "PARTIALLY_APPROVED" });

    expect((await settleClaimAction({ claimId: id, route: "OUTSIDE", reference: "ok" })).ok).toBe(false);
    const settled = await settleClaimAction({ claimId: id, route: "OUTSIDE", reference: "Cash, 4 Sept, voucher 118" });
    expect(settled.ok).toBe(true);
    row = await claim(id);
    expect(row.status).toBe("SETTLED");
    expect(row.settlement?.route).toBe("OUTSIDE");
    expect(Number(row.settlement?.amount)).toBe(60);
    expect(row.settlement?.reference).toBe("Cash, 4 Sept, voucher 118");
    expect(await audit(id, "expense.settled")).not.toBeNull();
    expect(row.transitions.map((t) => t.toStatus)).toEqual(["SUBMITTED", "PARTIALLY_APPROVED", "SETTLED"]);

    current = employee;
    expect((await withdrawClaimAction({ claimId: id })).ok).toBe(false);

    const full = await submitAs(employee, { amount: 100 });
    if (full.ok && full.claimId) {
      current = approver;
      expect((await decideClaimAction({ claimId: full.claimId, decision: "APPROVE" })).ok).toBe(true);
      const fr = await claim(full.claimId);
      expect(fr.status).toBe("APPROVED");
      expect(Number(fr.approvedAmount)).toBe(100);
    }
  });

  it("a withdrawal and an approval in the same instant: exactly one wins", async () => {
    const sent = await submitAs(employee, { amount: 88 });
    expect(sent.ok).toBe(true);
    if (!sent.ok || !sent.claimId) return;
    const id = sent.claimId;

    const [w, a] = await Promise.all([
      db.$transaction(
        (tx) => transitionClaim({ tx, session: employee, claimId: id, to: "WITHDRAWN", allowSelfApproval: false }),
        { timeout: 15_000 },
      ),
      db.$transaction(
        (tx) => transitionClaim({ tx, session: approver, claimId: id, to: "APPROVED", allowSelfApproval: false, approvedAmount: 88 }),
        { timeout: 15_000 },
      ),
    ]);
    expect([w.ok, a.ok].filter(Boolean)).toHaveLength(1);
    const loser = w.ok ? a : w;
    expect(loser.ok).toBe(false);
    if (!loser.ok) expect(loser.status).toBe(w.ok ? "WITHDRAWN" : "APPROVED");
    const row = await claim(id);
    expect(row.transitions).toHaveLength(2);
  });
});
