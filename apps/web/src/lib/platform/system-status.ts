/**
 * What /platform/system says about backups and lockout codes. Pure, and
 * tested in src/tests/platform-backup.test.ts.
 */
import { LOCKOUT_MAX_ATTEMPTS } from "./lockout-policy";

/** A backup older than this is flagged on /platform/system. */
export const BACKUP_DUE_DAYS = 7;

const DAY_MS = 86_400_000;

export type Freshness =
  | { tone: "error"; text: string }
  | { tone: "warning"; text: string }
  | { tone: "success"; text: string };

export function backupFreshness(lastBackupAt: Date | null, now: Date): Freshness {
  if (!lastBackupAt) {
    return { tone: "error", text: "No backup has been made yet." };
  }
  const days = Math.floor((now.getTime() - lastBackupAt.getTime()) / DAY_MS);
  if (days >= BACKUP_DUE_DAYS) {
    return { tone: "warning", text: `The last backup is ${days} days old. Make one this week.` };
  }
  return {
    tone: "success",
    text: days === 0 ? "Backed up today." : `Last backed up ${days} ${days === 1 ? "day" : "days"} ago.`,
  };
}

/** One lockout code's outcome, in words. */
export function lockoutCodeStatus(
  row: { usedAt: Date | null; attempts: number; expiresAt: Date },
  now: Date,
): string {
  if (row.usedAt) return "Used";
  if (row.attempts >= LOCKOUT_MAX_ATTEMPTS) return "Stopped after 5 wrong tries";
  if (row.expiresAt <= now) {
    return row.attempts > 0 ? `Expired after ${row.attempts} wrong ${row.attempts === 1 ? "try" : "tries"}` : "Expired, not used";
  }
  return "Waiting to be used";
}
