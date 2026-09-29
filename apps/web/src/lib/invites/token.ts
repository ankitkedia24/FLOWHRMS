import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Invitation tokens.
 *
 * The raw token is returned ONCE, at creation, and never stored. Only its
 * SHA-256 hash goes to the database, so a leaked backup yields no working
 * invitation links (SECURITY-NOTES.md). This mirrors how password reset
 * tokens are handled everywhere sane, and costs nothing to do properly.
 *
 * Pure and dependency-free apart from node:crypto, so it is unit-testable
 * without a database or a Supabase project.
 */

/** 32 bytes of CSPRNG output, base64url — 256 bits, URL-safe, no padding. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Constant-time comparison. Lookup is by hash (indexed), so this guards the
 * final check rather than the query — cheap, and it keeps the comparison
 * honest if the lookup ever changes shape.
 */
export function inviteTokenMatches(token: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashInviteToken(token), "hex");
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

/**
 * How long an invitation stays usable.
 *
 * Seven days: long enough for someone who is on leave the week they are
 * hired, short enough that a forwarded link found months later is dead.
 * Resending issues a NEW token and restarts the window — it never extends
 * the old one, so a leaked link cannot be revived.
 */
export const INVITE_TTL_DAYS = 7;

export function inviteExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * The link an invited person opens. Absolute, because it is sent by email
 * and pasted into WhatsApp — a relative path is useless there.
 */
export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/invite/${encodeURIComponent(token)}`;
}
