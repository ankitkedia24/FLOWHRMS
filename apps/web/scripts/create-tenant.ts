/**
 * Create a real company and its owner, from the command line.
 *
 * The creation itself lives in src/lib/platform/provision.ts, shared with
 * the platform area's "Add a company" screen. Onboarding a paying customer
 * is not a thing that should exist twice: a second copy would drift, and
 * the first symptom would be a customer whose roles or module entitlements
 * are quietly wrong.
 *
 * Nobody's password is set here and no Supabase secret key is needed — the
 * accept flow creates the auth account when the invitation is redeemed. So
 * this cannot leak a credential, and the owner is onboarded through exactly
 * the flow their staff will use.
 *
 * Usage (npm, not npx — see scripts/tsconfig.json for why):
 *   npm run create-tenant -- \
 *     --name "Acme Hardware" \
 *     --owner-email owner@acme.example \
 *     --owner-name "Priya Shah" \
 *     [--slug acme-hardware] [--timezone Asia/Kolkata] [--dry-run]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { getDb } from "../src/lib/db";
import { provisionTenant } from "../src/lib/platform/provision";
import { slugify } from "../src/lib/platform/slug";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const dryRun = process.argv.includes("--dry-run");

const name = arg("name");
const ownerEmail = arg("owner-email");
const ownerName = arg("owner-name");
const timezone = arg("timezone") ?? "Asia/Kolkata";
const origin =
  arg("origin") ??
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://hrms.flowacord.com";

if (!name || !ownerEmail || !ownerName) {
  console.error(
    "Required: --name <company> --owner-email <email> --owner-name <person>\n" +
      "Optional: --slug --timezone (default Asia/Kolkata) --origin --dry-run",
  );
  process.exit(1);
}

const slug = arg("slug") ?? slugify(name);

async function main() {
  const db = getDb();

  console.log(`Company : ${name}  (slug ${slug}, ${timezone})`);
  console.log(`Owner   : ${ownerName} <${ownerEmail}>`);
  if (dryRun) {
    const clash = await db.tenant.findUnique({ where: { slug } });
    console.log(
      clash
        ? `\n--dry-run: WOULD FAIL — "${clash.name}" already uses that short name.`
        : "\n--dry-run: nothing written.",
    );
    return;
  }

  const result = await provisionTenant(db, {
    name: name!,
    ownerName: ownerName!,
    ownerEmail: ownerEmail!,
    slug,
    timezone,
    origin,
    actor: { type: "SYSTEM", via: "scripts/create-tenant.ts" },
  });

  if (!result.ok) {
    console.error(`\n${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (result.alsoOwns.length > 0) {
    console.warn(
      `\nNOTE: ${ownerEmail} already belongs to ${result.alsoOwns.join(", ")}. ` +
        `They have been added to this one as well.`,
    );
  }

  console.log(`\nCreated. Send this link to ${ownerName} — it works once, for 7 days:\n`);
  console.log(`  ${result.inviteLink}\n`);
  console.log("They choose their own password on that page. Nobody else sees it.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
