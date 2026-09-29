/**
 * Dev utility: exercise the Phase 2 daily loop against the real database
 * so the schema, tenant scoping and status transitions can be verified
 * without clicking through every screen.
 *
 * Writes only into the demo tenant, then cleans up after itself.
 * Usage: npx tsx scripts/smoke-phase2.ts
 */
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  assessLocation,
  checkInConsequence,
  lateMinutes,
  minutesInTimezone,
  workDateInTimezone,
} from "../src/lib/attendance/policy";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  }),
});

const check = (label: string, pass: boolean) => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) process.exitCode = 1;
};

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { slug: "demo-co" },
  });
  const tz = tenant.timezone;

  const employee = await db.tenantMembership.findFirstOrThrow({
    where: { tenantId: tenant.id, role: { key: "EMPLOYEE" } },
    include: { user: true, branch: true, shift: true },
  });
  const owner = await db.tenantMembership.findFirstOrThrow({
    where: { tenantId: tenant.id, role: { key: "OWNER" } },
    include: { user: true },
  });

  check("employee has a branch", Boolean(employee.branch));
  check("employee has a shift", Boolean(employee.shift));

  const now = new Date();
  // A far-future work date so the test never collides with real or demo
  // attendance for today — the earlier version wrote to today's date and
  // silently reused whatever was already there.
  const workDate = new Date(Date.UTC(2099, 2, 1));

  // --- attendance: an outside-area check-in becomes a pending exception
  const far = assessLocation({
    locationRequired: true,
    branch: {
      name: employee.branch!.name,
      lat: employee.branch!.lat,
      lng: employee.branch!.lng,
      // radiusM is now nullable — null means "inherit the tenant default".
      radiusM: employee.branch!.radiusM ?? 300,
    },
    coords: {
      lat: employee.branch!.lat! + 0.02, // ~2.2 km away
      lng: employee.branch!.lng!,
      accuracyM: 15,
    },
  });
  check("far coordinates read as OUTSIDE", far.outcome === "OUTSIDE");

  const consequence = checkInConsequence({
    location: far,
    lateBy: lateMinutes(minutesInTimezone(now, tz), employee.shift!),
    branchName: employee.branch!.name,
  });
  check("outside-area consequence requires a reason", consequence?.requiresReason === true);

  const record = await db.attendanceRecord.upsert({
    where: {
      tenantId_membershipId_workDate: {
        tenantId: tenant.id,
        membershipId: employee.id,
        workDate,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      membershipId: employee.id,
      workDate,
      checkInAt: now,
      checkInOutcome: "OUTSIDE",
      checkInDistanceM: far.distanceM,
      checkInReason: "Smoke test — on a delivery run",
      lateMinutes: lateMinutes(minutesInTimezone(now, tz), employee.shift!),
      reviewStatus: "PENDING",
      branchId: employee.branchId,
    },
  });
  check("attendance record created as PENDING", record.reviewStatus === "PENDING");

  // Idempotency: the unique key must prevent a second record for the day.
  const duplicate = await db.attendanceRecord.findMany({
    where: { tenantId: tenant.id, membershipId: employee.id, workDate },
  });
  check("only one record exists for the work date", duplicate.length === 1);

  const reviewed = await db.attendanceRecord.update({
    where: { id: record.id },
    data: {
      reviewStatus: "APPROVED",
      reviewedById: owner.id,
      reviewedAt: new Date(),
      reviewReason: "Smoke test approval",
    },
  });
  check("exception approved", reviewed.reviewStatus === "APPROVED");

  // --- leave: request then approve as unpaid
  const leave = await db.leaveRequest.create({
    data: {
      tenantId: tenant.id,
      membershipId: employee.id,
      type: "FULL_DAY",
      startDate: new Date("2099-01-10T00:00:00.000Z"),
      endDate: new Date("2099-01-11T00:00:00.000Z"),
      reason: "Smoke test",
      unpaidDays: 2,
    },
  });
  check("leave request is PENDING with 2 unpaid days", leave.status === "PENDING" && leave.unpaidDays === 2);

  const decided = await db.leaveRequest.update({
    where: { id: leave.id },
    data: {
      status: "APPROVED",
      paid: false,
      decidedById: owner.id,
      decidedAt: new Date(),
      decisionReason: "Smoke test",
    },
  });
  check("leave approved as unpaid", decided.status === "APPROVED" && decided.paid === false);

  // --- tasks: create → start → proof → approve
  const task = await db.task.create({
    data: {
      tenantId: tenant.id,
      createdById: owner.id,
      assigneeId: employee.id,
      title: "Smoke test task",
      priority: "MEDIUM",
      proofRequirement: "PHOTO",
    },
  });
  check("task starts NOT_STARTED", task.status === "NOT_STARTED");

  await db.task.update({
    where: { id: task.id },
    data: { status: "IN_PROGRESS", startedAt: new Date() },
  });

  const proof = await db.taskProof.create({
    data: {
      tenantId: tenant.id,
      taskId: task.id,
      submittedById: employee.id,
      note: "Smoke test proof",
      files: {
        create: [
          {
            tenantId: tenant.id,
            path: `${task.id}/smoke.jpg`,
            name: "smoke.jpg",
            mime: "image/jpeg",
            sizeBytes: 1024,
          },
        ],
      },
    },
    include: { files: true },
  });
  check("proof stored with a file", proof.files.length === 1);

  await db.task.update({
    where: { id: task.id },
    data: { status: "SUBMITTED_FOR_REVIEW" },
  });
  await db.taskProof.update({
    where: { id: proof.id },
    data: { decision: "APPROVED", decidedById: owner.id, decidedAt: new Date() },
  });
  const completed = await db.task.update({
    where: { id: task.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  check("task completed after proof approval", completed.status === "COMPLETED");

  // --- notifications
  const notification = await db.notification.create({
    data: {
      tenantId: tenant.id,
      userId: employee.userId,
      title: "Smoke test notification",
      href: "/tasks",
    },
  });
  const unread = await db.notification.count({
    where: { tenantId: tenant.id, userId: employee.userId, readAt: null },
  });
  check("unread notification counted", unread >= 1);

  // --- tenant isolation: nothing leaks across tenants
  const otherTenantRows = await db.attendanceRecord.count({
    where: { tenantId: { not: tenant.id } },
  });
  check("no attendance rows outside the demo tenant", otherTenantRows === 0);

  // --- cleanup
  await db.notification.delete({ where: { id: notification.id } });
  await db.proofFile.deleteMany({ where: { proofId: proof.id } });
  await db.taskProof.delete({ where: { id: proof.id } });
  await db.task.delete({ where: { id: task.id } });
  await db.leaveRequest.delete({ where: { id: leave.id } });
  await db.attendanceRecord.delete({ where: { id: record.id } });
  console.log("cleanup complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
