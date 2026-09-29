/**
 * Grant or revoke Platform Super Admin.
 *
 * This is the only privilege in FlowHRMS that crosses company boundaries, and
 * nothing inside the product can hand it out — no role, no permission, no
 * screen. It is set here, deliberately, so that granting it is a decision
 * someone makes at a terminal with the database in front of them rather
 * than a checkbox that can be clicked by mistake.
 *
 * It does NOT let anyone act inside a customer's company. There is no
 * impersonation; what it opens is the operator's own area — the list of
 * companies, creating one, suspending one, and the enquiry inbox.
 *
 * Usage:
 *   npx tsx scripts/grant-platform-admin.ts --email you@example.com
 *   npx tsx scripts/grant-platform-admin.ts --email you@example.com --revoke
 *   npx tsx scripts/grant-platform-admin.ts --list
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { getDb } from "../src/lib/db";
import { normaliseEmail } from "../src/lib/invites/policy";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const revoke = process.argv.includes("--revoke");
const list = process.argv.includes("--list");

async function main() {
  const db = getDb();

  if (list) {
    const admins = await db.user.findMany({
      where: { isPlatformAdmin: true },
      select: { email: true, displayName: true },
    });
    console.log(
      admins.length
        ? admins.map((a) => `  ${a.displayName} <${a.email}>`).join("\n")
        : "  (nobody — the platform area is unreachable)",
    );
    return;
  }

  const emailArg = arg("email");
  if (!emailArg) {
    console.error("Required: --email <address>   (or --list, or add --revoke)");
    process.exit(1);
  }
  const email = normaliseEmail(emailArg);

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user with that email. They must sign in to FlowHRMS first.`);
    process.exit(1);
  }
  if (user.isPlatformAdmin === !revoke) {
    console.log(
      `${user.displayName} is already ${revoke ? "not " : ""}a platform admin. Nothing changed.`,
    );
    return;
  }

  await db.user.update({
    where: { id: user.id },
    data: { isPlatformAdmin: !revoke },
  });

  // Platform-level: this event belongs to no company.
  await db.auditEvent.create({
    data: {
      tenantId: null,
      actorType: "SYSTEM",
      action: revoke ? "platform_admin.revoked" : "platform_admin.granted",
      entityType: "user",
      entityId: user.id,
      metadata: { email, via: "scripts/grant-platform-admin.ts" },
    },
  });

  console.log(
    revoke
      ? `Revoked. ${user.displayName} can no longer open the platform area.`
      : `Granted. ${user.displayName} can now open /platform.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
