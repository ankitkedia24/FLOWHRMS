import "server-only";

import nodemailer from "nodemailer";

/**
 * Outbound email.
 *
 * FlowHRMS sends its own invitations rather than borrowing Supabase's auth
 * templates, for one reason that matters on a shop floor: an invitation is
 * a message from a person's *employer*, and it should say the company's
 * name and the admin's name, not "Supabase". The same SMTP credentials
 * serve both (DEPLOY.md step 6).
 *
 * When SMTP is not configured, sending FAILS LOUDLY and the caller shows
 * the copyable link instead. It never pretends to have sent — a silently
 * dropped invitation is how someone spends a week wondering why the new
 * hire has not logged in (user-flows.md §6: a channel that is off is shown
 * as off, never silently failed).
 */

export interface MailResult {
  sent: boolean;
  /** Why not, in words an admin can act on. */
  reason?: string;
}

function transportConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !user || !pass || !from) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  return {
    from,
    options: {
      host,
      port,
      // 465 is implicit TLS; 587 upgrades with STARTTLS.
      secure: port === 465,
      auth: { user, pass },
    },
  };
}

export function emailConfigured(): boolean {
  return transportConfig() !== null;
}

export const EMAIL_NOT_CONFIGURED =
  "Email isn't set up yet, so nothing was sent. Copy the link below and send it to them yourself, or ask whoever set up FlowHRMS to configure email (DEPLOY.md, step 6).";

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<MailResult> {
  const config = transportConfig();
  if (!config) return { sent: false, reason: EMAIL_NOT_CONFIGURED };

  try {
    const transporter = nodemailer.createTransport(config.options);
    await transporter.sendMail({
      from: config.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { sent: true };
  } catch (error) {
    // The provider's message is usually the actionable part ("mailbox
    // unavailable", "not authorised"), so it is passed through rather than
    // replaced with a generic failure.
    const detail = error instanceof Error ? error.message : String(error);
    return {
      sent: false,
      reason: `The email didn't go through: ${detail}. Copy the link below and send it to them yourself.`,
    };
  }
}
