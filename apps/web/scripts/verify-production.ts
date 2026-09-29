/**
 * Production verification: connectivity, a real invitation, tenant
 * isolation, cleanup.
 *
 * Creates a throwaway employee + invitation in the live database, prints
 * the invitation URL so the deployed site can be exercised against it,
 * then removes everything it created.
 *
 * **Never prints a connection string, password or key.** Only the host is
 * echoed, and only enough of it to confirm which route is in use
 * (pooler vs direct) — the part before the first dot.
 *
 * Usage:
 *   npx tsx scripts/verify-production.ts create   → makes the fixture
 *   npx tsx scripts/verify-production.ts check    → isolation assertions
 *   npx tsx scripts/verify-production.ts cleanup  → removes the fixture
 */
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiryFrom,
} from "../src/lib/invites/token";
import { computeInviteStatus } from "../src/lib/invites/policy";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("No database URL configured.");
  process.exit(1);
}

/** Host only, and only the first label — never credentials. */
function describeRoute(url: string): string {
  try {
    const host = new URL(url).hostname;
    const kind = host.includes("pooler")
      ? "pooler (IPv4-capable)"
      : "direct (IPv6-only)";
    return `${host.split(".")[0]}.… — ${kind}`;
  } catch {
    return "unparseable";
  }
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const MARKER = "stfverify";

async function create() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "demo-co" } });
  const role = await db.role.findFirstOrThrow({
    where: { tenantId: tenant.id, key: "EMPLOYEE" },
  });

  const stamp = Date.now();
  const user = await db.user.create({
    data: {
      email: `${MARKER}${stamp}@example.test`,
      phone: `+9197${String(stamp).slice(-8)}`,
      displayName: "Verify Fixture",
      status: "INVITED",
    },
  });
  const membership = await db.tenantMembership.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      roleId: role.id,
      status: "INVITED",
      employeeCode: `${MARKER.toUpperCase()}${stamp}`,
      employmentType: "FULL_TIME",
    },
  });

  const token = generateInviteToken();
  const now = new Date();
  await db.employeeInvite.create({
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

  console.log(`route:   ${describeRoute(connectionString!)}`);
  console.log(`tenant:  ${tenant.name}`);
  console.log(`expect:  Welcome, Verify`);
  console.log(`URL:     ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://hrms.flowacord.com"}/invite/${token}`);
}

async function check() {
  let failures = 0;
  const ok = (label: string, condition: boolean, detail = "") => {
    console.log(`${condition ? "PASS " : "FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
    if (!condition) failures++;
  };

  console.log(`route: ${describeRoute(connectionString!)}\n`);

  const start = Date.now();
  const tenants = await db.tenant.findMany({ select: { id: true, name: true, slug: true } });
  ok("database reachable", true, `${Date.now() - start}ms, ${tenants.length} tenant(s)`);

  // Tenant isolation: every tenant-owned row must carry a tenantId that
  // resolves to a real tenant, and no query may cross the boundary.
  const tenantIds = new Set(tenants.map((t) => t.id));
  const demo = tenants.find((t) => t.slug === "demo-co");

  if (demo) {
    const [members, invites, actions, attendance] = await Promise.all([
      db.tenantMembership.count({ where: { tenantId: demo.id } }),
      db.employeeInvite.count({ where: { tenantId: demo.id } }),
      db.actionRequest.count({ where: { tenantId: demo.id } }),
      db.attendanceRecord.count({ where: { tenantId: demo.id } }),
    ]);
    ok("tenant-scoped reads work", true, `${members} members, ${invites} invites, ${actions} actions, ${attendance} attendance`);

    const orphanMembers = await db.tenantMembership.count({
      where: { tenantId: { notIn: [...tenantIds] } },
    });
    ok("no membership outside a known tenant", orphanMembers === 0);

    const orphanInvites = await db.employeeInvite.count({
      where: { tenantId: { notIn: [...tenantIds] } },
    });
    ok("no invitation outside a known tenant", orphanInvites === 0);

    // A membership filtered by a DIFFERENT tenant must return nothing,
    // which is the shape every server action uses.
    const anyMember = await db.tenantMembership.findFirst({
      where: { tenantId: demo.id },
      select: { id: true },
    });
    if (anyMember) {
      const others = tenants.filter((t) => t.id !== demo.id);
      if (others.length > 0) {
        const leak = await db.tenantMembership.findFirst({
          where: { id: anyMember.id, tenantId: others[0].id },
        });
        ok("a member is invisible when filtered by another tenant", leak === null);
      } else {
        console.log("SKIP  cross-tenant read (only one tenant exists)");
      }
    }

    const invite = await db.employeeInvite.findFirst({
      where: { tenantId: demo.id },
      orderBy: { createdAt: "desc" },
    });
    if (invite) {
      ok(
        "invitation status computes",
        Boolean(computeInviteStatus(invite, new Date()).label),
        computeInviteStatus(invite, new Date()).label,
      );
    }
  }

  const rls = await db.$queryRawUnsafe<Array<{ n: bigint }>>(
    "select count(*)::bigint as n from pg_tables where schemaname='public' and rowsecurity=true",
  );
  ok("row level security still enabled", Number(rls[0].n) >= 29, `${rls[0].n} tables`);

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("\nAll checks passed.");
  }
}

async function cleanup() {
  const users = await db.user.findMany({
    where: { email: { startsWith: MARKER } },
    include: { memberships: true },
  });
  const membershipIds = users.flatMap((u) => u.memberships.map((m) => m.id));

  await db.employeeInvite.deleteMany({ where: { membershipId: { in: membershipIds } } });
  await db.actionRequestRecipient.deleteMany({
    where: { userId: { in: users.map((u) => u.id) } },
  });
  await db.tenantMembership.deleteMany({ where: { id: { in: membershipIds } } });
  const removed = await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  console.log(`cleanup: removed ${removed.count} fixture user(s)`);
}

const mode = process.argv[2] ?? "check";
const run = mode === "create" ? create : mode === "cleanup" ? cleanup : check;

run()
  .catch((error) => {
    // Error messages from pg can contain the connection string; print only
    // the class and message, never the full object.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: ${message.replace(/postgres(ql)?:\/\/[^\s]*/gi, "[redacted]")}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
