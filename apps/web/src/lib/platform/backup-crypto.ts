/**
 * Encrypting a backup before it leaves this computer (scripts/backup.ts),
 * and opening it again (scripts/backup-rehearse.ts, backup-open.ts).
 *
 * AES-256-GCM with a key derived from the passphrase by scrypt, so the file
 * in Google Drive is useless to anyone without the passphrase — and a wrong
 * passphrase or a damaged file is refused, never half-read. The file is:
 * "FHBK1\0", 16-byte salt, 12-byte IV, ciphertext, 16-byte tag.
 *
 * Tested in src/tests/platform-backup.test.ts.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { appendFileSync, createReadStream, createWriteStream, rmSync, writeFileSync } from "node:fs";
import { open, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

const MAGIC = Buffer.from("FHBK1\0", "latin1");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + IV_BYTES;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** The shortest passphrase accepted. */
export const PASSPHRASE_MIN = 12;

export function passphraseProblem(passphrase: string | undefined): string | null {
  if (!passphrase) {
    return "Set BACKUP_PASSPHRASE in apps/web/.env.local first. Keep it somewhere safe: without it no backup can be opened.";
  }
  if (passphrase.length < PASSPHRASE_MIN) {
    return `BACKUP_PASSPHRASE must be at least ${PASSPHRASE_MIN} characters.`;
  }
  return null;
}

function keyFor(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32, SCRYPT);
}

export async function encryptFile(source: string, destination: string, passphrase: string): Promise<void> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyFor(passphrase, salt), iv);
  writeFileSync(destination, Buffer.concat([MAGIC, salt, iv]));
  await pipeline(createReadStream(source), cipher, createWriteStream(destination, { flags: "a" }));
  appendFileSync(destination, cipher.getAuthTag());
}

export class BackupUnreadable extends Error {}

export async function decryptFile(source: string, destination: string, passphrase: string): Promise<void> {
  const { size } = await stat(source);
  if (size < HEADER_BYTES + TAG_BYTES) throw new BackupUnreadable("That isn't a FlowHRMS backup, or it is damaged.");
  const handle = await open(source, "r");
  const header = Buffer.alloc(HEADER_BYTES);
  const tag = Buffer.alloc(TAG_BYTES);
  try {
    await handle.read(header, 0, HEADER_BYTES, 0);
    await handle.read(tag, 0, TAG_BYTES, size - TAG_BYTES);
  } finally {
    await handle.close();
  }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new BackupUnreadable("That isn't a FlowHRMS backup, or it is damaged.");
  }
  const salt = header.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
  const iv = header.subarray(MAGIC.length + SALT_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", keyFor(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  try {
    await pipeline(
      createReadStream(source, { start: HEADER_BYTES, end: size - TAG_BYTES - 1 }),
      decipher,
      createWriteStream(destination),
    );
  } catch {
    // What was written can't be trusted: remove it.
    rmSync(destination, { force: true });
    throw new BackupUnreadable("Wrong passphrase, or the backup file is damaged.");
  }
}
