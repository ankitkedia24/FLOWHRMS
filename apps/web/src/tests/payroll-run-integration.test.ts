/**
 * Payroll correctness (hardening batch 4) — the real actions against the
 * real database, in the sample company, for months far in the past
 * (January and February 2020) so no real run can be affected. Only the
 * request-bound layers are mocked: who is signed in, audit writes, cache.
 *
 * Proves what the pure rules can't:
 * - Calculate removes the line of someone who left (and keeps, zeroed and
 *   left out, a line that carries an adjustment);
 * - Approve refuses when an input changed after calculating, and succeeds
 *   after calculating again — approving what the stored lines say;
 * - an approved run refuses adjustments and recalculation;
 * - undecided attendance blocks Calculate and Approve, and a rejected
 *   record then counts as an absent day;
 * - saving a pay item without the statutory flag keeps the stored flag
 *   (placeholder company, demo-co).
 *
 * Everything it creates is deleted in afterAll. Skips without a database.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const HAS_DB = Boolean(process.env.DATABASE_URL);

// A calculation writes a line per member inside one transaction; give it room.
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAuditEvent: vi.fn(async () => {}) }));

const who = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("@/lib/authz/guard", () => ({
  checkAccess: vi.fn(async () => ({ session: who.session, decision: { allowed: true } })),
}));

import type { AppSession } from "@/lib/auth/types";
import { getDb } from "@/lib/db";
import {
  addAdjustmentAction,
  approvePayrollAction,
  calculatePayrollAction,
} from "@/lib/payroll/actions";
import { LEFT_THE_RUN_REASON } from "@/lib/payroll/lines";
import { buildPayrollPreview } from "@/lib/payroll/service";
import { saveSalaryComponentAction } from "@/lib/payroll/structure-actions";

const JAN = new Date(Date.UTC(2020, 0, 1));
const FEB = new Date(Date.UTC(2020, 1, 1));
const day = (key: string) => new Date(`${key}T00:00:00.000Z`);
const FIGURES_CHANGED = "Figures changed since you calculated — calculate again, then approve.";

describe.skipIf(!HAS_DB)("payroll runs stay true to their payslips (database)", () => {
  const db = HAS_DB ? getDb() : (null as never);
  const stamp = Date.now().toString(36);
  let tenant: { id: string; slug: string; name: string; timezone: string };
  let admin: AppSession;
  /** Existing sample employees, given a salary effective 2020-01-01 for the test. */
  const staff: Record<"asha" | "ravi", { membershipId: string; name: string }> = {} as never;
  /** Temporary people who "leave" mid-test. */
  const leavers: Record<"plain" | "adjusted", { membershipId: string; userId: string }> = {} as never;
  const structureIds: string[] = [];
  const attendanceIds: string[] = [];

  const signIn = (session: AppSession) => {
    who.session = session;
  };
  const runFor = (periodMonth: Date) =>
    db.payrollRun.findUnique({ where: { tenantId_periodMonth: { tenantId: tenant.id, periodMonth } } });
  const lineFor = async (periodMonth: Date, membershipId: string) => {
    const run = await runFor(periodMonth);
    if (!run) return null;
    return db.payrollLine.findUnique({
      where: { runId_membershipId: { runId: run.id, membershipId } },
      include: { adjustments: true },
    });
  };
  const attend = async (membershipId: string, key: string, reviewStatus: "NONE" | "PENDING") => {
    const row = await db.attendanceRecord.create({
      data: {
        tenantId: tenant.id,
        membershipId,
        workDate: day(key),
        checkInAt: new Date(`${key}T04:00:00.000Z`),
        reviewStatus,
      },
    });
    attendanceIds.push(row.id);
    return row.id;
  };

  async function removeTestRuns() {
    // Only the sample company's 2020 runs — test data by construction.
    await db.payrollRun.deleteMany({
      where: { tenantId: tenant.id, periodMonth: { in: [JAN, FEB] } },
    }); // lines and adjustments cascade
  }

  beforeAll(async () => {
    tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "sunrise-traders-sample" } });
    await removeTestRuns(); // leftovers of an interrupted earlier run

    const [owner, employees, component, employeeRole] = await Promise.all([
      db.tenantMembership.findFirstOrThrow({
        where: { tenantId: tenant.id, status: "ACTIVE", role: { key: { in: ["OWNER", "SUPER_ADMIN", "ADMIN", "HR"] } } },
        include: { user: true, role: true },
        orderBy: { createdAt: "asc" },
      }),
      db.tenantMembership.findMany({
        where: { tenantId: tenant.id, status: "ACTIVE", role: { key: "EMPLOYEE" }, salaryStructures: { some: {} } },
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 2,
      }),
      db.salaryComponent.findUniqueOrThrow({
        where: { tenantId_key: { tenantId: tenant.id, key: "monthly_salary" } },
      }),
      db.role.findFirstOrThrow({ where: { tenantId: tenant.id, key: "EMPLOYEE" } }),
    ]);
    if (employees.length < 2) throw new Error("the sample company needs two employees with a salary");

    admin = {
      user: { id: owner.user.id, displayName: owner.user.displayName, email: null, isPlatformAdmin: false },
      tenant: { ...tenant, plan: "INTERNAL", trialEndsAt: null, selfSignup: false, ownerEmailVerifiedAt: null, paidUntil: null },
      membership: { id: owner.id, roleKey: owner.role.key, roleName: owner.role.name, employeeCode: null },
      permissions: new Set(["payroll.view", "payroll.edit", "payroll.approve"]) as AppSession["permissions"],
      source: "supabase",
    };
    staff.asha = { membershipId: employees[0].id, name: employees[0].user.displayName };
    staff.ravi = { membershipId: employees[1].id, name: employees[1].user.displayName };

    for (const key of ["plain", "adjusted"] as const) {
      const user = await db.user.create({
        data: { displayName: `Payroll leaver ${key}`, email: `hw4-${key}-${stamp}@example.test`, status: "ACTIVE" },
      });
      const m = await db.tenantMembership.create({
        data: { tenantId: tenant.id, userId: user.id, roleId: employeeRole.id, status: "ACTIVE" },
      });
      leavers[key] = { membershipId: m.id, userId: user.id };
    }

    // ₹31,000 a month from 1 Jan 2020 — later structures (the sample's own)
    // still win for every current month.
    const people = [staff.asha.membershipId, staff.ravi.membershipId, leavers.plain.membershipId, leavers.adjusted.membershipId];
    await db.salaryStructure.deleteMany({
      where: { tenantId: tenant.id, membershipId: { in: people }, effectiveFrom: JAN },
    });
    await db.attendanceRecord.deleteMany({
      where: { tenantId: tenant.id, membershipId: { in: people }, workDate: { lt: day("2021-01-01") } },
    });
    for (const membershipId of people) {
      const s = await db.salaryStructure.create({
        data: {
          tenantId: tenant.id,
          membershipId,
          effectiveFrom: JAN,
          baseAmount: 31_000,
          note: "hardening batch 4 integration test",
          lines: { create: [{ componentId: component.id, amount: 31_000, percent: 0 }] },
        },
      });
      structureIds.push(s.id);
    }
  });

  afterAll(async () => {
    if (!tenant) return;
    await removeTestRuns();
    const leaverIds = Object.values(leavers).map((l) => l.membershipId);
    // A current-month run another test calculated while the leavers were
    // active may hold lines for them; those lines go, the run stays.
    if (leaverIds.length) {
      await db.payrollLine.deleteMany({ where: { tenantId: tenant.id, membershipId: { in: leaverIds } } });
    }
    await db.attendanceRecord.deleteMany({ where: { id: { in: attendanceIds } } });
    await db.salaryStructure.deleteMany({ where: { id: { in: structureIds } } }); // lines cascade
    if (leaverIds.length) {
      await db.tenantMembership.deleteMany({ where: { id: { in: leaverIds } } });
      await db.user.deleteMany({ where: { id: { in: Object.values(leavers).map((l) => l.userId) } } });
    }
  });

  it("calculates January 2020 as one DRAFT run with a line for each person paid", async () => {
    signIn(admin);
    const r = await calculatePayrollAction({ period: "2020-01" });
    expect(r).toMatchObject({ ok: true });
    expect((await runFor(JAN))?.status).toBe("DRAFT");
    for (const id of [staff.asha.membershipId, staff.ravi.membershipId, leavers.plain.membershipId, leavers.adjusted.membershipId]) {
      expect((await lineFor(JAN, id))?.status).toBe("READY");
    }
  });

  it("recalculating removes the line of someone who left, and keeps one carrying an adjustment zeroed and left out", async () => {
    signIn(admin);
    const adjustedLine = await lineFor(JAN, leavers.adjusted.membershipId);
    const added = await addAdjustmentAction({
      lineId: adjustedLine!.id,
      label: "[test] advance recovery",
      amount: 250,
      reason: "Batch 4 integration test",
    });
    expect(added).toMatchObject({ ok: true });

    await db.tenantMembership.updateMany({
      where: { id: { in: [leavers.plain.membershipId, leavers.adjusted.membershipId] } },
      data: { status: "DEACTIVATED" },
    });
    expect(await calculatePayrollAction({ period: "2020-01" })).toMatchObject({ ok: true });

    expect(await lineFor(JAN, leavers.plain.membershipId)).toBeNull();
    const kept = await lineFor(JAN, leavers.adjusted.membershipId);
    expect(kept?.id).toBe(adjustedLine!.id);
    expect(kept?.status).toBe("NO_SALARY_STRUCTURE");
    expect(kept?.statusReason).toBe(LEFT_THE_RUN_REASON);
    expect(Number(kept?.gross)).toBe(0);
    expect(Number(kept?.net)).toBe(0);
    expect(kept?.adjustments.map((a) => Number(a.amount))).toEqual([250]);

    const preview = await buildPayrollPreview(admin, JAN);
    expect(preview.adjustmentsOnExcludedLines.map((x) => x.membershipId)).toContain(leavers.adjusted.membershipId);

    // The run's totals are the paid lines' totals.
    const run = await runFor(JAN);
    const lines = await db.payrollLine.findMany({ where: { runId: run!.id } });
    const paidNet = lines.filter((l) => l.status !== "NO_SALARY_STRUCTURE").reduce((s, l) => s + Number(l.net), 0);
    expect(Number(run!.netTotal)).toBe(paidNet);
  });

  it("refuses to approve when an input changed after calculating", async () => {
    signIn(admin);
    await attend(staff.asha.membershipId, "2020-01-02", "NONE");
    const r = await approvePayrollAction({ period: "2020-01", reason: "January pay", accountantAcknowledged: true });
    expect(r).toEqual({ ok: false, error: FIGURES_CHANGED });
    expect((await runFor(JAN))?.status).toBe("DRAFT");
  });

  it("approves after calculating again — and approves what the stored lines say", async () => {
    signIn(admin);
    expect(await calculatePayrollAction({ period: "2020-01" })).toMatchObject({ ok: true });
    const r = await approvePayrollAction({ period: "2020-01", reason: "January pay", accountantAcknowledged: true });
    expect(r).toMatchObject({ ok: true });

    const run = await runFor(JAN);
    expect(run?.status).toBe("APPROVED");
    expect(run?.approvedById).toBe(admin.membership.id);
    const lines = await db.payrollLine.findMany({ where: { runId: run!.id } });
    const paid = lines.filter((l) => l.status !== "NO_SALARY_STRUCTURE");
    expect(Number(run!.netTotal)).toBe(paid.reduce((s, l) => s + Number(l.net), 0));
    expect(Number(run!.grossTotal)).toBe(paid.reduce((s, l) => s + Number(l.gross), 0));
    const asha = lines.find((l) => l.membershipId === staff.asha.membershipId);
    expect(Number(asha?.presentDays)).toBe(1);
  });

  it("refuses an adjustment, and a recalculation, on the approved run", async () => {
    signIn(admin);
    const before = await lineFor(JAN, staff.asha.membershipId);
    const r = await addAdjustmentAction({
      lineId: before!.id,
      label: "[test] late bonus",
      amount: 500,
      reason: "Batch 4 integration test",
    });
    expect(r).toEqual({ ok: false, error: "This month's payroll is approved; add it to next month instead." });

    const again = await calculatePayrollAction({ period: "2020-01" });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toContain("approved and locked");

    const after = await lineFor(JAN, staff.asha.membershipId);
    expect(after?.adjustments).toHaveLength(0);
    expect(Number(after?.net)).toBe(Number(before?.net));
    expect(after?.updatedAt.getTime()).toBe(before?.updatedAt.getTime());
  });

  it("undecided attendance blocks Calculate; once rejected, the day counts as absent", async () => {
    signIn(admin);
    const recordId = await attend(staff.asha.membershipId, "2020-02-03", "PENDING");

    const pending = await calculatePayrollAction({ period: "2020-02" });
    expect(pending.ok).toBe(false);
    if (!pending.ok) {
      expect(pending.error).toContain(`1 attendance record still needs a decision (${staff.asha.name})`);
    }
    expect(await runFor(FEB)).toBeNull(); // a refused Calculate leaves no empty run

    await db.attendanceRecord.update({ where: { id: recordId }, data: { reviewStatus: "DETAILS_REQUESTED" } });
    expect((await calculatePayrollAction({ period: "2020-02" })).ok).toBe(false);

    await db.attendanceRecord.update({ where: { id: recordId }, data: { reviewStatus: "REJECTED" } });
    expect(await calculatePayrollAction({ period: "2020-02" })).toMatchObject({ ok: true });
    expect(Number((await lineFor(FEB, staff.asha.membershipId))?.presentDays)).toBe(0);

    // The same record approved would have been a present day.
    await db.attendanceRecord.update({ where: { id: recordId }, data: { reviewStatus: "APPROVED" } });
    const preview = await buildPayrollPreview(admin, FEB);
    expect(preview.lines.find((l) => l.membershipId === staff.asha.membershipId)?.result?.presentDays).toBe(1);
    await db.attendanceRecord.update({ where: { id: recordId }, data: { reviewStatus: "REJECTED" } });
  });

  it("undecided attendance blocks Approve too", async () => {
    signIn(admin);
    await attend(staff.ravi.membershipId, "2020-02-04", "PENDING");
    const r = await approvePayrollAction({ period: "2020-02", reason: "February pay", accountantAcknowledged: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(`still needs a decision (${staff.ravi.name})`);
    expect((await runFor(FEB))?.status).toBe("DRAFT");
  });
});

describe.skipIf(!HAS_DB)("saving a pay item keeps its statutory flag (database, demo-co)", () => {
  const db = HAS_DB ? getDb() : (null as never);
  const key = `hw4_probe_${Date.now().toString(36)}`;
  let tenantId = "";

  beforeAll(async () => {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-co" } });
    tenantId = tenant.id;
    const owner = await db.tenantMembership.findFirstOrThrow({
      where: { tenantId, status: "ACTIVE" },
      include: { user: true, role: true },
      orderBy: { createdAt: "asc" },
    });
    who.session = {
      user: { id: owner.user.id, displayName: owner.user.displayName, email: null, isPlatformAdmin: false },
      tenant: { ...tenant, plan: "INTERNAL", trialEndsAt: null, selfSignup: false, ownerEmailVerifiedAt: null, paidUntil: null },
      membership: { id: owner.id, roleKey: owner.role.key, roleName: owner.role.name, employeeCode: null },
      permissions: new Set(["payroll.edit"]),
      source: "supabase",
    };
  });

  afterAll(async () => {
    if (tenantId) await db.salaryComponent.deleteMany({ where: { tenantId, key } });
  });

  const stored = () => db.salaryComponent.findUniqueOrThrow({ where: { tenantId_key: { tenantId, key } } });
  const base = { key, name: "Probe deduction", kind: "DEDUCTION" as const, calculation: "FIXED" as const, prorated: false };

  it("starts a new item as not statutory when the flag is left out", async () => {
    expect(await saveSalaryComponentAction(base)).toMatchObject({ ok: true });
    expect((await stored()).isStatutory).toBe(false);
  });

  it("keeps a stored flag when a save leaves it out, and changes it only when sent", async () => {
    expect(await saveSalaryComponentAction({ ...base, isStatutory: true })).toMatchObject({ ok: true });
    expect((await stored()).isStatutory).toBe(true);

    expect(await saveSalaryComponentAction({ ...base, name: "Probe deduction, renamed" })).toMatchObject({ ok: true });
    const kept = await stored();
    expect(kept.name).toBe("Probe deduction, renamed");
    expect(kept.isStatutory).toBe(true);

    expect(await saveSalaryComponentAction({ ...base, isStatutory: false })).toMatchObject({ ok: true });
    expect((await stored()).isStatutory).toBe(false);
  });
});
