/**
 * An encrypted backup of everything FlowHRMS holds: the database (company
 * data and sign-ins) and every file in the four storage buckets, in one
 * file, encrypted with BACKUP_PASSPHRASE, saved to Google Drive.
 *
 *   npm run backup --workspace=@flowhrms/web
 *
 * Needs, in apps/web/.env.local: BACKUP_PASSPHRASE (at least 12 characters —
 * keep it safe: without it no backup can be opened), plus the DIRECT_URL,
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY the app already has.
 * BACKUP_DIR overrides the folder (default "G:/My Drive/FlowHRMS-Backups").
 *
 * Options: --out <folder> instead of BACKUP_DIR; --no-record to leave it off
 * /platform/system (for tests).
 *
 * Read-only against the live database and storage. The table counts and the
 * dump come from one exported snapshot, so a restore can be checked against
 * them exactly (scripts/backup-rehearse.ts). Nothing secret is printed.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });

import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { encryptFile, passphraseProblem } from "../src/lib/platform/backup-crypto";
import {
  arg,
  backupDir,
  flag,
  istStamp,
  libpqTarget,
  megabytes,
  pgTool,
  redact,
  run,
  type BackupManifest,
} from "./backup-shared";

async function main() {
  const passphrase = process.env.BACKUP_PASSPHRASE;
  const problem = passphraseProblem(passphrase);
  if (problem) throw new Error(problem);
  const direct = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!direct || !supabaseUrl || !secretKey) {
    throw new Error("DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in apps/web/.env.local.");
  }

  const outDir = (arg("out") ?? backupDir()).replace(/\\/g, "/");
  try {
    mkdirSync(outDir, { recursive: true });
  } catch {
    throw new Error(`Can't write to ${outDir}. Is Google Drive for desktop running and signed in?`);
  }

  const started = new Date();
  const work = mkdtempSync(path.join(os.tmpdir(), "flowhrms-backup-"));
  const content = path.join(work, "content");
  mkdirSync(content);
  const db = new Client({ connectionString: direct, ssl: { rejectUnauthorized: false } });

  try {
    await db.connect();
    const postgres = (await db.query("SELECT current_setting('server_version') AS v")).rows[0].v as string;

    // 1. One snapshot for the counts and the dump.
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    let snapshot: string | null = null;
    try {
      snapshot = (await db.query("SELECT pg_export_snapshot() AS s")).rows[0].s as string;
    } catch {
      console.warn("Note: couldn't share one snapshot with pg_dump; counts may differ if the site was in use.");
      await db.query("ROLLBACK");
      await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    }
    const tableNames = (
      await db.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
      )
    ).rows.map((r) => r.table_name as string);
    const tables: Record<string, number> = {};
    for (const name of tableNames) {
      tables[name] = Number((await db.query(`SELECT count(*) AS n FROM public."${name.replace(/"/g, '""')}"`)).rows[0].n);
    }
    const signIns = Number((await db.query("SELECT count(*) AS n FROM auth.users")).rows[0].n);
    const objects = (
      await db.query("SELECT bucket_id, name FROM storage.objects ORDER BY bucket_id, name")
    ).rows as Array<{ bucket_id: string; name: string }>;

    // 2. The database: company data (public) and sign-ins (auth).
    const target = libpqTarget(direct);
    const dumpFile = path.join(content, "database.dump");
    const dump = await run(
      pgTool("pg_dump"),
      [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--schema=public",
        "--schema=auth",
        ...(snapshot ? [`--snapshot=${snapshot}`] : []),
        `--file=${dumpFile}`,
        `--dbname=${target.dbname}`,
      ],
      { env: target.env },
    );
    await db.query("COMMIT");
    if (dump.code !== 0) throw new Error(`pg_dump failed: ${redact(dump.stderr).trim()}`);

    // 3. Every stored file.
    const storage = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const byBucket: Record<string, number> = {};
    let fileBytes = 0;
    for (const o of objects) {
      const { data, error } = await storage.storage.from(o.bucket_id).download(o.name);
      if (error || !data) throw new Error(`Couldn't download a file from ${o.bucket_id}: ${error?.message ?? "no data"}`);
      const bytes = Buffer.from(await data.arrayBuffer());
      const dest = path.join(content, "files", o.bucket_id, ...o.name.split("/"));
      mkdirSync(path.dirname(dest), { recursive: true });
      writeFileSync(dest, bytes);
      byBucket[o.bucket_id] = (byBucket[o.bucket_id] ?? 0) + 1;
      fileBytes += bytes.length;
    }

    // 4. What is inside, for the rehearsal to check against.
    const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" });
    const manifest: BackupManifest = {
      format: 1,
      createdAt: started.toISOString(),
      commit: commit.status === 0 ? commit.stdout.trim() : null,
      postgres,
      tables,
      signIns,
      files: { count: objects.length, bytes: fileBytes, byBucket },
    };
    writeFileSync(path.join(content, "manifest.json"), JSON.stringify(manifest, null, 2));

    // 5. One archive, encrypted, to Google Drive. Relative paths only, so
    // either tar on Windows reads them the same way.
    const tar = await run("tar", ["-czf", "bundle.tgz", "-C", "content", "."], { cwd: work });
    if (tar.code !== 0) throw new Error(`tar failed: ${tar.stderr.trim()}`);
    const fileName = `flowhrms-backup-${istStamp(started)}.fhbk`;
    const finalPath = path.join(outDir, fileName);
    await encryptFile(path.join(work, "bundle.tgz"), finalPath, passphrase!);
    const bytes = statSync(finalPath).size;
    const databaseBytes = statSync(dumpFile).size;

    if (!flag("no-record")) {
      await db.query(
        `INSERT INTO platform_backups (id, "fileName", bytes, "databaseBytes", "fileCount", "tableCounts", "signIns", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [randomUUID(), fileName, bytes, databaseBytes, objects.length, JSON.stringify(tables), signIns, started],
      );
    }

    const rows = Object.values(tables).reduce((a, b) => a + b, 0);
    console.log(`Backup saved: ${finalPath}`);
    console.log(`  Size      : ${megabytes(bytes)} (database ${megabytes(databaseBytes)})`);
    console.log(`  Database  : ${tableNames.length} tables, ${rows} rows, ${signIns} sign-ins (PostgreSQL ${postgres})`);
    console.log(`  Files     : ${objects.length} (${megabytes(fileBytes)})`);
    console.log(`  Encrypted : yes — opens only with BACKUP_PASSPHRASE`);
    console.log("\nNext: npm run backup-rehearse --workspace=@flowhrms/web   (restores it into a throwaway database and checks every table)");
  } finally {
    await db.end().catch(() => undefined);
    rmSync(work, { recursive: true, force: true });
  }
}

main()
  .catch((e) => {
    console.error(`BACKUP FAILED: ${redact(e instanceof Error ? e.message : String(e))}`);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
