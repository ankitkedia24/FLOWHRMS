"use server";

import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/authz/guard";
import { emailConfigured, sendMail } from "@/lib/email/send";
import { verifyEmailMessage } from "@/lib/email/templates";
import { generateInviteToken, hashInviteToken } from "@/lib/invites/token";

/** Send the email-confirmation link again (self-signup owners only). */
export async function resendVerificationAction(): Promise<
  { ok: true; message: string } | { ok: false; error: string }
> {
  const session = await requireSession();
  if (session.membership.roleKey !== "OWNER" || !session.tenant.selfSignup) {
    return { ok: false, error: "There is nothing to confirm on this account." };
  }
  if (session.tenant.ownerEmailVerifiedAt) {
    return { ok: true, message: "Your email is already confirmed." };
  }
  if (!emailConfigured()) {
    return {
      ok: false,
      error: "Email isn't set up yet. Write to help@flowacord.com and we'll confirm it for you.",
    };
  }
  const db = getDb();
  const recent = await db.emailVerification.count({
    where: {
      tenantId: session.tenant.id,
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
  });
  if (recent >= 3) {
    return {
      ok: false,
      error: "We've sent it a few times already. Check your spam folder, or try again in ten minutes.",
    };
  }
  const token = generateInviteToken();
  await db.emailVerification.create({
    data: {
      tenantId: session.tenant.id,
      userId: session.user.id,
      email: session.user.email ?? "",
      tokenHash: hashInviteToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://hrms.flowacord.com";
  const sent = await sendMail({
    to: session.user.email ?? "",
    ...verifyEmailMessage({
      name: session.user.displayName,
      companyName: session.tenant.name,
      url: `${origin}/verify-email/${encodeURIComponent(token)}`,
      trialEndsAt: session.tenant.trialEndsAt ?? new Date(),
    }),
  });
  return sent.sent
    ? { ok: true, message: `Sent to ${session.user.email}. Check your inbox (and spam).` }
    : { ok: false, error: sent.reason ?? "The email didn't go through." };
}
