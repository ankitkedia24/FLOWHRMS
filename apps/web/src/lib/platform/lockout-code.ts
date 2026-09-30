import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { sendMail } from "@/lib/email/send";
import { lockoutCodeEmail } from "@/lib/email/templates";
import { generateOtp, hashOtp, otpMatches } from "@/lib/signup/otp";
import {
  LOCKOUT_CODE_TTL_MS,
  LOCKOUT_MAX_ATTEMPTS,
  LOCKOUT_WORDS,
  PLATFORM_APPROVAL_EMAIL,
  lockoutCodeRefusal,
  lockoutSendGate,
  wrongCodeMessage,
  type LockoutAction,
  type Refusal,
} from "./lockout-policy";

/**
 * The code that stands between a platform admin and locking a company out
 * (lockout-policy.ts has the rules). Two steps: send a code to
 * PLATFORM_APPROVAL_EMAIL, then redeem it — once — to do the thing.
 *
 * The history of codes is Flowacord's, not the company's: those audit rows
 * carry no tenantId, so a code asked for and never used doesn't appear in
 * the company's own activity log. The lockout itself is recorded against
 * the company, as it always was.
 */

type Tx = Prisma.TransactionClient;

export interface LockoutActor {
  id: string;
  displayName: string;
  email: string | null;
}

export type SendLockoutResult = { ok: true; codeId: string; sentTo: string; expiresAt: Date } | Refusal;

export async function sendLockoutCode(input: {
  actor: LockoutActor;
  tenant: { id: string; name: string };
  action: LockoutAction;
  reason: string;
}): Promise<SendLockoutResult> {
  const db = getDb();
  const now = new Date();

  const recent = await db.platformActionCode.findMany({
    where: { requestedById: input.actor.id, createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const gate = lockoutSendGate({ lastSentAt: recent[0]?.createdAt ?? null, sentInLastHour: recent.length }, now);
  if (!gate.ok) return gate;

  const id = randomUUID();
  const code = generateOtp();
  const expiresAt = new Date(now.getTime() + LOCKOUT_CODE_TTL_MS);
  await db.platformActionCode.create({
    data: {
      id,
      action: input.action,
      tenantId: input.tenant.id,
      requestedById: input.actor.id,
      codeHash: hashOtp(id, code),
      sentTo: PLATFORM_APPROVAL_EMAIL,
      reason: input.reason,
      expiresAt,
    },
  });

  const words = LOCKOUT_WORDS[input.action];
  let delivered = false;
  let why: string | undefined;
  try {
    const result = await sendMail({
      to: PLATFORM_APPROVAL_EMAIL,
      ...lockoutCodeEmail({
        code,
        doing: words.doing,
        consequence: words.consequence,
        companyName: input.tenant.name,
        requestedByName: input.actor.displayName,
        requestedByEmail: input.actor.email,
        reason: input.reason,
        requestedAt: now,
        expiresAt,
      }),
    });
    delivered = result.sent;
    why = result.reason;
  } catch (error) {
    why = error instanceof Error ? error.message : "The mail server refused it.";
  }

  await db.auditEvent.create({
    data: {
      tenantId: null,
      actorUserId: input.actor.id,
      actorType: "PLATFORM",
      action: "platform.lockout_code_sent",
      entityType: "tenant",
      entityId: input.tenant.id,
      reason: input.reason,
      metadata: { action: input.action, to: PLATFORM_APPROVAL_EMAIL, codeId: id, delivered },
    },
  });

  if (!delivered) {
    // Nobody holds this code, so it can never be used; don't let it count
    // against the hourly limit either.
    await db.platformActionCode.delete({ where: { id } });
    return {
      ok: false,
      error: `The code couldn't be emailed to ${PLATFORM_APPROVAL_EMAIL}${why ? ` (${why})` : ""}. Nothing has changed — this can't be done without it.`,
    };
  }
  return { ok: true, codeId: id, sentTo: PLATFORM_APPROVAL_EMAIL, expiresAt };
}

class CodeAlreadyUsed extends Error {}

/**
 * Thrown from `apply` when the company is no longer in a state the action
 * applies to. The transaction rolls back, so the code is not used up.
 */
export class LockoutRefused extends Error {}

/**
 * Check the code and, if it is right, use it up and run `apply` in the same
 * transaction — so a code opens exactly one lockout, even when it is typed
 * in two tabs at once. A wrong code costs a try whatever happens next.
 * `apply` gets the reason fixed when the code was sent; it throws
 * LockoutRefused to refuse without using the code.
 */
export async function redeemLockoutCode<T>(
  input: { codeId: string; code: string; actorId: string; tenantId: string; action: LockoutAction },
  apply: (tx: Tx, reason: string) => Promise<T>,
): Promise<{ ok: true; value: T; reason: string } | Refusal> {
  const db = getDb();
  const now = new Date();
  const row = await db.platformActionCode.findUnique({ where: { id: input.codeId } });
  const refusal = lockoutCodeRefusal(
    row,
    { action: input.action, tenantId: input.tenantId, userId: input.actorId },
    now,
  );
  if (refusal || !row) return { ok: false, error: refusal ?? "That code has expired. Ask for a new one." };

  // Take a try before looking at the code. Done as one conditional update,
  // so parallel guesses can't exceed the limit between a read and a write.
  const tried = await db.platformActionCode.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: now }, attempts: { lt: LOCKOUT_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (tried.count !== 1) return { ok: false, error: "That code has expired or been used. Ask for a new one." };

  if (!otpMatches(row.id, input.code, row.codeHash)) {
    const attemptsUsed = row.attempts + 1;
    await db.auditEvent.create({
      data: {
        tenantId: null,
        actorUserId: input.actorId,
        actorType: "PLATFORM",
        action: "platform.lockout_code_wrong",
        entityType: "tenant",
        entityId: input.tenantId,
        metadata: { action: input.action, codeId: row.id, triesLeft: LOCKOUT_MAX_ATTEMPTS - attemptsUsed },
      },
    });
    return { ok: false, error: wrongCodeMessage(attemptsUsed) };
  }

  try {
    const value = await db.$transaction(async (tx) => {
      const used = await tx.platformActionCode.updateMany({
        where: { id: row.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (used.count !== 1) throw new CodeAlreadyUsed();
      return apply(tx, row.reason);
    });
    return { ok: true, value, reason: row.reason };
  } catch (error) {
    if (error instanceof CodeAlreadyUsed) {
      return { ok: false, error: "That code has already been used. Ask for a new one." };
    }
    if (error instanceof LockoutRefused) return { ok: false, error: error.message };
    throw error;
  }
}
