"use server";

import { getDb } from "@/lib/db";
import { provisionTenant } from "@/lib/platform/provision";
import { loadTrialSettings } from "@/lib/platform/settings";
import { slugify } from "@/lib/platform/slug";
import { CURRENT_DOCUMENTS } from "@/lib/consent/documents";
import { choicesFor } from "@/lib/consent/chain";
import { appendConsents, requestMeta } from "@/lib/consent/record";
import { generateInviteToken, hashInviteToken } from "@/lib/invites/token";
import { emailConfigured, sendMail } from "@/lib/email/send";
import { verifyEmailMessage } from "@/lib/email/templates";
import {
  EMAIL_TAKEN,
  MOBILE_TAKEN,
  MAX_SIGNUPS_PER_HOUR,
  MAX_SIGNUPS_PER_IP_PER_HOUR,
  signupSchema,
  trialEndsAt,
  type SignupInput,
} from "./validate";

/**
 * Start a free trial — the second unauthenticated write in FlowHRMS (the
 * first is the old enquiry form). So it assumes nothing: it validates
 * everything the form already checked, refuses bots and floods, and only
 * counts consent boxes the person actually ticked.
 *
 * The company is created by the SAME code the Flowacord team uses
 * (provisionTenant), with the consent records written inside that
 * transaction: no company exists without its registrant's recorded
 * consent, and no consent record points at a company that failed.
 *
 * The owner's one-time password link is returned to this browser only —
 * the person who just filled the form — and never emailed. What is emailed
 * is a separate link proving the address, which unlocks inviting staff.
 */

export type StartTrialResult =
  | {
      ok: true;
      token: string;
      companyName: string;
      ownerFirstName: string;
      email: string;
      trialEndsAt: string;
      trialDays: number;
      verificationEmailSent: boolean;
    }
  | { ok: false; error: string; field?: string; step?: number };

const STEP_OF: Record<string, number> = {
  companyName: 1,
  staffCount: 1,
  industry: 1,
  pincode: 2,
  state: 2,
  city: 2,
  name: 3,
  email: 3,
  mobile: 3,
  role: 3,
  heardFrom: 3,
  consents: 4,
};

const VERIFY_TTL_DAYS = 7;

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://hrms.flowacord.com";
}

export async function startTrialAction(input: SignupInput): Promise<StartTrialResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? "");
    return { ok: false, error: issue?.message ?? "Check the form.", field, step: STEP_OF[field] };
  }
  const data = parsed.data;

  // Silent to the sender: telling a bot which check caught it is free help.
  if (data.website?.trim()) return { ok: false, error: "That didn't go through. Try again." };

  // Consent: every required box, and only what was ticked.
  const account = choicesFor(CURRENT_DOCUMENTS.account_holder, data.consents.account_holder);
  const company = choicesFor(CURRENT_DOCUMENTS.customer_terms, data.consents.customer_terms);
  if (!account.ok || !company.ok) {
    return {
      ok: false,
      error: "Tick every box marked Required to start your trial.",
      field: "consents",
      step: 4,
    };
  }

  const db = getDb();
  const meta = await requestMeta();
  const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recentAll, recentFromIp, existingEmail, existingPhone] = await Promise.all([
    db.tenant.count({ where: { selfSignup: true, createdAt: { gte: anHourAgo } } }),
    meta.ipAddress
      ? db.consentRecord.count({
          where: {
            ipAddress: meta.ipAddress,
            method: "checkbox+submit:/start",
            noticeKey: "account_holder",
            createdAt: { gte: anHourAgo },
          },
        })
      : Promise.resolve(0),
    db.user.findUnique({ where: { email: data.email }, select: { id: true } }),
    db.user.findUnique({ where: { phone: `+91${data.mobile}` }, select: { id: true } }),
  ]);
  if (recentAll >= MAX_SIGNUPS_PER_HOUR || recentFromIp >= MAX_SIGNUPS_PER_IP_PER_HOUR) {
    return {
      ok: false,
      error: `We're getting an unusual number of sign-ups right now. Please try again in an hour, or write to us at help@flowacord.com.`,
    };
  }
  if (existingEmail) {
    return {
      ok: false,
      error: EMAIL_TAKEN,
      field: "email",
      step: 3,
    };
  }
  if (existingPhone) {
    return {
      ok: false,
      error: MOBILE_TAKEN,
      field: "mobile",
      step: 3,
    };
  }

  const settings = await loadTrialSettings();
  const endsAt = trialEndsAt(new Date(), settings.days);
  const slug = await uniqueSlug(data.companyName);

  let result;
  try {
    result = await provisionTenant(db, {
      name: data.companyName,
      ownerEmail: data.email,
      ownerName: data.name,
      slug,
      origin: siteOrigin(),
      actor: { type: "SYSTEM", via: "self-signup /start" },
      enabledModules: settings.modules,
      trial: {
        endsAt,
        ownerPhone: `+91${data.mobile}`,
        profile: {
          industry: data.industry,
          staffCount: data.staffCount,
          addressPincode: data.pincode,
          addressCity: data.city,
          addressState: data.state,
          addressCountry: "India",
          signupRole: data.role,
          signupHeardFrom: data.heardFrom ?? null,
        },
      },
      onCreated: async (tx, created) => {
        const base = {
          subject: "ACCOUNT_HOLDER" as const,
          action: "GRANTED" as const,
          userId: created.userId,
          email: data.email,
          tenantId: created.tenantId,
          tenantName: data.companyName,
          method: "checkbox+submit:/start",
          ...meta,
        };
        await appendConsents(tx, [
          { ...base, noticeKey: "account_holder", purposes: account.choices },
          {
            ...base,
            noticeKey: "customer_terms",
            purposes: company.choices,
            withDocuments: ["terms", "privacy"],
          },
        ]);
      },
    });
  } catch (error) {
    console.error("[signup] company creation failed", error);
    return {
      ok: false,
      error: "We couldn't set up your company just now. Nothing was saved — please try again in a minute.",
    };
  }
  if (!result.ok) return { ok: false, error: result.error };

  // Prove the email address. Until it is, the company cannot invite staff.
  const verifyToken = generateInviteToken();
  await db.emailVerification.create({
    data: {
      tenantId: result.tenantId,
      userId: result.ownerUserId,
      email: data.email,
      tokenHash: hashInviteToken(verifyToken),
      expiresAt: new Date(Date.now() + VERIFY_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  let verificationEmailSent = false;
  if (emailConfigured()) {
    const message = verifyEmailMessage({
      name: data.name,
      companyName: data.companyName,
      url: `${siteOrigin()}/verify-email/${encodeURIComponent(verifyToken)}`,
      trialEndsAt: endsAt,
    });
    const sent = await sendMail({ to: data.email, ...message });
    verificationEmailSent = sent.sent;
  }

  return {
    ok: true,
    token: result.inviteToken,
    companyName: data.companyName,
    ownerFirstName: data.name.trim().split(/\s+/)[0],
    email: data.email,
    trialEndsAt: endsAt.toISOString(),
    trialDays: settings.days,
    verificationEmailSent,
  };
}

/** "amit-book-depot", or "amit-book-depot-2" if that is taken. */
async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "company";
  const taken = new Set(
    (
      await getDb().tenant.findMany({
        where: { slug: { startsWith: base } },
        select: { slug: true },
      })
    ).map((t) => t.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}
