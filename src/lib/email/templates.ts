/**
 * Email bodies. Pure functions so the wording is unit-tested rather than
 * discovered in someone's inbox.
 *
 * Written to voice-and-microcopy.md: plain, specific, no marketing, no
 * urgency theatre. The recipient is a warehouse supervisor or a delivery
 * driver, and this may be the first they have heard of FlowHRMS — so the first
 * line says who it is from and why, and the deadline is a date rather than
 * "act now".
 *
 * Plain text is composed first and the HTML mirrors it exactly. Many
 * workers read mail in clients that strip HTML entirely, and the two must
 * not say different things.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatInviteDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(at);
}

export interface InviteEmailInput {
  employeeName: string;
  companyName: string;
  invitedByName: string;
  url: string;
  expiresAt: Date;
  timeZone: string;
  /** True when this is a repeat send, so the recipient is not confused. */
  isResend?: boolean;
}

export function inviteEmail(input: InviteEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const expiry = formatInviteDate(input.expiresAt, input.timeZone);
  const firstName = input.employeeName.trim().split(/\s+/)[0] || "there";

  const subject = input.isResend
    ? `Your ${input.companyName} sign-in link (sent again)`
    : `${input.companyName} has set up your FlowHRMS account`;

  const opening = input.isResend
    ? `Here is your sign-in link again, in case the first one didn't reach you.`
    : `${input.invitedByName} has set up an account for you on FlowHRMS, which ${input.companyName} uses for attendance, leave and daily work.`;

  const lines = [
    `Hello ${firstName},`,
    "",
    opening,
    "",
    "Set your password here:",
    input.url,
    "",
    `This link works until ${expiry}. After that, ask ${input.invitedByName} to send a new one.`,
    "",
    "Don't share this link — anyone who opens it can set the password on your account.",
    "",
    `If you weren't expecting this, you can ignore it and nothing will happen. You can also tell ${input.invitedByName}.`,
  ];
  const text = lines.join("\n");

  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#1A1A1A;max-width:520px">
<p>Hello ${escapeHtml(firstName)},</p>
<p>${escapeHtml(opening)}</p>
<p style="margin:28px 0">
  <a href="${escapeHtml(input.url)}" style="display:inline-block;background:#7166F3;color:#FFFFFF;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:600">Set your password</a>
</p>
<p style="font-size:14px;color:#5A5A5A">Or paste this into your browser:<br><span style="word-break:break-all">${escapeHtml(input.url)}</span></p>
<p>This link works until <strong>${escapeHtml(expiry)}</strong>. After that, ask ${escapeHtml(input.invitedByName)} to send a new one.</p>
<p><strong>Don't share this link</strong> — anyone who opens it can set the password on your account.</p>
<p style="font-size:14px;color:#5A5A5A">If you weren't expecting this, you can ignore it and nothing will happen. You can also tell ${escapeHtml(input.invitedByName)}.</p>
</div>`;

  return { subject, text, html };
}

export interface PasswordChangedEmailInput {
  name: string;
  at: Date;
  timeZone: string;
  signedOutOthers: boolean;
}

/**
 * Sent to the person whose password changed. Short, because the only
 * question it answers is "was that me?" — and if the answer is no, the
 * next line is what to do.
 */
export function passwordChangedEmail(input: PasswordChangedEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const when = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: input.timeZone,
  }).format(input.at);
  const firstName = input.name.trim().split(/\s+/)[0] || "there";

  const subject = "Your FlowHRMS password was changed";
  const devices = input.signedOutOthers
    ? "Your other devices were signed out at the same time."
    : "Your other devices stay signed in.";

  const lines = [
    `Hello ${firstName},`,
    "",
    `The password for your FlowHRMS account was changed on ${when}. ${devices}`,
    "",
    "If that was you, there is nothing to do.",
    "",
    "If it wasn't, change your password again now — from a signed-in device use Account, or from the sign-in page use \"Forgot password\" — and tell your company's admin or owner.",
    "",
    "FlowHRMS support (help@flowacord.com) never asks for your password.",
  ];
  const text = lines.join("\n");

  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#1A1A1A;max-width:520px">
<p>Hello ${escapeHtml(firstName)},</p>
<p>The password for your FlowHRMS account was changed on <strong>${escapeHtml(when)}</strong>. ${escapeHtml(devices)}</p>
<p>If that was you, there is nothing to do.</p>
<p>If it wasn't, change your password again now — from a signed-in device use <strong>Account</strong>, or from the sign-in page use &ldquo;Forgot password&rdquo; — and tell your company's admin or owner.</p>
<p style="font-size:14px;color:#5A5A5A">FlowHRMS support (help@flowacord.com) never asks for your password.</p>
</div>`;

  return { subject, text, html };
}

export interface VerifyEmailInput {
  name: string;
  companyName: string;
  url: string;
  trialEndsAt: Date;
}

/**
 * Sent right after a self-serve sign-up. The person is already signed in;
 * this only proves the address is theirs, which unlocks inviting staff.
 */
export function verifyEmailMessage(input: VerifyEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const firstName = input.name.trim().split(/\s+/)[0] || "there";
  const ends = formatInviteDate(input.trialEndsAt, "Asia/Kolkata");
  const subject = "Confirm your email for FlowHRMS";
  const lines = [
    `Hello ${firstName},`,
    "",
    `Your free trial of FlowHRMS for ${input.companyName} has started and runs until ${ends}.`,
    "",
    "Please confirm this is your email address:",
    input.url,
    "",
    "Until you do, you can set everything up but can't invite your team. The link works for 7 days.",
    "",
    "If you didn't sign up, ignore this email — nothing more will happen, and you can tell us at help@flowacord.com.",
  ];
  const text = lines.join("\n");
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#1A1A1A;max-width:520px">
<p>Hello ${escapeHtml(firstName)},</p>
<p>Your free trial of FlowHRMS for <strong>${escapeHtml(input.companyName)}</strong> has started and runs until <strong>${escapeHtml(ends)}</strong>.</p>
<p style="margin:28px 0">
  <a href="${escapeHtml(input.url)}" style="display:inline-block;background:#7166F3;color:#FFFFFF;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:600">Confirm my email</a>
</p>
<p style="font-size:14px;color:#5A5A5A">Or paste this into your browser:<br><span style="word-break:break-all">${escapeHtml(input.url)}</span></p>
<p>Until you confirm, you can set everything up but can't invite your team. The link works for 7 days.</p>
<p style="font-size:14px;color:#5A5A5A">If you didn't sign up, ignore this email — nothing more will happen, and you can tell us at help@flowacord.com.</p>
</div>`;
  return { subject, text, html };
}

export interface PaymentReceiptInput {
  name: string;
  companyName: string;
  planName: string;
  invoiceNumber: string;
  total: string;
  paidUntil: Date;
  invoiceUrl: string;
}

/** Sent to whoever paid, with the link to the tax invoice. */
export function paymentReceiptEmail(input: PaymentReceiptInput): {
  subject: string;
  text: string;
  html: string;
} {
  const firstName = input.name.trim().split(/\s+/)[0] || "there";
  const until = formatInviteDate(input.paidUntil, "Asia/Kolkata");
  const subject = `Payment received — FlowHRMS invoice ${input.invoiceNumber}`;
  const lines = [
    `Hello ${firstName},`,
    "",
    `Thank you. We received ${input.total} for ${input.companyName}'s FlowHRMS ${input.planName} plan.`,
    `Your plan now runs until ${until}.`,
    "",
    `Your tax invoice ${input.invoiceNumber}:`,
    input.invoiceUrl,
    "",
    "Questions about this payment? Reply to help@flowacord.com.",
  ];
  const text = lines.join("\n");
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#1A1A1A;max-width:520px">
<p>Hello ${escapeHtml(firstName)},</p>
<p>Thank you. We received <strong>${escapeHtml(input.total)}</strong> for ${escapeHtml(input.companyName)}'s FlowHRMS <strong>${escapeHtml(input.planName)}</strong> plan. Your plan now runs until <strong>${escapeHtml(until)}</strong>.</p>
<p style="margin:28px 0">
  <a href="${escapeHtml(input.invoiceUrl)}" style="display:inline-block;background:#7166F3;color:#FFFFFF;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:600">View tax invoice ${escapeHtml(input.invoiceNumber)}</a>
</p>
<p style="font-size:14px;color:#5A5A5A">Questions about this payment? Write to help@flowacord.com.</p>
</div>`;
  return { subject, text, html };
}

/** The 6-digit code that proves a sign-up email address. */
export function signupCodeEmail(input: { code: string }): { subject: string; text: string; html: string } {
  const spaced = `${input.code.slice(0, 3)} ${input.code.slice(3)}`;
  const subject = `${input.code} is your FlowHRMS code`;
  const text = [
    `Your FlowHRMS verification code is ${spaced}.`,
    "",
    "Type it on the sign-up page to confirm this email address. It works for 10 minutes.",
    "",
    "If you didn't try to sign up, ignore this email — nothing happens without the code.",
  ].join("\n");
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#1A1A1A;max-width:520px">
<p>Your FlowHRMS verification code is:</p>
<p style="margin:20px 0;font-size:32px;font-weight:700;letter-spacing:6px;color:#17163E">${escapeHtml(spaced)}</p>
<p>Type it on the sign-up page to confirm this email address. It works for 10 minutes.</p>
<p style="font-size:14px;color:#5A5A5A">If you didn't try to sign up, ignore this email — nothing happens without the code.</p>
</div>`;
  return { subject, text, html };
}
