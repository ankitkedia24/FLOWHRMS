"use server";

/**
 * PAUSED (28 Sept 2026, owner's decision): email/mobile one-time codes at
 * sign-up are built but not wired into /start. Nothing imports this file.
 * Resume only when the owner asks; mobile needs MSG91 keys (see msg91.ts).
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requestMeta } from "@/lib/consent/record";
import { emailConfigured, sendMail } from "@/lib/email/send";
import { signupCodeEmail } from "@/lib/email/templates";
import { normaliseEmail } from "@/lib/invites/policy";
import { normalisePhone } from "@/lib/platform/demo-requests";
import { sendOtpSms, smsConfigured } from "@/lib/sms/msg91";
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_IP_PER_HOUR,
  OTP_MAX_PER_TARGET_PER_HOUR,
  OTP_RESEND_SECONDS,
  OTP_TTL_MS,
  generateOtp,
  hashOtp,
  otpMatches,
  resendWaitSeconds,
} from "./otp";

/**
 * Proving the email address and mobile number on the sign-up form itself
 * (/start, step 3), before the company exists. Public, so every call is
 * rate-limited by address, by number and by device; codes are hashed,
 * expire in 10 minutes and lock after 5 wrong tries.
 */

export type SendCodeResult =
  | { ok: true; id: string; resendIn: number }
  | { ok: false; error: string; resendIn?: number };

export type CheckCodeResult = { ok: true } | { ok: false; error: string; expired?: boolean };

const sendSchema = z.object({
  channel: z.enum(["EMAIL", "SMS"]),
  target: z.string().trim().min(3).max(200),
  /** Honeypot, as on the form itself. */
  website: z.string().optional(),
});

export async function sendSignupCodeAction(input: z.input<typeof sendSchema>): Promise<SendCodeResult> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter the email address or number first." };
  if (parsed.data.website?.trim()) return { ok: false, error: "That didn't go through. Try again." };
  const { channel } = parsed.data;

  let target: string;
  if (channel === "EMAIL") {
    target = normaliseEmail(parsed.data.target);
    if (!z.string().email().safeParse(target).success) return { ok: false, error: "Enter a valid email address." };
    if (!emailConfigured()) return { ok: false, error: "Email codes aren't available right now. Try again later." };
  } else {
    const mobile = normalisePhone(parsed.data.target);
    if (!mobile) return { ok: false, error: "Enter a 10-digit mobile number starting 6, 7, 8 or 9." };
    target = mobile;
    if (!smsConfigured()) return { ok: false, error: "Mobile codes aren't available yet." };
  }

  const db = getDb();
  const now = new Date();
  const anHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const meta = await requestMeta();

  // Already a FlowHRMS account? Say so now, not after the code.
  const existing =
    channel === "EMAIL"
      ? await db.user.findUnique({ where: { email: target }, select: { id: true } })
      : await db.user.findUnique({ where: { phone: `+91${target}` }, select: { id: true } });
  if (existing) {
    return {
      ok: false,
      error:
        channel === "EMAIL"
          ? "This email already has a FlowHRMS account. Sign in, or use “Forgot password” on the sign-in page."
          : "This mobile number is already on a FlowHRMS account. Use a different number, or sign in.",
    };
  }

  const [recent, lastForTarget, fromIp] = await Promise.all([
    db.signupVerification.count({ where: { channel, target, createdAt: { gte: anHourAgo } } }),
    db.signupVerification.findFirst({
      where: { channel, target },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    meta.ipAddress
      ? db.signupVerification.count({ where: { ipAddress: meta.ipAddress, createdAt: { gte: anHourAgo } } })
      : Promise.resolve(0),
  ]);
  const wait = resendWaitSeconds(lastForTarget?.createdAt ?? null, now);
  if (wait > 0) return { ok: false, error: `Wait ${wait} seconds before asking for another code.`, resendIn: wait };
  if (recent >= OTP_MAX_PER_TARGET_PER_HOUR || fromIp >= OTP_MAX_PER_IP_PER_HOUR) {
    return { ok: false, error: "Too many codes requested. Try again in an hour, or write to help@flowacord.com." };
  }

  const code = generateOtp();
  const id = randomUUID();
  const row = await db.signupVerification.create({
    data: {
      id,
      channel,
      target,
      codeHash: hashOtp(id, code),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      ipAddress: meta.ipAddress,
    },
  });

  const delivered =
    channel === "EMAIL"
      ? await sendMail({ to: target, ...signupCodeEmail({ code }) })
      : await sendOtpSms(target, code);
  if (!delivered.sent) {
    // A code nobody received must not count against them.
    await db.signupVerification.delete({ where: { id: row.id } }).catch(() => undefined);
    return {
      ok: false,
      error:
        channel === "EMAIL"
          ? "We couldn't send the email just now. Check the address and try again."
          : "We couldn't send the SMS just now. Check the number and try again.",
    };
  }
  return { ok: true, id: row.id, resendIn: OTP_RESEND_SECONDS };
}

const checkSchema = z.object({
  id: z.string().uuid(),
  code: z.string().trim().max(12),
});

export async function checkSignupCodeAction(input: z.input<typeof checkSchema>): Promise<CheckCodeResult> {
  const parsed = checkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter the 6-digit code." };
  const db = getDb();
  const row = await db.signupVerification.findUnique({ where: { id: parsed.data.id } });
  if (!row) return { ok: false, error: "That code has expired. Send a new one.", expired: true };
  if (row.verifiedAt) return { ok: true };
  if (row.expiresAt <= new Date()) return { ok: false, error: "That code has expired. Send a new one.", expired: true };
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many wrong tries. Send a new code.", expired: true };
  }
  if (!otpMatches(row.id, parsed.data.code, row.codeHash)) {
    const updated = await db.signupVerification.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    const left = OTP_MAX_ATTEMPTS - updated.attempts;
    return left > 0
      ? { ok: false, error: `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` }
      : { ok: false, error: "Too many wrong tries. Send a new code.", expired: true };
  }
  await db.signupVerification.update({ where: { id: row.id }, data: { verifiedAt: new Date() } });
  return { ok: true };
}
