"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { canSendKudos, KUDOS_MAX_LENGTH } from "./kudos";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const sendSchema = z.object({
  toMembershipId: z.string().uuid(),
  message: z.string().min(1).max(KUDOS_MAX_LENGTH + 10),
});

/**
 * Send a kudo (PERFORMANCE-MODULE.md §F). Requires tasks.manage — the
 * permission that already marks who directs work — and enforces the
 * weekly caps in the pure rules. Words only; the ledger never hears
 * about this.
 */
export async function sendKudosAction(
  input: z.input<typeof sendSchema>,
): Promise<ActionResult> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That kudo could not be read." };

  const { session, decision } = await checkAccess({
    module: "PERFORMANCE",
    permission: "tasks.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const tenantId = session.tenant.id;
  const from = session.membership.id;
  const to = parsed.data.toMembershipId;
  const message = parsed.data.message.trim();

  const recipient = await db.tenantMembership.findFirst({
    where: { id: to, tenantId, status: "ACTIVE" },
    include: { user: true },
  });
  if (!recipient) return { ok: false, error: "That person is no longer here." };

  // This week, Monday-start, matching every other weekly rule.
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * 86_400_000);

  const [sentThisWeek, sentToThisPerson] = await Promise.all([
    db.kudos.count({
      where: { tenantId, fromMembershipId: from, createdAt: { gte: monday } },
    }),
    db.kudos.count({
      where: {
        tenantId,
        fromMembershipId: from,
        toMembershipId: to,
        createdAt: { gte: monday },
      },
    }),
  ]);

  const check = canSendKudos({
    sentThisWeek,
    sentToThisPersonThisWeek: sentToThisPerson,
    toSelf: from === to,
    messageLength: message.length,
  });
  if (!check.ok) return { ok: false, error: check.reason! };

  const kudo = await db.kudos.create({
    data: { tenantId, fromMembershipId: from, toMembershipId: to, message },
  });

  await recordAuditEvent(session, {
    action: "performance.kudos_sent",
    entityType: "kudos",
    entityId: kudo.id,
    metadata: { to: recipient.user.displayName },
  });

  await notify.performanceMoment(
    session,
    recipient.userId,
    `Kudos from ${session.user.displayName}`,
    message,
  );

  revalidatePath("/performance");
  revalidatePath("/admin/performance");
  return { ok: true, message: `Sent. ${recipient.user.displayName} sees it with your name on it.` };
}
