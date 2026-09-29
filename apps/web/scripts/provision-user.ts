/**
 * Dev utility: provision a login for the demo tenant.
 * Creates (or updates) a User row and an ACTIVE membership so a Supabase
 * auth account with the same email can sign in (accounts link by verified
 * email on first sign-in — see SECURITY-NOTES.md).
 *
 * Usage: npx tsx scripts/provision-user.ts <email> [roleKey] [displayName]
 *   roleKey: OWNER | SUPER_ADMIN | ADMIN | HR | MANAGER | TEAM_LEADER |
 *            EMPLOYEE | VIEWER   (default OWNER)
 */
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const [email, roleKey = "OWNER", ...nameParts] = process.argv.slice(2);
if (!email || !email.includes("@")) {
  console.error(
    "Usage: npx tsx scripts/provision-user.ts <email> [roleKey] [displayName]",
  );
  process.exit(1);
}
const displayName = nameParts.join(" ") || email.split("@")[0];

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  }),
});

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { slug: "demo-co" },
  });
  const role = await db.role.findUniqueOrThrow({
    where: { tenantId_key: { tenantId: tenant.id, key: roleKey } },
  });

  const user = await db.user.upsert({
    where: { email },
    update: { displayName, status: "ACTIVE" },
    create: { email, displayName },
  });

  await db.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: { roleId: role.id, status: "ACTIVE" },
    create: { tenantId: tenant.id, userId: user.id, roleId: role.id },
  });

  await db.auditEvent.create({
    data: {
      tenantId: tenant.id,
      actorType: "SYSTEM",
      action: "membership.provisioned",
      entityType: "user",
      entityId: user.id,
      metadata: { email, role: roleKey, via: "scripts/provision-user.ts" },
    },
  });

  console.log(
    `Provisioned ${email} as ${role.name} in "${tenant.name}". ` +
      `Sign in with a Supabase auth account using the same email.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
