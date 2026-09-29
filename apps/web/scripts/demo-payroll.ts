/**
 * Dev utility: give the demo tenant salary components and structures so
 * the payroll screens can be reviewed with content.
 *
 * The components below are ILLUSTRATIVE placeholders, not advice. Real
 * tenants define their own with figures from their accountant.
 * Usage: npx tsx scripts/demo-payroll.ts [--clear]
 */
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  }),
});

const COMPONENTS = [
  {
    key: "basic",
    name: "Basic",
    kind: "EARNING" as const,
    calculation: "PERCENT_OF_BASE" as const,
    isStatutory: false,
    prorated: true,
    sortOrder: 10,
    percent: 60,
  },
  {
    key: "hra",
    name: "House rent allowance",
    kind: "EARNING" as const,
    calculation: "PERCENT_OF_BASE" as const,
    isStatutory: false,
    prorated: true,
    sortOrder: 20,
    percent: 25,
  },
  {
    key: "conveyance",
    name: "Conveyance",
    kind: "EARNING" as const,
    calculation: "FIXED" as const,
    isStatutory: false,
    prorated: true,
    sortOrder: 30,
    amount: 1_600,
  },
  {
    key: "provident_fund",
    name: "Provident fund",
    kind: "DEDUCTION" as const,
    calculation: "FIXED" as const,
    isStatutory: true,
    prorated: false,
    sortOrder: 40,
    amount: 1_800,
  },
];

async function main() {
  const clear = process.argv.includes("--clear");
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { slug: "demo-co" },
  });

  if (clear) {
    await db.payrollAdjustment.deleteMany({ where: { tenantId: tenant.id } });
    await db.payrollLine.deleteMany({ where: { tenantId: tenant.id } });
    await db.payrollRun.deleteMany({ where: { tenantId: tenant.id } });
    await db.salaryStructureLine.deleteMany({
      where: { structure: { tenantId: tenant.id } },
    });
    await db.salaryStructure.deleteMany({ where: { tenantId: tenant.id } });
    await db.salaryComponent.deleteMany({ where: { tenantId: tenant.id } });
    console.log("demo payroll cleared");
    return;
  }

  const componentIdByKey = new Map<string, string>();
  for (const def of COMPONENTS) {
    const component = await db.salaryComponent.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: def.key } },
      update: {
        name: def.name,
        kind: def.kind,
        calculation: def.calculation,
        isStatutory: def.isStatutory,
        prorated: def.prorated,
        sortOrder: def.sortOrder,
      },
      create: {
        tenantId: tenant.id,
        key: def.key,
        name: def.name,
        kind: def.kind,
        calculation: def.calculation,
        isStatutory: def.isStatutory,
        prorated: def.prorated,
        sortOrder: def.sortOrder,
      },
    });
    componentIdByKey.set(def.key, component.id);
  }

  const members = await db.tenantMembership.findMany({
    where: { tenantId: tenant.id, status: "ACTIVE" },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  // Everyone except the last member gets a structure, so the payroll
  // screen shows a real "No salary structure" exclusion too.
  const withStructure = members.slice(0, Math.max(1, members.length - 1));
  const effectiveFrom = new Date(Date.UTC(2026, 0, 1));
  const bases = [45_000, 32_000, 28_000, 22_000, 20_000];

  for (const [index, member] of withStructure.entries()) {
    const baseAmount = bases[index % bases.length];
    const existing = await db.salaryStructure.findUnique({
      where: {
        tenantId_membershipId_effectiveFrom: {
          tenantId: tenant.id,
          membershipId: member.id,
          effectiveFrom,
        },
      },
    });
    if (existing) continue;

    await db.salaryStructure.create({
      data: {
        tenantId: tenant.id,
        membershipId: member.id,
        effectiveFrom,
        baseAmount,
        lines: {
          create: COMPONENTS.map((def) => ({
            componentId: componentIdByKey.get(def.key)!,
            amount: def.amount ?? 0,
            percent: def.percent ?? 0,
          })),
        },
      },
    });
  }

  // Backfill attendance for the current month so payroll has real inputs.
  // Without history every day counts as absent and net pay goes negative —
  // correct behaviour, but not a useful demo.
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const today = new Date(Date.UTC(year, month, now.getUTCDate()));
  let created = 0;

  for (const member of withStructure) {
    for (
      let day = new Date(monthStart);
      day <= today;
      day = new Date(day.getTime() + 86_400_000)
    ) {
      // Sundays off — a placeholder weekly pattern, not a holiday calendar.
      if (day.getUTCDay() === 0) continue;

      const existing = await db.attendanceRecord.findUnique({
        where: {
          tenantId_membershipId_workDate: {
            tenantId: tenant.id,
            membershipId: member.id,
            workDate: day,
          },
        },
      });
      if (existing) continue;

      const checkIn = new Date(day);
      checkIn.setUTCMinutes(9 * 60 + 30 - 330 + (day.getUTCDate() % 5 === 0 ? 22 : -8));
      const checkOut = new Date(checkIn.getTime() + 8.5 * 3_600_000);

      await db.attendanceRecord.create({
        data: {
          tenantId: tenant.id,
          membershipId: member.id,
          workDate: day,
          checkInAt: checkIn,
          checkOutAt: checkOut,
          checkInOutcome: "INSIDE",
          lateMinutes: day.getUTCDate() % 5 === 0 ? 22 : 0,
          branchId: member.branchId,
        },
      });
      created += 1;
    }
  }

  console.log(
    `demo payroll ready — ${COMPONENTS.length} components, ${withStructure.length} structures ` +
      `(${members.length - withStructure.length} employee left without one, on purpose), ` +
      `${created} attendance records backfilled`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
