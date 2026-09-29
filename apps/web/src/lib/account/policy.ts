/**
 * Password-change rules. Pure, so the wording and the limits are tested
 * rather than discovered by the first owner who tries to change theirs.
 *
 * The limits match the invitation page (src/lib/invites/accept.ts): one
 * rule for "what is an acceptable password", stated once.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type PasswordChangeField = keyof PasswordChangeInput;

export interface PasswordChangeProblem {
  field: PasswordChangeField;
  message: string;
}

/** First problem with the input, or null when it can be sent. */
export function validatePasswordChange(
  input: PasswordChangeInput,
): PasswordChangeProblem | null {
  if (!input.currentPassword) {
    return { field: "currentPassword", message: "Enter your current password." };
  }
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      field: "newPassword",
      message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (input.newPassword.length > MAX_PASSWORD_LENGTH) {
    return { field: "newPassword", message: "That password is too long." };
  }
  if (input.newPassword === input.currentPassword) {
    return {
      field: "newPassword",
      message: "Choose a password that is different from your current one.",
    };
  }
  if (input.confirmPassword !== input.newPassword) {
    return { field: "confirmPassword", message: "Both passwords must match." };
  }
  return null;
}

/**
 * Failed current-password checks are counted per person.
 *
 * Verifying the current password means asking Supabase to sign in with it,
 * and that request leaves from the server — so every company shares one
 * IP address in Supabase's own per-IP sign-in limit. Without a limit of
 * our own, one person guessing at a colleague's password could exhaust
 * that shared allowance for everybody. Five wrong answers in a quarter of
 * an hour is generous for a person and useless for a script.
 *
 * In memory, per process: the deployment is a single instance, and a
 * restart forgetting a few counters is an acceptable trade for not adding
 * a table. Documented in SECURITY-NOTES.md.
 */
export const MAX_FAILED_ATTEMPTS = 5;
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export class PasswordAttemptLimiter {
  private readonly failures = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  /** Seconds until this person may try again; 0 when they may try now. */
  retryAfterSeconds(userId: string): number {
    const entry = this.failures.get(userId);
    if (!entry) return 0;
    const t = this.now();
    if (t >= entry.resetAt) {
      this.failures.delete(userId);
      return 0;
    }
    if (entry.count < MAX_FAILED_ATTEMPTS) return 0;
    return Math.ceil((entry.resetAt - t) / 1000);
  }

  recordFailure(userId: string): void {
    const t = this.now();
    const entry = this.failures.get(userId);
    if (!entry || t >= entry.resetAt) {
      this.failures.set(userId, { count: 1, resetAt: t + ATTEMPT_WINDOW_MS });
      return;
    }
    entry.count += 1;
  }

  clear(userId: string): void {
    this.failures.delete(userId);
  }
}

/** "Try again in 12 minutes." — never "in 0 minutes". */
export function describeRetryWait(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Too many wrong attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or use "Forgot password" on the sign-in page.`;
}
