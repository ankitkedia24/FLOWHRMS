/**
 * Publish the consent notices and policies in src/lib/consent/documents.ts.
 *
 * What a person consents to is the PUBLISHED copy in `consent_notices`,
 * identified by its sha256. This script puts each document's current
 * version there. It is safe to run repeatedly:
 *
 * - a version already published with the same text is left alone;
 * - a version already published with DIFFERENT text is refused — change
 *   the `version` number instead, because people agreed to the old words;
 * - publishing a new version retires the older ones, and everyone is asked
 *   to consent again on their next visit.
 *
 * Run before deploying code that references a new version (like migrations):
 *   npm run publish-notices
 *   npm run publish-notices -- --dry-run
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { getDb } from "../src/lib/db";
import { CURRENT_DOCUMENTS, canonicalBody } from "../src/lib/consent/documents";
import { sha256 } from "../src/lib/consent/chain";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const db = getDb();
  let failed = false;

  for (const doc of Object.values(CURRENT_DOCUMENTS)) {
    const body = canonicalBody(doc);
    const hash = sha256(body);
    const label = `${doc.key} v${doc.version} (${doc.language})`;
    const existing = await db.consentNotice.findUnique({
      where: { key_version_language: { key: doc.key, version: doc.version, language: doc.language } },
    });

    if (existing) {
      if (existing.sha256 === hash) {
        console.log(`unchanged   ${label}`);
      } else {
        console.error(`REFUSED     ${label}: the text differs from what was published. Bump its version.`);
        failed = true;
      }
      continue;
    }

    if (dryRun) {
      console.log(`would publish ${label}  sha256 ${hash.slice(0, 16)}…`);
      continue;
    }

    await db.$transaction([
      db.consentNotice.updateMany({
        where: { key: doc.key, language: doc.language, status: "PUBLISHED" },
        data: { status: "RETIRED" },
      }),
      db.consentNotice.create({
        data: {
          key: doc.key,
          version: doc.version,
          language: doc.language,
          title: doc.title,
          body,
          sha256: hash,
          status: "PUBLISHED",
        },
      }),
    ]);
    console.log(`published   ${label}  sha256 ${hash.slice(0, 16)}…  (pending legal review)`);
  }

  if (failed) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e?.message ?? e);
    process.exit(1);
  })
  .finally(() => process.exit(process.exitCode ?? 0));
