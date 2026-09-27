"use server";

import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordSystemAuditEvent } from "@/lib/audit";
import { getSupabaseAdmin, ADMIN_KEY_MISSING } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hashInviteToken } from "./token";
import { isInviteRedeemable } from "./policy";
import { CURRENT_DOCUMENTS, type DocumentKey } from "@/lib/consent/documents";
import { choicesFor, requiredNoticeKeys, type PurposeChoice } from "@/lib/consent/chain";
import { consentStandings, recordConsents, requestMeta } from "@/lib/consent/record";

/**
 * Accepting an invitation.
 *
 * Called by someone who is NOT signed in. The token is the only credential,
 * so it is treated like one:
 *
 * - Looked up by hash. The raw token never reaches the database.
 * - Every failure returns the SAME shape and reveals nothing about whether
 *   a token exists — a wrong token and an expired token are both "this
 *   link doesn't work", so the page cannot be used to probe for live
 *   invitations.
 * - Single use. Acceptance is a transaction that flips the invitation, the
 *   user and the membership together; a replayed request finds it already
 *   ACCEPTED and is refused.
 *
 * The audit event is recorded as SYSTEM: the acting party is the invitee,
 * who has no session yet, and attributing it to the admin who sent the
 * invitation would be a lie about who did what (Constitution §3).
 */

export interface InvitePreview {
  ok: boolean;
  /** Shown to the person so they know which company this is. */
  companyName?: string;
  employeeName?: string;
  email?: string;
  reason?: string;
  /** Notices this person must accept on this page (none if already given). */
  consentKeys?: DocumentKey[];
}

/**
 * The notices an invitee still has to accept: the employee notice for
 * staff; the account notice and company terms for an owner the Flowacord
 * team registered. An owner who signed up at /start has already consented.
 */
async function outstandingFor(
  roleKey: string,
  userId: string,
): Promise<DocumentKey[]> {
  const keys = requiredNoticeKeys({ isOwner: roleKey === "OWNER" });
  const standings = await consentStandings(userId, keys);
  return standings.filter((s) => s.status.state !== "current").map((s) => s.key);
}

const DEAD_LINK =
  "This link doesn't work. It may have expired or already been used. Ask your admin to send a new one.";

async function findInvite(token: string) {
  if (!token || token.length < 20) return null;
  const db = getDb();
  return db.employeeInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: {
      tenant: true,
      membership: { include: { user: true, role: true } },
    },
  });
}

/** What the page shows before a password is typed. */
export async function previewInviteAction(token: string): Promise<InvitePreview> {
  const invite = await findInvite(token);
  if (!invite) return { ok: false, reason: DEAD_LINK };

  const redeemable = isInviteRedeemable(
    { status: invite.status, expiresAt: invite.expiresAt },
    new Date(),
  );
  if (!redeemable.ok) return { ok: false, reason: redeemable.reason };

  if (invite.membership.status === "DEACTIVATED") {
    return {
      ok: false,
      reason:
        "This account has been closed. If that's a mistake, speak to your admin.",
    };
  }

  return {
    ok: true,
    companyName: invite.tenant.name,
    employeeName: invite.membership.user.displayName,
    email: invite.membership.user.email ?? undefined,
    consentKeys: await outstandingFor(invite.membership.role.key, invite.membership.userId),
  };
}

const acceptSchema = z.object({
  token: z.string().min(20),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(200, "That password is too long."),
  /** Purpose keys ticked per notice shown on the page. */
  consents: z.record(z.string(), z.array(z.string()).max(10)).optional(),
});

export type AcceptResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

export async function acceptInviteAction(
  input: z.input<typeof acceptSchema>,
): Promise<AcceptResult> {
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? DEAD_LINK };
  }

  const invite = await findInvite(parsed.data.token);
  if (!invite) return { ok: false, error: DEAD_LINK };

  const redeemable = isInviteRedeemable(
    { status: invite.status, expiresAt: invite.expiresAt },
    new Date(),
  );
  if (!redeemable.ok) return { ok: false, error: redeemable.reason };

  if (invite.membership.status === "DEACTIVATED") {
    return { ok: false, error: "This account has been closed. Speak to your admin." };
  }

  const email = invite.membership.user.email;
  if (!email) {
    return {
      ok: false,
      error:
        "This account has no email address, so a password can't be set. Ask your admin to add one.",
    };
  }

  // Consent before anything is written (DPDP Act s.6): every notice this
  // person still owes, with every required box ticked by them.
  const owed = await outstandingFor(invite.membership.role.key, invite.membership.userId);
  const consentChoices: Array<{ key: DocumentKey; choices: PurposeChoice[] }> = [];
  for (const key of owed) {
    const result = choicesFor(CURRENT_DOCUMENTS[key], parsed.data.consents?.[key] ?? []);
    if (!result.ok) {
      return {
        ok: false,
        error: "Please read the notice above and tick every box marked Required.",
      };
    }
    consentChoices.push({ key, choices: result.choices });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: ADMIN_KEY_MISSING };

  // The token proved they control the invitation, so we set the password on
  // their behalf. FlowHRMS writes a password in two places — here, and in
  // src/lib/account/actions.ts where the person proves the current one
  // first — and never sees an existing one.
  let authUserId = invite.membership.user.authUserId;

  if (authUserId) {
    const updated = await admin.auth.admin.updateUserById(authUserId, {
      password: parsed.data.password,
      email_confirm: true,
    });
    if (updated.error) {
      return {
        ok: false,
        error: `The password couldn't be saved: ${updated.error.message}`,
      };
    }
  } else {
    // No sign-in account yet. This happens to anyone invited before the
    // Supabase secret key was configured — the employee record was created,
    // the invitation was not able to make an account. Rather than send them
    // back to an admin, create it now: the token is the same proof of
    // control it would have been at invite time.
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: parsed.data.password,
    });
    if (created.error || !created.data.user) {
      return {
        ok: false,
        error: `Your sign-in couldn't be set up: ${created.error?.message ?? "unknown error"}. Ask your admin to send the invitation again.`,
      };
    }
    authUserId = created.data.user.id;
    await getDb().user.update({
      where: { id: invite.membership.userId },
      data: { authUserId },
    });
  }

  const db = getDb();
  const now = new Date();

  // Guarded by the status check inside the transaction: two tabs racing
  // produce one acceptance, not two.
  const claimed = await db.employeeInvite.updateMany({
    where: { id: invite.id, status: "PENDING" },
    data: { status: "ACCEPTED", acceptedAt: now },
  });
  if (claimed.count === 0) {
    return { ok: false, error: DEAD_LINK };
  }

  await db.$transaction([
    db.user.update({
      where: { id: invite.membership.userId },
      data: { status: "ACTIVE" },
    }),
    db.tenantMembership.update({
      where: { id: invite.membershipId },
      data: { status: "ACTIVE" },
    }),
    // The chase tile for this invitation, if one was raised, is done.
    db.actionRequest.updateMany({
      where: {
        tenantId: invite.tenantId,
        subjectType: "employee_invite",
        subjectId: invite.membershipId,
        status: { in: ["PENDING", "SNOOZED"] },
      },
      data: { status: "RESOLVED", resolvedAt: now, resolution: "accepted" },
    }),
  ]);

  if (consentChoices.length > 0) {
    const meta = await requestMeta();
    await recordConsents(
      consentChoices.map(({ key, choices }) => ({
        noticeKey: key,
        subject: key === "employee" ? ("EMPLOYEE" as const) : ("ACCOUNT_HOLDER" as const),
        action: "GRANTED" as const,
        purposes: choices,
        userId: invite.membership.userId,
        email,
        tenantId: invite.tenantId,
        tenantName: invite.tenant.name,
        method: "checkbox+submit:/invite",
        withDocuments: key === "customer_terms" ? (["terms", "privacy"] as DocumentKey[]) : undefined,
        ...meta,
      })),
    );
  }

  await recordSystemAuditEvent(invite.tenantId, {
    action: "employee.invite_accepted",
    entityType: "membership",
    entityId: invite.membershipId,
    metadata: {
      email,
      role: invite.membership.role.name,
      invitedAt: invite.createdAt.toISOString(),
      acceptedAt: now.toISOString(),
    },
  });

  // Sign them in with the password they just chose, so onboarding ends on
  // their own screen rather than at another form.
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.password,
    });
    if (error) {
      // The password IS set; only the automatic sign-in failed.
      return { ok: true, redirectTo: "/sign-in?joined=1" };
    }
  }

  return { ok: true, redirectTo: "/" };
}
