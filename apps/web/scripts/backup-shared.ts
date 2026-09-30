/**
 * Shared by scripts/backup.ts, backup-rehearse.ts and backup-open.ts.
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/** Where backups go unless BACKUP_DIR says otherwise: Google Drive for desktop. */
export const DEFAULT_BACKUP_DIR = "G:/My Drive/FlowHRMS-Backups";

export function backupDir(): string {
  return (process.env.BACKUP_DIR?.trim() || DEFAULT_BACKUP_DIR).replace(/\\/g, "/");
}

export function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** PostgreSQL's own tools: PG_BIN, else the standard Windows install, else PATH. */
export function pgTool(name: "pg_dump" | "pg_restore" | "initdb" | "pg_ctl"): string {
  const dirs = [process.env.PG_BIN, "C:/Program Files/PostgreSQL/17/bin"].filter(Boolean) as string[];
  for (const dir of dirs) {
    for (const file of [`${name}.exe`, name]) {
      const full = path.join(dir, file);
      if (existsSync(full)) return full;
    }
  }
  return name;
}

/** Hide anything that looks like a connection string or password. */
export function redact(text: string): string {
  return text
    .replace(/postgres(ql)?:\/\/\S*/gi, "[connection]")
    .replace(/password=\S+/gi, "password=[hidden]");
}

/**
 * Start a program that leaves a server running (pg_ctl start). No output
 * pipes: the server would inherit them, and waiting for them to close
 * would wait for the server to stop. Its messages go to a log file.
 */
export function runDetached(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore", windowsHide: true });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

/** Run a program without a shell, collecting its error output. */
export function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? process.env, windowsHide: true });
    let stderr = "";
    let stdout = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stderr, stdout }));
  });
}

/** "2026-09-30-2115", India time, for file names. */
export function istStamp(at: Date): string {
  const ist = new Date(at.getTime() + 5.5 * 60 * 60 * 1000).toISOString();
  return `${ist.slice(0, 10)}-${ist.slice(11, 13)}${ist.slice(14, 16)}`;
}

/** The newest backup file in a folder, or null. */
export function newestBackup(dir: string): string | null {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".fhbk"))
    .map((f) => ({ f, t: statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files[0] ? path.join(dir, files[0].f) : null;
}

export function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** DIRECT_URL split for libpq: the password goes in PGPASSWORD, never on a command line. */
export function libpqTarget(url: string): { dbname: string; env: NodeJS.ProcessEnv } {
  const u = new URL(url);
  const password = decodeURIComponent(u.password);
  u.password = "";
  for (const key of [...u.searchParams.keys()]) if (key !== "sslmode") u.searchParams.delete(key);
  if (!u.searchParams.has("sslmode")) u.searchParams.set("sslmode", "require");
  return { dbname: u.toString(), env: { ...process.env, PGPASSWORD: password } };
}

export interface BackupManifest {
  format: 1;
  createdAt: string;
  commit: string | null;
  postgres: string;
  /** Rows per public table, counted in the same snapshot as the dump. */
  tables: Record<string, number>;
  signIns: number;
  files: { count: number; bytes: number; byBucket: Record<string, number> };
}
