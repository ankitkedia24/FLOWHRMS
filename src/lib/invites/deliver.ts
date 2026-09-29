import "server-only";

import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { sendMail } from "@/lib/email/send";
import { inviteEmail } from "@/lib/email/templates";
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiryFrom,
  inviteUrl,
} from "./token";

/**
 * Issuing an invitation: a fresh token, its row, and the email.
 *
 * Shared by the admin's own actions (add, send again) and by the
 * invitations that were held until a self-serve owner confirmed their
 * email (held.ts) — which run with nobody signed in, so the company and
 * the inviter are passed in rather than read from a session.
 */

export interface InviteFrom {
  tenantId: string;
  companyName: string;
  timeZone: string;
  /** Recorded on the row, when a person did it. */
  invitedByUserId: string | null;
  /** Named in the email: "{name} has set up an account for you". */
  invitedByName: string;
}

export interface InviteTo {
  membershipId: string;
  employeeName: string;
  email: string;
  isResend: boolean;
}

export interface InviteDelivery {
  sent: boolean;
  link: string | null;
  reason?: string;
}

/** Absolute origin for links that leave the app. */
export async function appOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Create a fresh token and try to deliver it.
 *
 * A resend always issues a NEW token and revokes the old one, so a link
 * that leaked cannot be revived by asking an admin to "send it again".
 */
export async function deliverInvite(from: InviteFrom, to: InviteTo): Promise<InviteDelivery> {
  const db = getDb();
  const now = new Date();
  const token = generateInviteToken();
  const link = inviteUrl(await appOrigin(), token);

  const previous = await db.employeeInvite.findFirst({
    where: { membershipId: to.membershipId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  await db.$transaction(async (tx) => {
    if (previous) {
      await tx.employeeInvite.update({
        where: { id: previous.id },
        data: { status: "REVOKED", revokedAt: now },
      });
    }
    await tx.employeeInvite.create({
      data: {
        tenantId: from.tenantId,
        membershipId: to.membershipId,
        tokenHash: hashInviteToken(token),
        channel: "EMAIL",
        status: "PENDING",
        sentToEmail: to.email,
        expiresAt: inviteExpiryFrom(now),
        sentAt: now,
        resendCount: to.isResend ? (previous?.resendCount ?? 0) + 1 : 0,
        lastResendAt: to.isResend ? now : null,
        createdById: from.invitedByUserId,
      },
    });
  });

  const body = inviteEmail({
    employeeName: to.employeeName,
    companyName: from.companyName,
    invitedByName: from.invitedByName,
    url: link,
    expiresAt: inviteExpiryFrom(now),
    timeZone: from.timeZone,
    isResend: to.isResend,
  });

  const result = await sendMail({ to: to.email, ...body });
  return { sent: result.sent, link, reason: result.reason };
}
