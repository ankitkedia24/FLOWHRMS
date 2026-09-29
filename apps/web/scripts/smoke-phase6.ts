/**
 * Smoke test: employee invitation and the action-tile queue.
 *
 * Exercises the parts a browser click-through cannot reach cheaply — token
 * hashing, single use, expiry, tenant isolation and audience routing —
 * against the real database, then cleans up after itself.
 *
 * Deliberately does NOT create Supabase auth users: that would leave real
 * accounts behind in a shared project. The auth step is covered by the
 * manual browser pass (ACCEPTANCE.md §L).
 *
 * Usage: npx tsx scripts/smoke-phase6.ts
 */
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiryFrom,
} from "../src/lib/invites/token";
import {
  canResendInvite,
  computeInviteStatus,
  isInviteRedeemable,
} from "../src/lib/invites/policy";
import { resolveAudience } from "../src/lib/actions/audience";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  }),
});

let failures = 0;
function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const STAMP = `smoke6-${Date.now()}`;
const created = { userIds: [] as string[], membershipIds: [] as string[] };

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "demo-co" } });
  const otherTenant = await db.tenant.findFirst({
    where: { slug: { not: "demo-co" } },
  });
  const employeeRole = await db.role.findFirstOrThrow({
    where: { tenantId: tenant.id, key: "EMPLOYEE" },
  });

  // ---------------------------------------------------------------- invite
  const user = await db.user.create({
    data: {
      email: `${STAMP}@example.test`,
      phone: `+9199${String(Date.now()).slice(-8)}`,
      displayName: "Smoke Six",
      status: "INVITED",
    },
  });
  created.userIds.push(user.id);

  const membership = await db.tenantMembership.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      roleId: employeeRole.id,
      status: "INVITED",
      employeeCode: STAMP.toUpperCase(),
      employmentType: "CONTRACT",
    },
  });
  created.membershipIds.push(membership.id);

  const token = generateInviteToken();
  const now = new Date();
  const invite = await db.employeeInvite.create({
    data: {
      tenantId: tenant.id,
      membershipId: membership.id,
      tokenHash: hashInviteToken(token),
      channel: "EMAIL",
      status: "PENDING",
      sentToEmail: user.email,
      expiresAt: inviteExpiryFrom(now),
      sentAt: now,
    },
  });

  check(
    "the raw token is nowhere in the database",
    !(await db.employeeInvite.findFirst({ where: { tokenHash: token } })),
  );

  const found = await db.employeeInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
  });
  check("the token finds its invitation by hash", found?.id === invite.id);

  check(
    "a wrong token finds nothing",
    !(await db.employeeInvite.findUnique({
      where: { tokenHash: hashInviteToken(generateInviteToken()) },
    })),
  );

  check(
    "a live invitation reads as Pending",
    computeInviteStatus(
      { status: invite.status, expiresAt: invite.expiresAt },
      now,
    ).label === "Pending",
  );

  check(
    "a live invitation is redeemable",
    isInviteRedeemable(
      { status: invite.status, expiresAt: invite.expiresAt },
      now,
    ).ok,
  );

  // ---------------------------------------------------------------- expiry
  const expired = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
  check(
    "the same row reads as Expired a week later, with no job having run",
    computeInviteStatus(
      { status: invite.status, expiresAt: invite.expiresAt },
      expired,
    ).label === "Expired",
  );
  check(
    "an expired invitation can still be resent",
    canResendInvite({ status: "PENDING", resendCount: 0 }, expired).allowed,
  );

  // ------------------------------------------------------------ single use
  const first = await db.employeeInvite.updateMany({
    where: { id: invite.id, status: "PENDING" },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
  const second = await db.employeeInvite.updateMany({
    where: { id: invite.id, status: "PENDING" },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
  check("the first acceptance claims the invitation", first.count === 1);
  check("a replayed acceptance claims nothing", second.count === 0);

  check(
    "an accepted invitation cannot be redeemed again",
    !isInviteRedeemable({ status: "ACCEPTED", expiresAt: invite.expiresAt }, now)
      .ok,
  );
  check(
    "an accepted invitation cannot be resent",
    !canResendInvite({ status: "ACCEPTED", resendCount: 0 }, now).allowed,
  );

  // ------------------------------------------------------------- isolation
  if (otherTenant) {
    const leak = await db.employeeInvite.findFirst({
      where: { id: invite.id, tenantId: otherTenant.id },
    });
    check("another tenant cannot load this invitation", leak === null);
  } else {
    console.log("SKIP  cross-tenant check (only one tenant in this database)");
  }

  check(
    "no invite rows exist outside the demo tenant for this run",
    (await db.employeeInvite.count({
      where: { membershipId: membership.id, tenantId: { not: tenant.id } },
    })) === 0,
  );

  // --------------------------------------------------------- duplicate ids
  let duplicateRejected = false;
  try {
    await db.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: (
          await db.user.create({
            data: { displayName: "Dup", status: "INVITED" },
          })
        ).id,
        roleId: employeeRole.id,
        employeeCode: STAMP.toUpperCase(),
      },
    });
  } catch {
    duplicateRejected = true;
  }
  check(
    "the database refuses a second employee ID in the same company",
    duplicateRejected,
  );

  // ------------------------------------------------------------- audience
  const department = await db.department.create({
    data: { tenantId: tenant.id, name: `Smoke Dept ${STAMP}`, headId: membership.id },
  });

  const approvers = await db.tenantMembership.findMany({
    where: {
      tenantId: tenant.id,
      status: "ACTIVE",
      role: { permissions: { some: { permission: { key: "leave.approve" } } } },
    },
    include: { user: true },
  });

  const recipients = resolveAudience({
    candidates: approvers.map((m) => ({
      userId: m.userId,
      membershipId: m.id,
      displayName: m.user.displayName,
      canDecide: true,
      isDepartmentHead: m.id === membership.id,
    })),
    aboutUserId: approvers[0]?.userId,
    departmentName: department.name,
  });

  check(
    "the person a request is about is never asked to decide it",
    approvers.length === 0 ||
      !recipients.some((r) => r.userId === approvers[0].userId),
  );
  check(
    "every recipient is told why it reached them",
    recipients.every((r) => r.reason.length > 0),
  );

  // -------------------------------------------------------- action request
  const request = await db.actionRequest.create({
    data: {
      tenantId: tenant.id,
      kind: "LEAVE_REQUEST",
      subjectType: "leave_request",
      subjectId: department.id, // any uuid; this row is never rendered
      aboutMembershipId: membership.id,
      title: "Smoke — leave request",
      href: "/admin/leave",
      recipients: {
        create: { tenantId: tenant.id, userId: user.id, reason: "Smoke test" },
      },
    },
  });

  const visible = await db.actionRequestRecipient.count({
    where: {
      tenantId: tenant.id,
      userId: user.id,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }],
      actionRequest: { status: { in: ["PENDING", "SNOOZED"] } },
    },
  });
  check("a raised request is visible to its recipient", visible === 1);

  await db.actionRequestRecipient.updateMany({
    where: { actionRequestId: request.id, userId: user.id },
    data: { snoozedUntil: new Date(Date.now() + 60 * 60 * 1000), snoozeCount: 1 },
  });
  const afterSnooze = await db.actionRequestRecipient.count({
    where: {
      tenantId: tenant.id,
      userId: user.id,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }],
      actionRequest: { status: { in: ["PENDING", "SNOOZED"] } },
    },
  });
  check("a snoozed request disappears for that person", afterSnooze === 0);

  const raisedTwice = await db.actionRequest.upsert({
    where: {
      tenantId_subjectType_subjectId: {
        tenantId: tenant.id,
        subjectType: "leave_request",
        subjectId: department.id,
      },
    },
    create: {
      tenantId: tenant.id,
      kind: "LEAVE_REQUEST",
      subjectType: "leave_request",
      subjectId: department.id,
      title: "duplicate",
      href: "/admin/leave",
    },
    update: { status: "PENDING" },
  });
  check(
    "raising the same subject twice reuses one row",
    raisedTwice.id === request.id,
  );

  await db.actionRequest.updateMany({
    where: { id: request.id },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolution: "APPROVED" },
  });
  const afterResolve = await db.actionRequestRecipient.count({
    where: {
      tenantId: tenant.id,
      userId: user.id,
      actionRequest: { status: { in: ["PENDING", "SNOOZED"] } },
    },
  });
  check("resolving clears the tile for everyone", afterResolve === 0);

  // ---------------------------------------------------------------- tidy up
  await db.actionRequestRecipient.deleteMany({ where: { actionRequestId: request.id } });
  await db.actionRequest.delete({ where: { id: request.id } });
  await db.department.update({ where: { id: department.id }, data: { headId: null } });
  await db.department.delete({ where: { id: department.id } });
  await db.employeeInvite.deleteMany({ where: { membershipId: membership.id } });
  await db.tenantMembership.deleteMany({
    where: { employeeCode: STAMP.toUpperCase() },
  });
  await db.user.deleteMany({
    where: { OR: [{ id: { in: created.userIds } }, { displayName: "Dup" }] },
  });
  console.log("cleanup complete");
}

main()
  .catch((error) => {
    console.error(error);
    failures++;
  })
  .finally(async () => {
    await db.$disconnect();
    if (failures > 0) {
      console.error(`\n${failures} check(s) failed.`);
      process.exit(1);
    }
    console.log("\nAll checks passed.");
  });
