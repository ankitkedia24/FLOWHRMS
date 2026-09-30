import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { BackupUnreadable, decryptFile, encryptFile, passphraseProblem } from "@/lib/platform/backup-crypto";
import { backupFreshness, lockoutCodeStatus } from "@/lib/platform/system-status";

/**
 * Backups: the encryption that keeps a backup in Google Drive unreadable
 * without the passphrase, and what /platform/system says about them. The
 * full backup → restore → compare run is scripts/backup-rehearse.ts.
 */

const NOW = new Date("2026-09-30T10:00:00.000Z");
const PASS = "correct horse battery staple";

describe("the passphrase", () => {
  it("must be set and at least 12 characters", () => {
    expect(passphraseProblem(undefined)).toContain("Set BACKUP_PASSPHRASE");
    expect(passphraseProblem("short")).toBe("BACKUP_PASSPHRASE must be at least 12 characters.");
    expect(passphraseProblem(PASS)).toBeNull();
  });
});

describe("encrypting and opening a backup", () => {
  let dir: string;
  const plain = randomBytes(200_000);

  beforeAll(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "flowhrms-crypto-test-"));
    writeFileSync(path.join(dir, "plain.bin"), plain);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("opens with the right passphrase to exactly what went in", async () => {
    await encryptFile(path.join(dir, "plain.bin"), path.join(dir, "b.fhbk"), PASS);
    const sealed = readFileSync(path.join(dir, "b.fhbk"));
    expect(sealed.subarray(0, 5).toString("latin1")).toBe("FHBK1");
    expect(sealed.includes(plain.subarray(0, 64))).toBe(false);
    await decryptFile(path.join(dir, "b.fhbk"), path.join(dir, "out.bin"), PASS);
    expect(readFileSync(path.join(dir, "out.bin")).equals(plain)).toBe(true);
  });

  it("refuses a wrong passphrase and leaves nothing half-written", async () => {
    await expect(decryptFile(path.join(dir, "b.fhbk"), path.join(dir, "wrong.bin"), "not the passphrase")).rejects.toThrow(
      "Wrong passphrase, or the backup file is damaged.",
    );
    expect(existsSync(path.join(dir, "wrong.bin"))).toBe(false);
  });

  it("refuses a file changed after it was made", async () => {
    const sealed = readFileSync(path.join(dir, "b.fhbk"));
    sealed[1000] ^= 0xff;
    writeFileSync(path.join(dir, "tampered.fhbk"), sealed);
    await expect(decryptFile(path.join(dir, "tampered.fhbk"), path.join(dir, "t.bin"), PASS)).rejects.toBeInstanceOf(
      BackupUnreadable,
    );
    expect(existsSync(path.join(dir, "t.bin"))).toBe(false);
  });

  it("refuses something that isn't a backup at all", async () => {
    writeFileSync(path.join(dir, "notes.txt"), "just some text, long enough to have a header and a tag".repeat(3));
    await expect(decryptFile(path.join(dir, "notes.txt"), path.join(dir, "n.bin"), PASS)).rejects.toThrow(
      "That isn't a FlowHRMS backup, or it is damaged.",
    );
  });
});

describe("what /platform/system says about backups (backupFreshness)", () => {
  const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

  it("flags none at all, and one a week old or more", () => {
    expect(backupFreshness(null, NOW)).toEqual({ tone: "error", text: "No backup has been made yet." });
    expect(backupFreshness(daysAgo(7), NOW)).toEqual({
      tone: "warning",
      text: "The last backup is 7 days old. Make one this week.",
    });
  });

  it("is content with a recent one", () => {
    expect(backupFreshness(daysAgo(0), NOW).text).toBe("Backed up today.");
    expect(backupFreshness(daysAgo(1), NOW).text).toBe("Last backed up 1 day ago.");
    expect(backupFreshness(daysAgo(6), NOW).tone).toBe("success");
  });
});

describe("what became of each lockout code (lockoutCodeStatus)", () => {
  const future = new Date(NOW.getTime() + 60_000);
  const past = new Date(NOW.getTime() - 60_000);

  it("says used, stopped, expired or waiting", () => {
    expect(lockoutCodeStatus({ usedAt: past, attempts: 1, expiresAt: future }, NOW)).toBe("Used");
    expect(lockoutCodeStatus({ usedAt: null, attempts: 5, expiresAt: future }, NOW)).toBe("Stopped after 5 wrong tries");
    expect(lockoutCodeStatus({ usedAt: null, attempts: 0, expiresAt: past }, NOW)).toBe("Expired, not used");
    expect(lockoutCodeStatus({ usedAt: null, attempts: 2, expiresAt: past }, NOW)).toBe("Expired after 2 wrong tries");
    expect(lockoutCodeStatus({ usedAt: null, attempts: 0, expiresAt: future }, NOW)).toBe("Waiting to be used");
  });
});
