/**
 * Open a backup for a real restore: decrypt it and unpack it into a folder.
 *
 *   npm run backup-open --workspace=@flowhrms/web -- --file "<backup.fhbk>" --to "<empty folder>"
 *
 * The folder then holds database.dump (restore with pg_restore into a
 * Supabase project — OPERATIONS.md → Backup and restore), files/<bucket>/…
 * (upload back into the same buckets) and manifest.json (what was inside).
 * It is unencrypted personal data: delete the folder when you are done.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });

import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { BackupUnreadable, decryptFile, passphraseProblem } from "../src/lib/platform/backup-crypto";
import { arg, redact, run } from "./backup-shared";

async function main() {
  const passphrase = process.env.BACKUP_PASSPHRASE;
  const problem = passphraseProblem(passphrase);
  if (problem) throw new Error(problem);
  const file = arg("file");
  const to = arg("to");
  if (!file || !to) throw new Error('Required: --file "<backup.fhbk>" --to "<empty folder>"');
  if (!existsSync(file)) throw new Error(`No file at ${file}.`);
  mkdirSync(to, { recursive: true });
  if (readdirSync(to).length > 0) throw new Error(`${to} isn't empty. Choose an empty folder.`);

  const bundle = path.join(to, "bundle.tgz");
  await decryptFile(file, bundle, passphrase!);
  const untar = await run("tar", ["-xzf", "bundle.tgz"], { cwd: to });
  rmSync(bundle, { force: true });
  if (untar.code !== 0) throw new Error(`tar failed: ${untar.stderr.trim()}`);
  console.log(`Opened into ${to}: database.dump, files/, manifest.json.`);
  console.log("This is unencrypted personal data. Delete the folder when you are done.");
}

main()
  .catch((e) => {
    const message = e instanceof BackupUnreadable ? e.message : redact(e instanceof Error ? e.message : String(e));
    console.error(`FAILED: ${message}`);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
