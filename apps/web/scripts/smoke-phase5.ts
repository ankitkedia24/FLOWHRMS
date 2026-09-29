/**
 * Dev utility: exercise multi-location behaviour against the real
 * database — two locations, a roaming and a non-roaming employee.
 *
 * Placeholder data only, cleaned up afterwards.
 * Usage: npx tsx scripts/smoke-phase5.ts
 */
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  assessArea,
  candidateBranches,
  checkInConsequence,
  describeAttendanceRecord,
  effectiveRadiusM,
  type BranchPolicy,
} from "../src/lib/attendance/policy";
import { resolveBranchFilter } from "../src/lib/branches/filter";

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

const TENANT_DEFAULT_RADIUS = 300;

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { slug: "demo-co" },
  });

  // --- two locations, one with its own larger permitted area
  const shop = await db.branch.create({
    data: {
      tenantId: tenant.id,
      name: "Smoke Shop",
      lat: 19.1197,
      lng: 72.8468,
      radiusM: null, // inherits the tenant default
    },
  });
  const warehouse = await db.branch.create({
    data: {
      tenantId: tenant.id,
      name: "Smoke Warehouse",
      lat: 19.1422,
      lng: 72.8468,
      radiusM: 500, // its own, larger area
    },
  });

  check(
    "a location can inherit the company radius",
    effectiveRadiusM(shop.radiusM, TENANT_DEFAULT_RADIUS) === 300,
  );
  check(
    "a location can set its own radius",
    effectiveRadiusM(warehouse.radiusM, TENANT_DEFAULT_RADIUS) === 500,
  );

  const toPolicy = (b: typeof shop): BranchPolicy => ({
    id: b.id,
    name: b.name,
    lat: b.lat,
    lng: b.lng,
    radiusM: effectiveRadiusM(b.radiusM, TENANT_DEFAULT_RADIUS),
  });

  const shopPolicy = toPolicy(shop);
  const warehousePolicy = toPolicy(warehouse);
  const atWarehouse = { lat: 19.1422, lng: 72.8468, accuracyM: 15 };

  // --- non-roaming employee at the OTHER location
  const staying = candidateBranches({
    homeBranch: shopPolicy,
    activeBranches: [shopPolicy, warehousePolicy],
    canCheckInAtAnyBranch: false,
    anyBranchFeatureOn: true,
  });
  check("a non-roaming employee has one permitted area", staying.length === 1);

  const stayingArea = assessArea({
    locationRequired: true,
    branches: staying,
    coords: atWarehouse,
  });
  check(
    "at another location they are OUTSIDE their permitted area",
    stayingArea.outcome === "OUTSIDE",
    stayingArea.label,
  );
  const stayingConsequence = checkInConsequence({
    location: stayingArea,
    lateBy: 0,
    branchName: stayingArea.branch?.name,
  });
  check(
    "and must give a reason, which goes for approval",
    stayingConsequence?.requiresReason === true,
  );

  // --- roaming employee at the same place
  const roaming = candidateBranches({
    homeBranch: shopPolicy,
    activeBranches: [shopPolicy, warehousePolicy],
    canCheckInAtAnyBranch: true,
    anyBranchFeatureOn: true,
  });
  check("a roaming employee has every location", roaming.length === 2);

  const roamingArea = assessArea({
    locationRequired: true,
    branches: roaming,
    coords: atWarehouse,
  });
  check(
    "at another location they are INSIDE, no exception",
    roamingArea.outcome === "INSIDE",
    roamingArea.label,
  );
  check(
    "and the matched location is named correctly",
    roamingArea.branch?.name === "Smoke Warehouse",
  );
  check(
    "no reason is required",
    checkInConsequence({
      location: roamingArea,
      lateBy: 0,
      branchName: roamingArea.branch?.name,
    }) === null,
  );

  // --- the flag is the control, not the per-person setting
  const flagOff = candidateBranches({
    homeBranch: shopPolicy,
    activeBranches: [shopPolicy, warehousePolicy],
    canCheckInAtAnyBranch: true,
    anyBranchFeatureOn: false,
  });
  check("roaming is ignored when the feature is off", flagOff.length === 1);

  // --- a record explains itself after the location is renamed
  const membership = await db.tenantMembership.findFirstOrThrow({
    where: { tenantId: tenant.id, role: { key: "EMPLOYEE" } },
  });
  const workDate = new Date(Date.UTC(2099, 5, 1));
  const record = await db.attendanceRecord.create({
    data: {
      tenantId: tenant.id,
      membershipId: membership.id,
      workDate,
      checkInAt: new Date(),
      checkInOutcome: "INSIDE",
      branchId: warehouse.id,
      policySnapshot: {
        v: 2,
        policyVersion: 1,
        matchedBranch: {
          id: warehouse.id,
          name: "Smoke Warehouse",
          lat: 19.1422,
          lng: 72.8468,
          radiusM: 500,
        },
        radiusSource: "branch",
        consequenceSentence: null,
      },
    },
  });

  await db.branch.update({
    where: { id: warehouse.id },
    data: { name: "Smoke Warehouse (renamed)" },
  });

  const reread = await db.attendanceRecord.findUniqueOrThrow({
    where: { id: record.id },
    include: { branch: true },
  });
  const described = describeAttendanceRecord({
    snapshot: reread.policySnapshot as never,
    currentBranchName: reread.branch?.name,
  });
  check(
    "a past record keeps the location name it was recorded with",
    described.branchName === "Smoke Warehouse",
    `current name is "${reread.branch?.name}"`,
  );
  check("and knows which radius applied", described.radiusM === 500);

  // --- the filter cannot reach across tenants
  const allowed = new Set([shop.id, warehouse.id]);
  check(
    "the branch filter accepts this tenant's location",
    resolveBranchFilter(shop.id, allowed) === shop.id,
  );
  check(
    "and rejects an id from outside it",
    resolveBranchFilter("99999999-9999-4999-8999-999999999999", allowed) === null,
  );

  const leaked = await db.branch.count({
    where: { tenantId: { not: tenant.id } },
  });
  check("no locations outside the demo tenant", leaked === 0);

  // --- cleanup
  await db.attendanceRecord.delete({ where: { id: record.id } });
  await db.branch.deleteMany({
    where: { id: { in: [shop.id, warehouse.id] } },
  });
  console.log("cleanup complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
