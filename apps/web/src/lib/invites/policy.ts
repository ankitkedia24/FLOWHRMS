import { STATUS, type Status } from "@/lib/status";

/**
 * Invitation rules that do not touch a database, so they can be tested
 * exhaustively and reused by both the server action and the screen.
 *
 * Two things here matter more than they look:
 *
 * 1. EXPIRY IS COMPUTED, NOT STORED. A row can say PENDING while its
 *    `expiresAt` is in the past — no job runs to flip it. The status a
 *    person is shown is derived from the clock, so the directory can never
 *    claim an invitation is live when it is not.
 *
 * 2. DUPLICATE MESSAGES NEVER LEAK ANOTHER TENANT'S DATA. "Already on your
 *    team" and "belongs to someone else" are different facts, and only the
 *    first is yours to know (Product Constitution §2).
 */

export type InviteRowStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";

export interface InviteSnapshot {
  status: InviteRowStatus;
  expiresAt: Date;
  acceptedAt?: Date | null;
}

/**
 * A company that signed itself up may not invite anyone until its owner
 * has confirmed their email — otherwise anyone could register in someone
 * else's name and start inviting "their" staff. People added before then
 * are kept, and their invitations go out by themselves the moment the
 * owner confirms (held.ts).
 */
export function invitationsHeld(tenant: {
  selfSignup: boolean;
  ownerEmailVerifiedAt: Date | null;
}): boolean {
  return tenant.selfSignup && !tenant.ownerEmailVerifiedAt;
}

/** What the owner is told when an invitation is held. */
export const INVITE_HELD_REASON =
  "Their invitation goes out by itself as soon as you confirm your email address — use the link we sent when you signed up, or “Send it again” at the top of the page.";

/**
 * The status to SHOW. A PENDING row past its expiry is Expired, whatever
 * the column says. `held`: nothing was ever sent because the company's
 * invitations are held (and this person has an email to send to).
 */
export function computeInviteStatus(
  invite: InviteSnapshot | null,
  now: Date,
  held = false,
): Status {
  if (!invite) return held ? STATUS.inviteHeld : STATUS.inviteNotSent;
  switch (invite.status) {
    case "ACCEPTED":
      return STATUS.inviteAccepted;
    case "REVOKED":
      return STATUS.inviteRevoked;
    case "EXPIRED":
      return STATUS.inviteExpired;
    case "PENDING":
      return invite.expiresAt.getTime() <= now.getTime()
        ? STATUS.inviteExpired
        : STATUS.invitePending;
  }
}

/** Is this token still usable? The only question the accept page asks. */
export function isInviteRedeemable(
  invite: InviteSnapshot,
  now: Date,
): { ok: true } | { ok: false; reason: string } {
  if (invite.status === "ACCEPTED") {
    return {
      ok: false,
      reason:
        "This invitation has already been used. Sign in with your password, or use “Forgot password”.",
    };
  }
  if (invite.status === "REVOKED") {
    return {
      ok: false,
      reason:
        "This invitation was withdrawn. Ask your admin to send a new one.",
    };
  }
  if (invite.expiresAt.getTime() <= now.getTime()) {
    return {
      ok: false,
      reason:
        "This invitation has expired. Ask your admin to send a new one — it takes them a moment.",
    };
  }
  return { ok: true };
}

/** How long before an admin may resend, and how many times in total. */
export const RESEND_COOLDOWN_MS = 2 * 60 * 1000;
export const MAX_RESENDS = 5;

export interface ResendSnapshot {
  status: InviteRowStatus;
  resendCount: number;
  lastResendAt?: Date | null;
}

/**
 * Resending is allowed for anything not yet accepted — including an expired
 * invitation, which is the common case and issues a fresh token.
 */
export function canResendInvite(
  invite: ResendSnapshot,
  now: Date,
): { allowed: true } | { allowed: false; reason: string } {
  if (invite.status === "ACCEPTED") {
    return {
      allowed: false,
      reason: "They have already joined. Nothing to resend.",
    };
  }
  if (invite.resendCount >= MAX_RESENDS) {
    return {
      allowed: false,
      reason: `Sent ${MAX_RESENDS} times already. Check the email address is right, or share the link with them directly.`,
    };
  }
  if (invite.lastResendAt) {
    const waited = now.getTime() - invite.lastResendAt.getTime();
    if (waited < RESEND_COOLDOWN_MS) {
      const seconds = Math.ceil((RESEND_COOLDOWN_MS - waited) / 1000);
      return {
        allowed: false,
        reason: `Just sent. You can send again in ${seconds} second${seconds === 1 ? "" : "s"}.`,
      };
    }
  }
  return { allowed: true };
}

// ------------------------------------------------------------ identifiers

/**
 * Normalise an Indian mobile number to E.164 for duplicate detection.
 * "+91 98765 43210", "098765-43210" and "9876543210" are the same person,
 * and a workforce app that lets them be three records is broken.
 */
export function normaliseMobile(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Enter a mobile number." };

  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (hadPlus) {
    if (digits.length < 8 || digits.length > 15) {
      return { ok: false, error: "That mobile number doesn't look right." };
    }
    return { ok: true, value: `+${digits}` };
  }

  // Bare Indian forms: 10 digits, optionally with a 0 or 91 in front.
  let local = digits;
  if (local.length === 12 && local.startsWith("91")) local = local.slice(2);
  else if (local.length === 11 && local.startsWith("0")) local = local.slice(1);

  if (local.length !== 10) {
    return {
      ok: false,
      error:
        "Enter a 10-digit mobile number, or the full number with its country code.",
    };
  }
  if (!/^[6-9]/.test(local)) {
    return {
      ok: false,
      error: "An Indian mobile number starts with 6, 7, 8 or 9.",
    };
  }
  return { ok: true, value: `+91${local}` };
}

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Employee codes are compared case- and space-insensitively. */
export function normaliseEmployeeCode(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

// ------------------------------------------------------------- duplicates

export type ClashField = "email" | "mobile" | "employeeCode";

export interface ClashInput {
  /** A membership in THIS tenant already uses this identifier. */
  inThisTenant: boolean;
  /** A platform user elsewhere holds it. Never surfaced as such. */
  heldElsewhere: boolean;
  field: ClashField;
  /** Who holds it in this tenant, when we are allowed to say. */
  holderName?: string;
}

/**
 * The message to show — or null when there is no problem.
 *
 * A globally-unique identifier held by ANOTHER tenant is a real conflict
 * (one login cannot have two passwords), but we must not confirm that the
 * address belongs to someone, nor to whom. So it gets a truthful,
 * uninformative message.
 */
export function describeClash(input: ClashInput): string | null {
  const noun =
    input.field === "email"
      ? "email address"
      : input.field === "mobile"
        ? "mobile number"
        : "employee ID";

  if (input.inThisTenant) {
    return input.holderName
      ? `${input.holderName} already uses this ${noun}.`
      : `Someone on your team already uses this ${noun}.`;
  }
  if (input.heldElsewhere && input.field !== "employeeCode") {
    return `This ${noun} can't be used here. Use a different one for this person.`;
  }
  return null;
}

// ------------------------------------------------------- sign-in readiness

/**
 * Whether an employee record can actually become a login.
 *
 * Being honest about this is the whole point: an SME hires people who have
 * no email address, and FlowHRMS should still hold their attendance and pay.
 * What it must NOT do is imply they can sign in when no invitation can
 * reach them (phone sign-in is still blocked on D-P1-05).
 */
export function describeSignInReadiness(email: string | null | undefined): {
  canInvite: boolean;
  note: string;
} {
  if (email && email.trim()) {
    return {
      canInvite: true,
      note: "They will get an email to set their password.",
    };
  }
  return {
    canInvite: false,
    note: "No email, so we can't send an invitation. Their record is saved — add an email later, or copy the invitation link and send it to them yourself.",
  };
}
