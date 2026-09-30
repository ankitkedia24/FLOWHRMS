/**
 * The rules for the code emailed to Flowacord before a company is locked
 * out — suspended, or its free trial ended now. No platform admin can do
 * either without it, whoever they are (owner decision, 30 Sept 2026).
 *
 * Pure, and tested in src/tests/platform-lockout.test.ts; lockout-code.ts
 * does the database and the email.
 */
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS } from "@/lib/signup/otp";

/**
 * Where every code goes. Fixed here — not a setting, not an environment
 * variable — so nobody can send the codes somewhere else from a screen or
 * a hosting panel, a platform admin included. Changing it is a code change,
 * and it shows in git.
 */
export const PLATFORM_APPROVAL_EMAIL = "info@flowacord.com";

export type LockoutAction = "SUSPEND" | "END_TRIAL";

/** A code works for ten minutes. */
export const LOCKOUT_CODE_TTL_MS = OTP_TTL_MS;
/** Wrong tries on one code before it stops working. */
export const LOCKOUT_MAX_ATTEMPTS = OTP_MAX_ATTEMPTS;
/** The gap before one admin may ask for another code. */
export const LOCKOUT_RESEND_SECONDS = 60;
/** Codes one admin may ask for in an hour, across every company. */
export const LOCKOUT_MAX_PER_HOUR = 5;

/** How each action reads in the email and on screen. */
export const LOCKOUT_WORDS: Record<LockoutAction, { doing: string; consequence: string }> = {
  SUSPEND: {
    doing: "suspend",
    consequence: "Nobody there will be able to sign in until the company is restored.",
  },
  END_TRIAL: {
    doing: "end the free trial of",
    consequence: "Everyone there will be paused until the company pays.",
  },
};

export type Refusal = { ok: false; error: string; waitSeconds?: number };

/** May this admin be sent another code right now? */
export function lockoutSendGate(
  history: { lastSentAt: Date | null; sentInLastHour: number },
  now: Date,
): { ok: true } | Refusal {
  if (history.sentInLastHour >= LOCKOUT_MAX_PER_HOUR) {
    return {
      ok: false,
      error: `You've asked for ${LOCKOUT_MAX_PER_HOUR} codes in the last hour. Try again later.`,
    };
  }
  if (history.lastSentAt) {
    const wait = LOCKOUT_RESEND_SECONDS - Math.floor((now.getTime() - history.lastSentAt.getTime()) / 1000);
    if (wait > 0) {
      return { ok: false, error: `Wait ${wait} seconds before asking for another code.`, waitSeconds: wait };
    }
  }
  return { ok: true };
}

/**
 * Is the company in a state this action applies to? Checked when the code
 * is asked for and again when it is used — the company may have changed
 * in between.
 */
export function lockoutPrecondition(
  action: LockoutAction,
  tenant: { status: string; plan: string; trialEndsAt: Date | null },
  now: Date,
): string | null {
  if (action === "SUSPEND") {
    if (tenant.status === "SUSPENDED") return "This company is already suspended.";
    if (tenant.status !== "ACTIVE") return "Only an active company can be suspended.";
    return null;
  }
  if (tenant.plan !== "TRIAL") {
    return "Only a free trial can be ended. To stop a paying company's access, suspend it.";
  }
  if (tenant.trialEndsAt && tenant.trialEndsAt <= now) return "Their trial has already ended.";
  return null;
}

export interface LockoutCodeRow {
  action: LockoutAction;
  tenantId: string;
  requestedById: string;
  attempts: number;
  expiresAt: Date;
  usedAt: Date | null;
}

/**
 * Why this code can't even be tried for this request, or null if it can.
 * A code works only for the company, the action and the admin it was sent
 * for — a code someone else asked for is useless to you.
 */
export function lockoutCodeRefusal(
  row: LockoutCodeRow | null,
  want: { action: LockoutAction; tenantId: string; userId: string },
  now: Date,
): string | null {
  if (!row) return "That code has expired. Ask for a new one.";
  if (row.requestedById !== want.userId || row.tenantId !== want.tenantId || row.action !== want.action) {
    return "That code was sent for something else. Ask for a new one.";
  }
  if (row.usedAt) return "That code has already been used. Ask for a new one.";
  if (row.expiresAt <= now) return "That code has expired. Ask for a new one.";
  if (row.attempts >= LOCKOUT_MAX_ATTEMPTS) return "Too many wrong tries. Ask for a new code.";
  return null;
}

/** What a wrong code is told, given the tries used including this one. */
export function wrongCodeMessage(attemptsUsed: number): string {
  const left = LOCKOUT_MAX_ATTEMPTS - attemptsUsed;
  return left > 0
    ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`
    : "Too many wrong tries. Ask for a new code.";
}
