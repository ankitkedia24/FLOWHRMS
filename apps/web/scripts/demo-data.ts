/**
 * Dev utility: create a small amount of realistic activity in the demo
 * tenant so screens can be reviewed with content rather than empty states.
 *
 * Placeholder people only — never real employees. Safe to re-run.
 * Usage: npx tsx scripts/demo-data.ts [--clear]
 */
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { workDateInTimezone } from "../src/lib/attendance/policy";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  }),
});

const DEMO_TAG = "[demo]";

async function main() {
  const clear = process.argv.includes("--clear");
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { slug: "demo-co" },
  });

  if (clear) {
    await db.proofFile.deleteMany({ where: { tenantId: tenant.id } });
    await db.taskProof.deleteMany({ where: { tenantId: tenant.id } });
    await db.task.deleteMany({ where: { tenantId: tenant.id } });
    await db.leaveRequest.deleteMany({ where: { tenantId: tenant.id } });
    await db.attendanceRecord.deleteMany({ where: { tenantId: tenant.id } });
    await db.notification.deleteMany({ where: { tenantId: tenant.id } });
    console.log("demo data cleared");
    return;
  }

  const tz = tenant.timezone;
  const members = await db.tenantMembership.findMany({
    where: { tenantId: tenant.id, status: "ACTIVE" },
    include: { user: true, role: true, branch: true, shift: true },
    orderBy: { createdAt: "asc" },
  });

  const owner = members.find((m) => m.role.key === "OWNER")!;
  const staff = members.filter((m) => m.role.key !== "OWNER");
  const today = workDateInTimezone(new Date(), tz);

  // Attendance for today: present, late, and one outside-area exception.
  const shapes = [
    { offsetMin: -12, outcome: "INSIDE" as const, late: 0 },
    { offsetMin: 18, outcome: "INSIDE" as const, late: 18 },
    {
      offsetMin: 4,
      outcome: "OUTSIDE" as const,
      late: 0,
      distance: 1400,
      reason: "On a delivery run near Warehouse 2",
    },
  ];

  for (const [index, member] of staff.entries()) {
    const shape = shapes[index % shapes.length];
    const shiftStart = member.shift?.startMinutes ?? 570;
    const checkIn = new Date();
    checkIn.setUTCHours(0, 0, 0, 0);
    // shift start in IST → UTC, plus the offset
    checkIn.setUTCMinutes(shiftStart - 330 + shape.offsetMin);

    await db.attendanceRecord.upsert({
      where: {
        tenantId_membershipId_workDate: {
          tenantId: tenant.id,
          membershipId: member.id,
          workDate: today,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        membershipId: member.id,
        workDate: today,
        checkInAt: checkIn,
        checkInOutcome: shape.outcome,
        checkInDistanceM: shape.distance ?? 40,
        checkInReason: shape.reason,
        lateMinutes: shape.late,
        reviewStatus: shape.outcome === "OUTSIDE" ? "PENDING" : "NONE",
        branchId: member.branchId,
      },
    });
  }

  // A pending leave request.
  const leaveOwner = staff[0];
  if (leaveOwner) {
    const existing = await db.leaveRequest.findFirst({
      where: { tenantId: tenant.id, reason: { startsWith: DEMO_TAG } },
    });
    if (!existing) {
      await db.leaveRequest.create({
        data: {
          tenantId: tenant.id,
          membershipId: leaveOwner.id,
          type: "FULL_DAY",
          startDate: new Date("2026-08-12T00:00:00.000Z"),
          endDate: new Date("2026-08-13T00:00:00.000Z"),
          reason: `${DEMO_TAG} Family function out of town`,
          unpaidDays: 2,
        },
      });
    }
  }

  // Tasks in a few states, including one awaiting proof review.
  const assignee = staff.find((m) => m.role.key === "EMPLOYEE") ?? staff[0];
  if (assignee) {
    const existingTasks = await db.task.count({
      where: { tenantId: tenant.id, title: { startsWith: DEMO_TAG } },
    });
    if (existingTasks === 0) {
      await db.task.create({
        data: {
          tenantId: tenant.id,
          createdById: owner.id,
          assigneeId: assignee.id,
          title: `${DEMO_TAG} Deliver order #4821`,
          description: "Counter pickup, hand over to the shop supervisor.",
          priority: "HIGH",
          dueDate: today,
          proofRequirement: "PHOTO",
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
      });
      await db.task.create({
        data: {
          tenantId: tenant.id,
          createdById: owner.id,
          assigneeId: assignee.id,
          title: `${DEMO_TAG} Stock count — hardware aisle`,
          priority: "MEDIUM",
          proofRequirement: "NONE",
          status: "NOT_STARTED",
        },
      });

      const reviewTask = await db.task.create({
        data: {
          tenantId: tenant.id,
          createdById: owner.id,
          assigneeId: assignee.id,
          title: `${DEMO_TAG} Collect signed challan from Warehouse 2`,
          priority: "MEDIUM",
          proofRequirement: "FILE",
          status: "SUBMITTED_FOR_REVIEW",
          startedAt: new Date(),
        },
      });
      await db.taskProof.create({
        data: {
          tenantId: tenant.id,
          taskId: reviewTask.id,
          submittedById: assignee.id,
          note: "Signed copy attached, collected at 3:14 PM.",
          files: {
            create: [
              {
                tenantId: tenant.id,
                path: `${reviewTask.id}/challan-4821.pdf`,
                name: "challan-4821.pdf",
                mime: "application/pdf",
                sizeBytes: 284_113,
              },
            ],
          },
        },
      });
    }
  }

  // A couple of notifications for the owner.
  const notifications = await db.notification.count({
    where: { tenantId: tenant.id, userId: owner.userId },
  });
  if (notifications === 0) {
    await db.notification.createMany({
      data: [
        {
          tenantId: tenant.id,
          userId: owner.userId,
          title: "Attendance needs your review",
          body: "One check-in was outside the permitted area.",
          href: "/admin/attendance",
        },
        {
          tenantId: tenant.id,
          userId: owner.userId,
          title: "Proof submitted for review",
          body: "Collect signed challan from Warehouse 2",
          href: "/admin/tasks",
        },
      ],
    });
  }

  const counts = await Promise.all([
    db.attendanceRecord.count({ where: { tenantId: tenant.id } }),
    db.leaveRequest.count({ where: { tenantId: tenant.id } }),
    db.task.count({ where: { tenantId: tenant.id } }),
    db.notification.count({ where: { tenantId: tenant.id } }),
  ]);
  console.log(
    `demo data ready — attendance ${counts[0]}, leave ${counts[1]}, tasks ${counts[2]}, notifications ${counts[3]}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
