/**
 * PAUSED (28 Sept 2026, owner's decision): email/mobile one-time codes at
 * sign-up are built but not wired into /start. Only the parked
 * contact-actions.ts and its tests use this file.
 * Resume only when the owner asks; mobile needs MSG91 keys (see msg91.ts).
 */

import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/**
 * One-time codes for proving an email address or mobile number during
 * sign-up. Pure (apart from randomness), and tested in
 * src/tests/signup-otp.test.ts.
 */

export const OTP_LENGTH = 6;
/** How long a code works. */
export const OTP_TTL_MS = 10 * 60 * 1000;
/** Wrong tries allowed on one code before a new one is needed. */
export const OTP_MAX_ATTEMPTS = 5;
/** Gap before "Resend" works. */
export const OTP_RESEND_SECONDS = 30;
/** Codes one email address or number may be sent in an hour. */
export const OTP_MAX_PER_TARGET_PER_HOUR = 5;
/** Codes one device (IP address) may request in an hour. */
export const OTP_MAX_PER_IP_PER_HOUR = 20;
/** A verified address counts as proof for this long, and only once. */
export const OTP_PROOF_TTL_MS = 30 * 60 * 1000;

export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/**
 * Salted with the row id, so the same code in two rows hashes differently.
 * A 6-digit code is guessable offline, which is why codes also expire in
 * ten minutes and lock after five tries.
 */
export function hashOtp(rowId: string, code: string): string {
  return createHash("sha256").update(`${rowId}:${code}`).digest("hex");
}

export function otpMatches(rowId: string, code: string, storedHash: string): boolean {
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const given = Buffer.from(hashOtp(rowId, clean), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return given.length === stored.length && timingSafeEqual(given, stored);
}

/** Seconds until another code may be sent; 0 when it may. */
export function resendWaitSeconds(lastSentAt: Date | null, now: Date): number {
  if (!lastSentAt) return 0;
  const left = OTP_RESEND_SECONDS - Math.floor((now.getTime() - lastSentAt.getTime()) / 1000);
  return Math.max(0, left);
}

export type ProofCheck =
  | { ok: true }
  | { ok: false; reason: "missing" | "mismatch" | "unverified" | "expired" | "used" };

/** Is this verification row valid proof for `target`, right now? */
export function proofValid(
  row: { channel: string; target: string; verifiedAt: Date | null; usedAt: Date | null } | null,
  channel: "EMAIL" | "SMS",
  target: string,
  now: Date,
): ProofCheck {
  if (!row) return { ok: false, reason: "missing" };
  if (row.channel !== channel || row.target !== target) return { ok: false, reason: "mismatch" };
  if (!row.verifiedAt) return { ok: false, reason: "unverified" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (now.getTime() - row.verifiedAt.getTime() > OTP_PROOF_TTL_MS) return { ok: false, reason: "expired" };
  return { ok: true };
}
