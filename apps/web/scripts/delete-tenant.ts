/**
 * Delete a company and everything belonging to it.
 *
 * Written for one specific job — removing the seeded demo tenant from a
 * production database before a real customer arrives — but it works for
 * any tenant, which is exactly why it is careful:
 *
 * - Requires the slug AND `--confirm <slug>` typed again. A single
 *   mistyped flag should not destroy a customer.
 * - Prints the full inventory and makes you look at it before writing.
 * - Refuses if the tenant is not the one you named.
 *
 * The deletion itself lives in src/lib/platform/purge.ts, shared with the
 * sample-data script. The guards are this file's job; knowing the order of
 * the constraint graph is not, and a second copy of that order would go
 * stale the moment a table is added — which is exactly what happened once
 * already, when performance events appeared and this cascade did not know
 * about them.
 *
 * This is genuinely destructive. The demo tenant is reversible with
 * `npx prisma db seed`; a real one is not.
 *
 * Usage (npm, not npx — see scripts/tsconfig.json for why):
 *   npm run delete-tenant -- --slug demo-co                   (dry run)
 *   npm run delete-tenant -- --slug demo-co --confirm demo-co
 */
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { purgeTenant } from "../src/lib/platform/purge";

loadEnv({ path: [".env.local", ".env"], quiet: true });

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const slug = arg("slug");
const confirm = arg("confirm");

if (!slug) {
  console.error("Required: --slug <tenant-slug>   (add --confirm <slug> to actually delete)");
  process.exit(1);
}

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  }),
});

async function main() {
  const tenant = await db.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`No company with slug "${slug}".`);

  const t = { tenantId: tenant.id };
  const counts = {
    memberships: await db.tenantMembership.count({ where: t }),
    attendance: await db.attendanceRecord.count({ where: t }),
    leave: await db.leaveRequest.count({ where: t }),
    tasks: await db.task.count({ where: t }),
    invites: await db.employeeInvite.count({ where: t }),
    departments: await db.department.count({ where: t }),
    branches: await db.branch.count({ where: t }),
    payrollRuns: await db.payrollRun.count({ where: t }),
    documents: await db.employeeDocument.count({ where: t }),
    notifications: await db.notification.count({ where: t }),
    auditEvents: await db.auditEvent.count({ where: t }),
  };

  console.log(`Company: ${tenant.name}  (slug ${tenant.slug})`);
  for (const [k, v] of Object.entries(counts)) {
    if (v > 0) console.log(`  ${k.padEnd(14)} ${v}`);
  }

  if (confirm !== slug) {
    console.log(
      `\nDRY RUN — nothing deleted.\nTo delete, re-run with:  --slug ${slug} --confirm ${slug}`,
    );
    return;
  }

  const removed = await purgeTenant(db, tenant.id);

  console.log(`\nDeleted ${tenant.name} and ${removed.memberships} membership(s).`);
  console.log(
    `Orphaned logins removed (${removed.orphanedUsersRemoved}); ` +
      "logins shared with another company kept.",
  );
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: ${message.replace(/postgres(ql)?:\/\/\S*/gi, "[redacted]")}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
