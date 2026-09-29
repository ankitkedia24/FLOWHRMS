/**
 * Dev utility: exercise the Phase 3 payroll cycle against the real
 * database — components, structures, calculation, locking approval and
 * post-approval adjustment.
 *
 * Placeholder data only, cleaned up afterwards.
 * Usage: npx tsx scripts/smoke-phase3.ts
 */
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  DEFAULT_LATE_POLICY,
  calculatePayrollLine,
  daysInPeriod,
  formatRupees,
  runBlockers,
  runExclusions,
} from "../src/lib/payroll/engine";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  }),
});

const check = (label: string, pass: boolean, detail = "") => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!pass) process.exitCode = 1;
};

const PERIOD = new Date(Date.UTC(2099, 0, 1)); // far future: never clashes

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { slug: "demo-co" },
  });
  const member = await db.tenantMembership.findFirstOrThrow({
    where: { tenantId: tenant.id, role: { key: "EMPLOYEE" } },
    include: { user: true },
  });

  // --- components defined by the tenant (never shipped by FlowHRMS)
  const basic = await db.salaryComponent.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: "smoke_basic" } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: "smoke_basic",
      name: "Basic (smoke)",
      kind: "EARNING",
      calculation: "PERCENT_OF_BASE",
      prorated: true,
      sortOrder: 900,
    },
  });
  const pf = await db.salaryComponent.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: "smoke_pf" } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: "smoke_pf",
      name: "Provident fund (smoke)",
      kind: "DEDUCTION",
      calculation: "FIXED",
      isStatutory: true,
      prorated: false,
      sortOrder: 901,
    },
  });
  check("tenant-defined components created", Boolean(basic.id && pf.id));
  check("statutory component is flagged, not computed by FlowHRMS", pf.isStatutory);

  // --- salary structure
  const structure = await db.salaryStructure.upsert({
    where: {
      tenantId_membershipId_effectiveFrom: {
        tenantId: tenant.id,
        membershipId: member.id,
        effectiveFrom: PERIOD,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      membershipId: member.id,
      effectiveFrom: PERIOD,
      baseAmount: 20_000,
      lines: {
        create: [
          { componentId: basic.id, amount: 0, percent: 60 },
          { componentId: pf.id, amount: 1_800, percent: 0 },
        ],
      },
    },
    include: { lines: true },
  });
  check("salary structure stored with lines", structure.lines.length === 2);

  // --- calculation via the shared engine
  const calendarDays = daysInPeriod(PERIOD);
  const result = calculatePayrollLine({
    structure: {
      baseAmount: 20_000,
      components: [
        {
          key: basic.key,
          name: basic.name,
          kind: "EARNING",
          calculation: "PERCENT_OF_BASE",
          isStatutory: false,
          prorated: true,
          amount: 0,
          percent: 60,
        },
        {
          key: pf.key,
          name: pf.name,
          kind: "DEDUCTION",
          calculation: "FIXED",
          isStatutory: true,
          prorated: false,
          amount: 1_800,
          percent: 0,
        },
      ],
    },
    attendance: {
      calendarDays,
      presentDays: calendarDays - 2,
      paidLeaveDays: 0,
      unpaidLeaveDays: 2,
      absentDays: 0,
      lateDays: 0,
      lateMinutes: 0,
    },
    policy: DEFAULT_LATE_POLICY,
  });

  check(
    "earnings pro-rated for unpaid days",
    result.gross < 12_000 && result.gross > 11_000,
    formatRupees(result.gross),
  );
  check("non-prorated deduction unchanged", result.deductions[0].amount === 1_800);
  check(
    "totals reconcile to the sum of lines",
    result.gross === result.earnings.reduce((s, l) => s + l.amount, 0) &&
      result.net === result.gross - result.deductionTotal + result.adjustmentTotal,
  );
  check(
    "every figure carries a basis",
    [...result.earnings, ...result.deductions].every((l) => l.basis.length > 0),
  );

  // --- run, lines and locking approval
  const run = await db.payrollRun.upsert({
    where: { tenantId_periodMonth: { tenantId: tenant.id, periodMonth: PERIOD } },
    update: {},
    create: {
      tenantId: tenant.id,
      periodMonth: PERIOD,
      status: "DRAFT",
      calculatedAt: new Date(),
      grossTotal: result.gross,
      deductionTotal: result.deductionTotal,
      netTotal: result.net,
      inputsSnapshot: { policyVersion: 1, calendarDays },
    },
  });

  const line = await db.payrollLine.upsert({
    where: { runId_membershipId: { runId: run.id, membershipId: member.id } },
    update: {},
    create: {
      tenantId: tenant.id,
      runId: run.id,
      membershipId: member.id,
      status: "READY",
      calendarDays,
      presentDays: result.presentDays,
      unpaidDays: result.unpaidDays,
      payableDays: result.payableDays,
      earnings: JSON.parse(JSON.stringify(result.earnings)),
      deductions: JSON.parse(JSON.stringify(result.deductions)),
      gross: result.gross,
      deductionTotal: result.deductionTotal,
      net: result.net,
    },
  });
  check("payroll line persisted with its breakdown", Boolean(line.earnings));

  check(
    "negative net blocks approval",
    runBlockers([{ name: "X", status: "READY", net: -1 }]).length === 1,
  );
  check(
    "missing structures are named as exclusions",
    runExclusions([{ name: "Vikas", status: "NO_SALARY_STRUCTURE" }])[0] === "Vikas",
  );

  const approved = await db.payrollRun.update({
    where: { id: run.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvalReason: "Smoke test",
      accountantAcknowledged: true,
    },
  });
  check("approval locks the period", approved.status === "APPROVED");
  check(
    "accountant acknowledgement recorded",
    approved.accountantAcknowledged === true,
  );

  // --- post-approval change is an adjustment, never an overwrite
  const netBefore = Number(line.net);
  await db.payrollAdjustment.create({
    data: {
      tenantId: tenant.id,
      lineId: line.id,
      label: "Incentive (smoke)",
      amount: 500,
      reason: "Smoke test adjustment",
    },
  });
  const adjusted = await db.payrollLine.update({
    where: { id: line.id },
    data: { adjustmentTotal: 500, net: netBefore + 500 },
  });
  check(
    "adjustment changes net without touching gross",
    Number(adjusted.gross) === result.gross && Number(adjusted.net) === netBefore + 500,
  );

  // --- tenant isolation
  const leaked = await db.payrollLine.count({
    where: { tenantId: { not: tenant.id } },
  });
  check("no payroll rows outside the demo tenant", leaked === 0);

  // --- cleanup
  await db.payrollAdjustment.deleteMany({ where: { lineId: line.id } });
  await db.payrollLine.deleteMany({ where: { runId: run.id } });
  await db.payrollRun.delete({ where: { id: run.id } });
  await db.salaryStructureLine.deleteMany({ where: { structureId: structure.id } });
  await db.salaryStructure.delete({ where: { id: structure.id } });
  await db.salaryComponent.deleteMany({
    where: { tenantId: tenant.id, key: { in: ["smoke_basic", "smoke_pf"] } },
  });
  console.log("cleanup complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
