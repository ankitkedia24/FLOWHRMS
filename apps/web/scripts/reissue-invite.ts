/**
 * Issue a fresh invitation link for someone who already has an account.
 *
 * This is the way back in when the person who would normally press
 * "Resend invitation" is the one locked out — an owner who has forgotten
 * their password, or any account whose email cannot receive mail (the
 * sample company uses `.example` addresses on purpose, so password reset
 * has nowhere to go).
 *
 * It sets NOBODY's password. It mints a one-time link; the person opens it
 * and chooses their own password on that page, exactly as they would from
 * an invitation email. For an account that already has a sign-in, the
 * accept flow updates the password — so this doubles as the reset path
 * when email delivery is not an option.
 *
 * The steps mirror `issueInvite` in src/lib/invites/actions.ts, which is
 * what the admin UI calls: any previous PENDING invite is REVOKED first,
 * so exactly one link is ever live, and the resend count carries over.
 * Only the email delivery is skipped — the link is printed instead.
 *
 * Usage (npm, not npx — see scripts/tsconfig.json for why):
 *   npm run reissue-invite -- --email someone@company.example
 *   npm run reissue-invite -- --email x@y.example --slug acme --origin http://localhost:3000
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { getDb } from "../src/lib/db";
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiryFrom,
  inviteUrl,
} from "../src/lib/invites/token";
import { normaliseEmail } from "../src/lib/invites/policy";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const email = arg("email");
const slug = arg("slug");
const origin =
  arg("origin") ??
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

if (!email) {
  console.error(
    "Required: --email <address>\n" +
      "Optional: --slug <tenant>  (only needed if the address belongs to more than one company)\n" +
      "          --origin <url>   (defaults to NEXT_PUBLIC_SITE_URL)",
  );
  process.exit(1);
}

async function main() {
  const db = getDb();
  const address = normaliseEmail(email!);

  const memberships = await db.tenantMembership.findMany({
    where: {
      user: { email: address },
      ...(slug ? { tenant: { slug } } : {}),
    },
    include: { user: true, tenant: true, role: true },
  });

  if (memberships.length === 0) {
    console.error(
      `No account found for ${address}${slug ? ` in "${slug}"` : ""}.`,
    );
    process.exitCode = 1;
    return;
  }
  // One login can legitimately belong to several companies. Refuse rather
  // than guess which one to let someone back into.
  if (memberships.length > 1) {
    console.error(
      `${address} belongs to ${memberships.length} companies. Name one with --slug:\n` +
        memberships.map((m) => `  ${m.tenant.slug}  (${m.tenant.name})`).join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  const membership = memberships[0];
  if (membership.status === "DEACTIVATED") {
    console.error(
      `That account is deactivated in ${membership.tenant.name}. Reactivate it before inviting again.`,
    );
    process.exitCode = 1;
    return;
  }

  // Said out loud before the link is printed, so a mistyped address is
  // obvious rather than discovered by the wrong person receiving access.
  console.log(`Company : ${membership.tenant.name}  (${membership.tenant.slug})`);
  console.log(`Person  : ${membership.user.displayName} <${address}>`);
  console.log(`Role    : ${membership.role.name}`);
  console.log(
    `Sign-in : ${membership.user.authUserId ? "exists — this link RESETS the password" : "not set up yet — this link creates it"}`,
  );

  const token = generateInviteToken();
  const now = new Date();

  const previous = await db.employeeInvite.findFirst({
    where: { membershipId: membership.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  await db.$transaction(async (tx) => {
    if (previous) {
      await tx.employeeInvite.update({
        where: { id: previous.id },
        data: { status: "REVOKED", revokedAt: now },
      });
    }
    await tx.employeeInvite.create({
      data: {
        tenantId: membership.tenantId,
        membershipId: membership.id,
        tokenHash: hashInviteToken(token),
        channel: "EMAIL",
        status: "PENDING",
        sentToEmail: address,
        expiresAt: inviteExpiryFrom(now),
        sentAt: now,
        resendCount: (previous?.resendCount ?? 0) + 1,
        lastResendAt: now,
      },
    });
    await tx.auditEvent.create({
      data: {
        tenantId: membership.tenantId,
        actorType: "SYSTEM",
        action: "employee.invite_resent",
        entityType: "membership",
        entityId: membership.id,
        metadata: {
          to: address,
          attempt: (previous?.resendCount ?? 0) + 1,
          via: "scripts/reissue-invite.ts",
          delivered: false,
        },
      },
    });
  });

  console.log(
    `\nOpen this once, within 7 days. It replaces any earlier link:\n\n  ${inviteUrl(origin, token)}\n`,
  );
  console.log("The password is chosen on that page. Nobody else sees it.");
  if (previous) console.log("The previous pending link has been revoked.");
}

main()
  .catch((e) => {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`FAILED: ${message.replace(/postgres(ql)?:\/\/\S*/gi, "[redacted]")}`);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
