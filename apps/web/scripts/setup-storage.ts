/**
 * Provision the private storage buckets and their access policies
 * (SECURITY-NOTES.md → file storage).
 *
 * Rules enforced here:
 * - Every bucket is PRIVATE. Files are never served from a public path;
 *   reads go through short-lived signed URLs generated server-side.
 * - 10 MB per file, images and PDF only (component spec §25 constraints);
 *   company-media also takes GIF and short video.
 * - Signed-in users may upload ONLY into a company they are an active
 *   member of — the first folder of the path — and employee documents and
 *   expense receipts only into their own membership's folder
 *   (scripts/storage-policy.ts). Nobody may read, update or delete through
 *   the anon/authenticated roles. Downloads happen server-side with the
 *   service role, which bypasses RLS and is audited in app code.
 *
 * Idempotent. Runs in apps/web, where it reads .env.local (DEPLOY.md §7f):
 *   npm run setup-storage                  apply
 *   npm run setup-storage -- --status      report only, changes nothing
 *   npm run setup-storage -- --rollback    back to "any signed-in user may
 *                                          upload to the bucket"
 * From the repository root add `--workspace=@flowhrms/web` after the
 * script name.
 */
import { config as loadEnv } from "dotenv";
import { Client } from "pg";
import {
  BUCKETS,
  FUNCTION_STATUS_SQL,
  POLICY_STATUS_SQL,
  applyPolicySql,
  rollbackPolicySql,
  type Bucket,
} from "./storage-policy";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const MAX_BYTES = 10 * 1024 * 1024;
const MIME = ["image/jpeg", "image/png", "image/heic", "image/webp", "application/pdf"];

/**
 * All buckets are private and insert-only. Employee documents are ID and
 * address proofs — the most sensitive files FlowHRMS holds — so they get the
 * same treatment as proof, never a public path (Constitution §7).
 *
 * company-media holds a company's logo, its opening animation, its ID card
 * design and employee photos. Private like the rest — photos are personal
 * data — and read through short-lived signed URLs (src/lib/media/urls.ts).
 * It alone accepts GIF and short videos, for the opening animation.
 */
const MIME_BY_BUCKET: Partial<Record<Bucket, string[]>> = {
  "company-media": ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"],
};

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL / DIRECT_URL is not set. See SETUP.md.");
  process.exit(1);
}

const client = new Client({ connectionString });
const mode = process.argv.includes("--rollback")
  ? "rollback"
  : process.argv.includes("--status")
    ? "status"
    : "apply";

async function report() {
  const { rows } = await client.query(
    `select id, public, file_size_limit
     from storage.buckets where id = any($1) order by id`,
    [BUCKETS],
  );
  const policies = await client.query(POLICY_STATUS_SQL);
  const functions = await client.query(FUNCTION_STATUS_SQL);

  console.log("buckets:", rows);
  console.log("policies:", policies.rows);
  console.log("functions:", functions.rows);
}

async function main() {
  await client.connect();

  if (mode === "status") {
    await report();
    return;
  }

  // One transaction: a bucket is never left without its upload policy
  // (which would refuse every upload to it) if something fails halfway.
  await client.query("begin");
  try {
    if (mode === "apply") {
      for (const bucket of BUCKETS) {
        await client.query(
          `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
           values ($1, $1, false, $2, $3)
           on conflict (id) do update
             set public = false,
                 file_size_limit = excluded.file_size_limit,
                 allowed_mime_types = excluded.allowed_mime_types`,
          [bucket, MAX_BYTES, MIME_BY_BUCKET[bucket] ?? MIME],
        );
      }
    }

    // Policies are dropped and recreated so this script stays idempotent.
    const statements = mode === "apply" ? applyPolicySql() : rollbackPolicySql();
    for (const statement of statements) await client.query(statement);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  }

  console.log(mode === "apply" ? "applied." : "rolled back to the bucket-only upload rule.");
  await report();
}

main()
  .catch((e) => {
    // Only the message: never anything that could carry the connection string.
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => client.end());
