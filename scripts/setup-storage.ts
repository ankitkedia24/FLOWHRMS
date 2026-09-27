/**
 * Provision the private `task-proof` storage bucket and its access
 * policies (SECURITY-NOTES.md → file storage).
 *
 * Rules enforced here:
 * - The bucket is PRIVATE. Files are never served from a public path;
 *   reads go through short-lived signed URLs generated server-side.
 * - 10 MB per file, images and PDF only (component spec §25 constraints).
 * - Authenticated users may upload; nobody may read, update or delete
 *   through the anon/authenticated roles. Downloads happen server-side
 *   with the service role, which bypasses RLS and is audited in app code.
 *
 * Idempotent. Usage: npx tsx scripts/setup-storage.ts
 */
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const MAX_BYTES = 10 * 1024 * 1024;
const MIME = ["image/jpeg", "image/png", "image/heic", "image/webp", "application/pdf"];

/**
 * Both buckets are private and insert-only. Employee documents are ID and
 * address proofs — the most sensitive files FlowHRMS holds — so they get the
 * same treatment as proof, never a public path (Constitution §7).
 */
const BUCKETS = ["task-proof", "employee-documents", "expense-receipts", "company-media"];

/**
 * company-media holds a company's logo, its opening animation, its ID card
 * design and employee photos. Private like the rest — photos are personal
 * data — and read through short-lived signed URLs (src/lib/media/urls.ts).
 * It alone accepts GIF and short videos, for the opening animation.
 */
const MIME_BY_BUCKET: Record<string, string[]> = {
  "company-media": ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"],
};

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL / DIRECT_URL is not set. See SETUP.md.");
  process.exit(1);
}

const client = new Client({ connectionString });

async function main() {
  await client.connect();

  for (const bucket of BUCKETS) {
    const policyName = `${bucket.replace(/-/g, "_")}_authenticated_insert`;

    await client.query(
      `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
       values ($1, $1, false, $2, $3)
       on conflict (id) do update
         set public = false,
             file_size_limit = excluded.file_size_limit,
             allowed_mime_types = excluded.allowed_mime_types`,
      [bucket, MAX_BYTES, MIME_BY_BUCKET[bucket] ?? MIME],
    );

    // Policies are dropped and recreated so this script stays idempotent.
    await client.query(
      `drop policy if exists "${policyName}" on storage.objects`,
    );
    await client.query(
      `create policy "${policyName}"
       on storage.objects for insert to authenticated
       with check (bucket_id = '${bucket}')`,
    );

    // No select/update/delete policy exists by design: reads are
    // signed-URL only, minted server-side after a permission check, and
    // deletion is an audited server-side operation.
    for (const cmd of ["select", "update", "delete"]) {
      await client.query(
        `drop policy if exists "${bucket.replace(/-/g, "_")}_authenticated_${cmd}" on storage.objects`,
      );
    }
  }

  const { rows } = await client.query(
    `select id, public, file_size_limit
     from storage.buckets where id = any($1) order by id`,
    [BUCKETS],
  );
  const policies = await client.query(
    `select policyname, cmd, roles::text
     from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and (policyname like 'task_proof%' or policyname like 'employee_documents%' or policyname like 'expense_receipts%' or policyname like 'company_media%')
     order by policyname`,
  );

  console.log("buckets:", rows);
  console.log("policies:", policies.rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.end());
