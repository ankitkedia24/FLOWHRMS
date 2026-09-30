"use server";

import { z } from "zod";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { sendLockoutCode } from "./lockout-code";
import { lockoutPrecondition } from "./lockout-policy";

/**
 * Step one of suspending a company or ending its trial: say why, and a
 * code goes to info@flowacord.com. Step two is the action itself, which
 * takes the code (setTenantStatusAction, endTrialAction).
 */

const schema = z.object({
  tenantId: z.string().uuid(),
  action: z.enum(["SUSPEND", "END_TRIAL"]),
  reason: z.string().trim().min(1, "Say why. It goes on the record.").max(300, "Keep the reason under 300 characters."),
});

export type RequestLockoutCodeResult =
  | { ok: true; codeId: string; sentTo: string; expiresAt: string }
  | { ok: false; error: string; waitSeconds?: number };

export async function requestLockoutCodeAction(input: z.input<typeof schema>): Promise<RequestLockoutCodeResult> {
  const session = await requirePlatformAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };

  const tenant = await getDb().tenant.findUnique({
    where: { id: parsed.data.tenantId },
    select: { id: true, name: true, status: true, plan: true, trialEndsAt: true },
  });
  if (!tenant) return { ok: false, error: "That company no longer exists." };
  const refusal = lockoutPrecondition(parsed.data.action, tenant, new Date());
  if (refusal) return { ok: false, error: refusal };

  const sent = await sendLockoutCode({
    actor: { id: session.user.id, displayName: session.user.displayName, email: session.user.email },
    tenant,
    action: parsed.data.action,
    reason: parsed.data.reason,
  });
  if (!sent.ok) return sent;
  return { ok: true, codeId: sent.codeId, sentTo: sent.sentTo, expiresAt: sent.expiresAt.toISOString() };
}
