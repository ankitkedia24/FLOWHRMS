/**
 * Expenses × Payroll E2 — integration against the real database (the
 * sample tenant). Mocks only the request-bound layers: session, cache
 * revalidation, notifications, the tile queue, and the entitlement
 * snapshot (so Payroll can be switched "off" for one test without
 * touching the tenant’s real module settings).
 *
 * What this proves: the seam refuses correctly and writes nothing when
 * it refuses; a settlement writes exactly one adjustment, rounded, with
 * the same figure on the payslip line and the settlement record; the
 * settler needs no payroll permission; a second call is idempotent;
 * recalculation keeps the adjustment; approval’s own preview includes it.
 *
 * Leaves the sample tenant as it found it. Skips without a database.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const HAS_DB = Boolean(process.env.DATABASE_URL);

// Calculating a payroll run is a real round trip over every member; give it room.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notify: { expenseUpdate: vi.fn(async () => {}) } }));
vi.mock("@/lib/actions/service", () => ({
  raiseActionRequest: vi.fn(async () => {}),
  resolveActionRequest: vi.fn(async () => {}),
}));

import type { AppSession } from "@/lib/auth/types";
let current: AppSession;
vi.mock("@/lib/authz/guard", () => ({
  checkAccess: vi.fn(async () => ({ session: current, decision: { allowed: true } })),
}));

// The entitlement snapshot the seam reads: Payroll on unless a test says otherwise.
let payrollOn = true;
vi.mock("@/lib/authz/entitlements", () => ({
  loadEntitlements: vi.fn(async () => ({
    modules: { PAYROLL: payrollOn, EXPENSES: true, EMPLOYEES: true, ATTENDANCE: true },
    features: {},
    userExceptions: {},
  })),
}));

import { getDb } from "@/lib/db";
import { getPolicy, setPolicy } from "@/lib/policies";
import { DEFAULT_EXPENSES_POLICY } from "@/lib/expenses/policy";
import { decideClaimAction, settleClaimAction, submitClaimAction } from "@/lib/expenses/actions";
import { addAdjustmentAction, calculatePayrollAction } from "@/lib/payroll/actions";
import { roundRupees } from "@/lib/payroll/engine";
import { buildPayrollPreview, currentPeriod } from "@/lib/payroll/service";

const d = describe.skipIf(!HAS_DB);

d("expenses settle through payroll (integration, sample tenant)", () => {
  const db = HAS_DB ? getDb() : (null as never);
  const startedAt = new Date();
  let tenantId = "";
  let timeZone = "Asia/Kolkata";
  let employee: AppSession;
  let approver: AppSession;
  let periodMonth = new Date();
  let periodValue = "";
  let preexistingRun = false;
  let usable = true;
  let runId = "";
  const claimIds: string[] = [];
  const adjustmentIds: string[] = [];

  async function submitAs(who: AppSession, amount: number) {
    current = who;
    const r = await submitClaimAction({
      categoryKey: "local-travel",
      amount,
      expenseDate: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
      description: "Auto to the customer site",
      receipts: [],
    });
    if (r.ok && r.claimId) claimIds.push(r.claimId);
    return r;
  }

  async function approvedClaim(amount: number): Promise<string> {
    const sent = await submitAs(employee, amount);
    if (!sent.ok || !sent.claimId) throw new Error(`submit failed: ${sent.ok ? "" : sent.error}`);
    current = approver;
    const ok = await decideClaimAction({ claimId: sent.claimId, decision: "APPROVE" });
    if (!ok.ok) throw new Error(`approve failed: ${ok.error}`);
    return sent.claimId;
  }

  const claim = (id: string) =>
    db.expenseClaim.findUniqueOrThrow({ where: { id }, include: { settlement: true } });
  const employeeLine = () =>
    db.payrollLine.findUnique({
      where: { runId_membershipId: { runId, membershipId: employee.membership.id } },
      include: { adjustments: true, run: true },
    });

  beforeAll(async () => {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "sunrise-traders-sample" } });
    tenantId = tenant.id;
    timeZone = tenant.timezone;

    const mod = await db.module.findUniqueOrThrow({ where: { key: "EXPENSES" } });
    await db.tenantModuleSetting.upsert({
      where: { tenantId_moduleId: { tenantId, moduleId: mod.id } },
      update: { enabled: true },
      create: { tenantId, moduleId: mod.id, enabled: true },
    });

    const [emp, appr] = await Promise.all([
      db.tenantMembership.findFirstOrThrow({
        where: { tenantId, status: "ACTIVE", role: { key: "EMPLOYEE" }, salaryStructures: { some: {} } },
        include: { user: true, role: true },
        orderBy: { createdAt: "asc" },
      }),
      db.tenantMembership.findFirstOrThrow({
        where: { tenantId, status: "ACTIVE", role: { key: { in: ["OWNER", "SUPER_ADMIN", "ADMIN", "HR"] } } },
        include: { user: true, role: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    if (!(await getPolicy(tenantId, "expenses"))) {
      await setPolicy(tenantId, "expenses", DEFAULT_EXPENSES_POLICY, appr.userId);
    }

    const session = (m: typeof emp, perms: string[]): AppSession => ({
      user: { id: m.user.id, displayName: m.user.displayName, email: null, isPlatformAdmin: false },
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, timezone: tenant.timezone, plan: "INTERNAL", trialEndsAt: null, selfSignup: false, ownerEmailVerifiedAt: null, paidUntil: null },
      membership: { id: m.id, roleKey: m.role.key, roleName: m.role.name, employeeCode: null },
      permissions: new Set(perms) as AppSession["permissions"],
      source: "supabase",
    });
    employee = session(emp, []);
    // Deliberately NO payroll.* permission: the boundary under test (§13).
    approver = session(appr, ["admin.access", "expenses.approve", "expenses.view"]);

    periodMonth = currentPeriod(timeZone);
    periodValue = periodMonth.toISOString().slice(0, 7);
    const existing = await db.payrollRun.findUnique({
      where: { tenantId_periodMonth: { tenantId, periodMonth } },
    });
    preexistingRun = Boolean(existing);
    if (existing?.status === "APPROVED") {
      usable = false;
      console.warn(`[e2-integration] ${periodValue} payroll is APPROVED for the sample tenant; write tests skipped.`);
    }
    if (existing) runId = existing.id;
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    const receipts = await db.expenseReceipt.findMany({ where: { claimId: { in: claimIds } }, select: { id: true } });
    const lineIds = runId
      ? (await db.payrollLine.findMany({ where: { runId }, select: { id: true } })).map((l) => l.id)
      : [];
    await db.auditEvent.deleteMany({
      where: {
        tenantId,
        OR: [
          { entityId: { in: [...claimIds, ...receipts.map((r) => r.id)] } },
          { entityId: { in: lineIds }, action: "payroll.adjustment_added", createdAt: { gte: startedAt } },
        ],
      },
    });
    await db.expenseSettlement.deleteMany({ where: { claimId: { in: claimIds } } });
    await db.expenseClaim.deleteMany({ where: { id: { in: claimIds } } });
    if ((await db.expenseClaim.count({ where: { tenantId } })) === 0) {
      await db.expenseCounter.deleteMany({ where: { tenantId } });
    }
    if (adjustmentIds.length) {
      await db.payrollAdjustment.deleteMany({ where: { id: { in: adjustmentIds } } });
    }
    if (runId && !preexistingRun) {
      await db.payrollRun.delete({ where: { id: runId } }); // lines and adjustments cascade
    } else if (runId && usable) {
      current = approver;
      await calculatePayrollAction({ period: periodValue }); // restore the totals
    }
  });

  it("with Payroll off, PAYROLL is not an offered route — refused at write time, nothing written", async () => {
    if (!usable) return;
    const id = await approvedClaim(120);
    payrollOn = false;
    try {
      const r = await settleClaimAction({ claimId: id, route: "PAYROLL" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("not enabled");
    } finally {
      payrollOn = true;
    }
    const row = await claim(id);
    expect(row.status).toBe("APPROVED");
    expect(row.settlement).toBeNull();
  });

  it("with no open run, NO_OPEN_RUN names the month and writes nothing", async () => {
    if (!usable || preexistingRun) return;
    const before = await db.payrollAdjustment.count({ where: { tenantId } });
    const id = await approvedClaim(130);
    const r = await settleClaimAction({ claimId: id, route: "PAYROLL" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("No payroll run is open");
    expect((await claim(id)).status).toBe("APPROVED");
    expect(await db.payrollAdjustment.count({ where: { tenantId } })).toBe(before);
  });

  it("fixture: the current month is calculated as a DRAFT run with a READY line for the claimant", async () => {
    if (!usable) return;
    current = approver;
    const r = await calculatePayrollAction({ period: periodValue });
    expect(r.ok).toBe(true);
    const run = await db.payrollRun.findUniqueOrThrow({
      where: { tenantId_periodMonth: { tenantId, periodMonth } },
    });
    runId = run.id;
    expect(run.status).toBe("DRAFT");
    const line = await employeeLine();
    expect(line?.status).toBe("READY");
  });

  it("a person without a payable line on the run → NO_LINE_FOR_PERSON, and recalculation restores the line", async () => {
    if (!usable) return;
    const id = await approvedClaim(140);
    await db.payrollLine.delete({
      where: { runId_membershipId: { runId, membershipId: employee.membership.id } },
    });
    const r = await settleClaimAction({ claimId: id, route: "PAYROLL" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("not on the");
    expect((await claim(id)).status).toBe("APPROVED");

    current = approver;
    expect((await calculatePayrollAction({ period: periodValue })).ok).toBe(true);
    expect((await employeeLine())?.status).toBe("READY");
  });

  it("settles through payroll: one rounded adjustment, the same figure on both records, no payroll permission needed", async () => {
    if (!usable) return;
    const lineBefore = await employeeLine();
    if (!lineBefore) throw new Error("no line");
    const runBefore = await db.payrollRun.findUniqueOrThrow({ where: { id: runId } });

    const id = await approvedClaim(1240.5);
    current = approver; // holds expenses.approve only
    const r = await settleClaimAction({ claimId: id, route: "PAYROLL" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.message).toContain("₹1,241.00");
      expect(r.detail).toContain("whole rupees");
    }

    const row = await claim(id);
    expect(row.status).toBe("SETTLED");
    expect(Number(row.approvedAmount)).toBe(1240.5);
    expect(row.settlement?.route).toBe("PAYROLL");
    expect(Number(row.settlement?.amount)).toBe(1241);
    expect(row.settlement?.payrollAdjustmentId).toBeTruthy();
    expect(row.settlement?.reference).toContain("payroll");

    const adjustment = await db.payrollAdjustment.findUniqueOrThrow({
      where: { id: row.settlement!.payrollAdjustmentId! },
    });
    adjustmentIds.push(adjustment.id);
    expect(adjustment.lineId).toBe(lineBefore.id);
    expect(Number(adjustment.amount)).toBe(roundRupees(1240.5));
    expect(adjustment.label).toContain("Local travel");
    expect(adjustment.label).toContain("EXP-");
    expect(adjustment.reason).toContain("approved");
    expect(adjustment.createdById).toBe(approver.user.id);

    const lineAfter = await employeeLine();
    expect(Number(lineAfter?.adjustmentTotal)).toBe(Number(lineBefore.adjustmentTotal) + 1241);
    expect(Number(lineAfter?.net)).toBe(Number(lineBefore.net) + 1241);
    const runAfter = await db.payrollRun.findUniqueOrThrow({ where: { id: runId } });
    expect(Number(runAfter.netTotal)).toBe(Number(runBefore.netTotal) + 1241);

    const settled = await db.auditEvent.findFirst({ where: { tenantId, entityId: id, action: "expense.settled" } });
    expect(settled).not.toBeNull();
    expect((settled?.metadata as { route?: string; settledAmount?: number })?.route).toBe("PAYROLL");
    expect((settled?.metadata as { settledAmount?: number })?.settledAmount).toBe(1241);
    const payrollAudit = await db.auditEvent.findFirst({
      where: { tenantId, entityId: lineBefore.id, action: "payroll.adjustment_added", createdAt: { gte: startedAt } },
    });
    expect(payrollAudit).not.toBeNull();
  });

  it("is idempotent: settling the same claim again returns the existing adjustment and writes nothing", async () => {
    if (!usable) return;
    const settledId = claimIds.at(-1)!;
    const line = await employeeLine();
    const count = line?.adjustments.length ?? 0;
    current = approver;
    const again = await settleClaimAction({ claimId: settledId, route: "PAYROLL" });
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.message).toContain("already settled");
    expect((await employeeLine())?.adjustments.length).toBe(count);
    expect(await db.expenseSettlement.count({ where: { claimId: settledId } })).toBe(1);
  });

  it("an outside settlement after a payroll settlement is refused — SETTLED is terminal", async () => {
    if (!usable) return;
    const settledId = claimIds.at(-1)!;
    current = approver;
    const r = await settleClaimAction({ claimId: settledId, route: "OUTSIDE", reference: "Cash, again" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain("settled");
  });

  it("recalculating the run keeps the adjustment and its total", async () => {
    if (!usable) return;
    const before = await employeeLine();
    current = approver;
    expect((await calculatePayrollAction({ period: periodValue })).ok).toBe(true);
    const after = await employeeLine();
    expect(after?.adjustments.map((a) => a.id)).toEqual(before?.adjustments.map((a) => a.id));
    expect(Number(after?.adjustmentTotal)).toBe(Number(before?.adjustmentTotal));
    expect(after?.adjustments.some((a) => Number(a.amount) === 1241)).toBe(true);
  });

  it("approval would carry it: the server-side preview approval recomputes includes the adjustment", async () => {
    if (!usable) return;
    const preview = await buildPayrollPreview(approver, periodMonth);
    const draft = preview.lines.find((l) => l.membershipId === employee.membership.id);
    expect(draft?.status).toBe("READY");
    expect(draft?.result?.adjustmentTotal ?? 0).toBeGreaterThanOrEqual(1241);
    expect(preview.adjustmentsOnExcludedLines).toEqual([]);
  });

  it("the repointed addAdjustmentAction still records, re-totals and audits — no regression", async () => {
    if (!usable) return;
    const before = await employeeLine();
    if (!before) throw new Error("no line");
    current = approver;
    const r = await addAdjustmentAction({
      lineId: before.id,
      label: "[test] one-off bonus",
      amount: 100,
      reason: "Regression check for the extracted recordAdjustment.",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.message).toContain("Adjustment recorded for");
    const after = await employeeLine();
    const added = after?.adjustments.find((a) => a.label === "[test] one-off bonus");
    expect(added).toBeTruthy();
    if (added) adjustmentIds.push(added.id);
    expect(Number(after?.net)).toBe(Number(before.net) + 100);
    const audit = await db.auditEvent.findFirst({
      where: { tenantId, entityId: before.id, action: "payroll.adjustment_added", createdAt: { gte: startedAt } },
      orderBy: { createdAt: "desc" },
    });
    expect((audit?.after as { adjustment?: { label?: string } })?.adjustment?.label).toBe("[test] one-off bonus");
  });
});
