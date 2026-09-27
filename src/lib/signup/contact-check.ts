"use server";

import { z } from "zod";
import { getDb } from "@/lib/db";
import { requestMeta } from "@/lib/consent/record";
import { normaliseEmail } from "@/lib/invites/policy";
import { normalisePhone } from "@/lib/platform/demo-requests";
import { EMAIL_TAKEN, MOBILE_TAKEN } from "./validate";

/**
 * Sign-up, step 3: is this email or mobile number already on a FlowHRMS
 * account? Asked as soon as the person fills the field, so they hear it
 * there and then — not after the consent step. The final "Start my free
 * trial" checks again; this is the courtesy, that is the enforcement.
 *
 * Public, so it is rate-limited per device (in memory, per server
 * process) to keep it from being used to test lists of addresses.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_CHECKS = 40;
const seen = new Map<string, number[]>();

function allowed(key: string): boolean {
  const now = Date.now();
  const recent = (seen.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_CHECKS) {
    seen.set(key, recent);
    return false;
  }
  recent.push(now);
  seen.set(key, recent);
  if (seen.size > 10_000) seen.clear();
  return true;
}

const schema = z.object({
  email: z.string().trim().max(200).optional(),
  mobile: z.string().trim().max(20).optional(),
});

export type ContactCheck = {
  /** A message when taken; null when free; undefined when not checked. */
  email?: string | null;
  mobile?: string | null;
};

export async function checkSignupContactAction(input: z.input<typeof schema>): Promise<ContactCheck> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return {};
  const meta = await requestMeta();
  // Past the limit, say nothing either way; the final step still checks.
  if (!allowed(meta.ipAddress ?? "unknown")) return {};

  const db = getDb();
  const email = parsed.data.email ? normaliseEmail(parsed.data.email) : null;
  const mobile = parsed.data.mobile ? normalisePhone(parsed.data.mobile) : null;
  const validEmail = email && z.string().email().safeParse(email).success ? email : null;

  const [byEmail, byPhone] = await Promise.all([
    validEmail ? db.user.findUnique({ where: { email: validEmail }, select: { id: true } }) : null,
    mobile ? db.user.findUnique({ where: { phone: `+91${mobile}` }, select: { id: true } }) : null,
  ]);
  return {
    ...(validEmail ? { email: byEmail ? EMAIL_TAKEN : null } : {}),
    ...(mobile ? { mobile: byPhone ? MOBILE_TAKEN : null } : {}),
  };
}
