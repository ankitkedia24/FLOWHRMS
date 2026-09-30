/**
 * Prove a backup restores: open it, restore the company data into a
 * throwaway PostgreSQL on this computer, and check every table's rows and
 * every file against the counts taken when it was made. Then delete the
 * throwaway database. Nothing live is touched.
 *
 *   npm run backup-rehearse --workspace=@flowhrms/web
 *   npm run backup-rehearse --workspace=@flowhrms/web -- --file "G:/My Drive/FlowHRMS-Backups/flowhrms-backup-….fhbk"
 *
 * Defaults to the newest backup in BACKUP_DIR. Needs BACKUP_PASSPHRASE and
 * PostgreSQL 17's own tools (C:/Program Files/PostgreSQL/17/bin, or PG_BIN).
 * The result is shown on /platform/system (--no-record to skip that).
 *
 * Sign-ins (the auth schema) are checked to be inside the backup but not
 * restored here: they only restore into a Supabase project.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";
import { BackupUnreadable, decryptFile, passphraseProblem } from "../src/lib/platform/backup-crypto";
import { arg, backupDir, flag, newestBackup, pgTool, redact, run, runDetached, type BackupManifest } from "./backup-shared";

function filesUnder(dir: string): { count: number; bytes: number } {
  if (!existsSync(dir)) return { count: 0, bytes: 0 };
  let count = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = filesUnder(full);
      count += sub.count;
      bytes += sub.bytes;
    } else {
      count += 1;
      bytes += statSync(full).size;
    }
  }
  return { count, bytes };
}

async function main() {
  const passphrase = process.env.BACKUP_PASSPHRASE;
  const problem = passphraseProblem(passphrase);
  if (problem) throw new Error(problem);
  const file = arg("file") ?? newestBackup(backupDir());
  if (!file || !existsSync(file)) throw new Error(`No backup found${file ? ` at ${file}` : ` in ${backupDir()}`}.`);
  const fileName = path.basename(file);
  console.log(`Rehearsing ${fileName}`);

  const work = mkdtempSync(path.join(os.tmpdir(), "flowhrms-rehearse-"));
  const content = path.join(work, "content");
  const pgdata = path.join(work, "pgdata");
  const port = 55000 + Math.floor(Math.random() * 900);
  let started = false;
  const problems: string[] = [];
  let summary = "";

  try {
    // 1. Open it.
    await decryptFile(file, path.join(work, "bundle.tgz"), passphrase!);
    mkdirSync(content);
    const untar = await run("tar", ["-xzf", "bundle.tgz", "-C", "content"], { cwd: work });
    if (untar.code !== 0) throw new Error(`tar failed: ${untar.stderr.trim()}`);
    const manifest = JSON.parse(readFileSync(path.join(content, "manifest.json"), "utf8")) as BackupManifest;
    const dumpFile = path.join(content, "database.dump");

    // 2. Sign-ins are in it.
    const list = await run(pgTool("pg_restore"), ["--list", dumpFile]);
    if (!/TABLE DATA auth users /.test(list.stdout)) problems.push("the sign-ins (auth.users) are missing from the backup");

    // 3. A throwaway PostgreSQL, reachable only from this computer.
    const init = await run(pgTool("initdb"), ["-D", pgdata, "-U", "rehearsal", "-A", "trust", "-E", "UTF8", "--no-sync"]);
    if (init.code !== 0) throw new Error(`initdb failed: ${init.stderr.trim()}`);
    const log = path.join(work, "postgres.log");
    started = true; // from here on, always try to stop it
    const startCode = await runDetached(pgTool("pg_ctl"), [
      "-D", pgdata, "-l", log, "-w",
      "-o", `-p ${port} -c listen_addresses=127.0.0.1`, "start",
    ]);
    if (startCode !== 0) {
      const tail = existsSync(log) ? readFileSync(log, "utf8").trim().split(/\r?\n/).slice(-3).join(" | ") : "";
      throw new Error(`The throwaway database didn't start. ${tail}`);
    }

    const admin = new Client({ host: "127.0.0.1", port, user: "rehearsal", database: "postgres" });
    await admin.connect();
    await admin.query("CREATE DATABASE rehearsal");
    await admin.end();
    const scratch = new Client({ host: "127.0.0.1", port, user: "rehearsal", database: "rehearsal" });
    await scratch.connect();

    // 4. Restore the company data.
    const restore = await run(pgTool("pg_restore"), [
      "--no-owner", "--no-privileges", "--schema=public",
      `--dbname=postgresql://rehearsal@127.0.0.1:${port}/rehearsal`, dumpFile,
    ]);
    if (restore.code !== 0) {
      const lines = redact(restore.stderr).split(/\r?\n/).filter((l) => /error/i.test(l));
      problems.push(`the restore reported ${lines.length} error(s): ${lines.slice(0, 3).join(" | ")}`);
    }

    // 5. Every table, every row.
    let tablesOk = 0;
    for (const [table, expected] of Object.entries(manifest.tables)) {
      try {
        const got = Number(
          (await scratch.query(`SELECT count(*) AS n FROM public."${table.replace(/"/g, '""')}"`)).rows[0].n,
        );
        if (got === expected) tablesOk += 1;
        else problems.push(`${table}: ${got} rows restored, ${expected} expected`);
      } catch {
        problems.push(`${table}: missing after the restore`);
      }
    }
    await scratch.end();

    // 6. Every file.
    const files = filesUnder(path.join(content, "files"));
    if (files.count !== manifest.files.count || files.bytes !== manifest.files.bytes) {
      problems.push(`files: ${files.count} (${files.bytes} bytes) in the backup, ${manifest.files.count} (${manifest.files.bytes} bytes) expected`);
    }

    const total = Object.keys(manifest.tables).length;
    const rows = Object.values(manifest.tables).reduce((a, b) => a + b, 0);
    summary = `${tablesOk} of ${total} tables match (${rows} rows); ${files.count} of ${manifest.files.count} files; sign-ins ${
      problems.some((p) => p.startsWith("the sign-ins")) ? "MISSING" : `present (${manifest.signIns})`
    }`;
  } finally {
    if (started) await runDetached(pgTool("pg_ctl"), ["-D", pgdata, "-m", "fast", "-w", "stop"]).catch(() => 1);
    rmSync(work, { recursive: true, force: true });
  }

  const ok = problems.length === 0;
  const note = ok ? summary : `${summary}. Problems: ${problems.join("; ")}`;
  if (!flag("no-record")) {
    const db = new Client({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await db.connect();
    await db.query(
      `UPDATE platform_backups SET "rehearsedAt" = now(), "rehearsalOk" = $2, "rehearsalNote" = $3 WHERE "fileName" = $1`,
      [fileName, ok, note.slice(0, 1000)],
    );
    await db.end();
  }
  console.log(ok ? `REHEARSAL PASSED — ${summary}.` : `REHEARSAL FOUND PROBLEMS — ${summary}.`);
  for (const p of problems) console.log(`  - ${p}`);
  console.log("The throwaway database has been deleted.");
  if (!ok) process.exitCode = 1;
}

main()
  .catch((e) => {
    const message = e instanceof BackupUnreadable ? e.message : redact(e instanceof Error ? e.message : String(e));
    console.error(`REHEARSAL FAILED: ${message}`);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
