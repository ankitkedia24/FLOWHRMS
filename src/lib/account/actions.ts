"use server";

import { createClient } from "@supabase/supabase-js";
import { requireSession } from "@/lib/authz/guard";
import { recordAuditEvent } from "@/lib/audit";
import { emailConfigured, sendMail } from "@/lib/email/send";
import { passwordChangedEmail } from "@/lib/email/templates";
import { notify } from "@/lib/notifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  describeRetryWait,
  PasswordAttemptLimiter,
  validatePasswordChange,
  type PasswordChangeField,
  type PasswordChangeInput,
} from "./policy";

/**
 * Change the signed-in person's own password.
 *
 * Three things make this different from the invitation and reset pages,
 * which also set passwords:
 *
 * 1. **The current password is proved first.** A session cookie is not
 *    enough — someone who picks up an unlocked phone must not be able to
 *    lock its owner out. The proof is a sign-in with the current password,
 *    made from a throwaway client that is signed out again immediately,
 *    so it neither replaces the real session nor leaves a spare one.
 * 2. **Wrong guesses are counted** (policy.ts) — the check leaves from the
 *    server, so the server's address is what Supabase rate-limits, shared
 *    by every company.
 * 3. **The change is told to the person in every channel we have**: an
 *    audit event, a bell notification, and an email when mail is set up.
 *    If it wasn't them, the email is how they find out.
 *
 * The password itself is never logged, stored, or echoed back.
 */

export type ChangePasswordResult =
  | { ok: true; signedOutOthers: boolean }
  | { ok: false; error: string; field?: PasswordChangeField };

const limiter = new PasswordAttemptLimiter();

export async function changePasswordAction(
  input: PasswordChangeInput & { signOutOthers?: boolean },
): Promise<ChangePasswordResult> {
  const session = await requireSession();

  if (session.source !== "supabase") {
    return {
      ok: false,
      error: "Passwords can't be changed in the preview session. Sign in with a real account.",
    };
  }
  const email = session.user.email;
  if (!email) {
    return {
      ok: false,
      error: "This account has no email address, so its password can't be changed. Ask your admin to add one.",
    };
  }

  const problem = validatePasswordChange({
    currentPassword: input.currentPassword ?? "",
    newPassword: input.newPassword ?? "",
    confirmPassword: input.confirmPassword ?? "",
  });
  if (problem) return { ok: false, error: problem.message, field: problem.field };

  const wait = limiter.retryAfterSeconds(session.user.id);
  if (wait > 0) return { ok: false, error: describeRetryWait(wait) };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabase = await createSupabaseServerClient();
  if (!url || !key || !supabase) {
    return { ok: false, error: "Sign-in isn't connected yet. Ask your admin." };
  }

  // Prove the current password with a client that keeps nothing.
  const probe = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const check = await probe.auth.signInWithPassword({
    email,
    password: input.currentPassword,
  });
  if (check.error || check.data.user?.id === undefined) {
    limiter.recordFailure(session.user.id);
    const nowWait = limiter.retryAfterSeconds(session.user.id);
    return {
      ok: false,
      field: "currentPassword",
      error: nowWait > 0 ? describeRetryWait(nowWait) : "That isn't your current password.",
    };
  }
  // The probe's session is surplus the moment it has served its purpose.
  await probe.auth.signOut({ scope: "local" }).catch(() => undefined);
  limiter.clear(session.user.id);

  const updated = await supabase.auth.updateUser({ password: input.newPassword });
  if (updated.error) {
    return {
      ok: false,
      field: "newPassword",
      error: `The password couldn't be saved: ${updated.error.message}.`,
    };
  }

  let signedOutOthers = false;
  if (input.signOutOthers) {
    const out = await supabase.auth.signOut({ scope: "others" });
    signedOutOthers = !out.error;
  }

  const at = new Date();
  await recordAuditEvent(session, {
    action: "account.password_changed",
    entityType: "user",
    entityId: session.user.id,
    metadata: { signedOutOthers },
  });
  await notify.passwordChanged(session, at);

  if (emailConfigured()) {
    // Best effort, and never a reason to report failure: the password IS
    // changed, and the audit row and the bell already say so.
    const body = passwordChangedEmail({
      name: session.user.displayName,
      at,
      timeZone: session.tenant.timezone,
      signedOutOthers,
    });
    await sendMail({ to: email, ...body });
  }

  return { ok: true, signedOutOthers };
}
