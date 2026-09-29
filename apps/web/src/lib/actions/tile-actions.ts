"use server";

import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { requireSession } from "@/lib/authz/guard";
import { unreadNotificationCount } from "@/lib/notifications";
import { reviewAttendanceAction } from "@/lib/attendance/actions";
import { reviewProofAction } from "@/lib/tasks/actions";
import { decideTripAction } from "@/lib/field-visits/actions";
import { loadActionTiles, type ActionTile } from "./service";
import { canSnooze, resolveSnoozeOption } from "./snooze";
import { APPROVE_INLINE } from "./kinds";

/**
 * Server actions behind the action tiles.
 *
 * The tile is a *shortcut to an existing decision*, not a second way of
 * making it. Approving from a tile calls the very same action the approval
 * screen calls, with the same permission checks, the same audit trail and
 * the same notifications. If those checks ever change, the tile changes
 * with them, because there is no duplicated copy to forget.
 */

export interface TilePoll {
  tiles: ActionTile[];
  /** Unread bell count, so one request feeds both indicators. */
  unread: number;
  /** Server time, so the client never trusts the device clock for snooze. */
  serverNow: string;
  timezone: string;
}

export async function pollActionTilesAction(): Promise<TilePoll> {
  const session = await requireSession();
  const now = new Date();
  const [tiles, unread] = await Promise.all([
    loadActionTiles(session, now),
    unreadNotificationCount(session.tenant.id, session.user.id),
  ]);
  return {
    tiles,
    unread,
    serverNow: now.toISOString(),
    timezone: session.tenant.timezone,
  };
}

const snoozeSchema = z.object({
  actionRequestId: z.string().uuid(),
  optionKey: z.string().min(1).max(20),
});

export type TileResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Snooze is per person. A supervisor putting something off must not hide
 * it from the owner, so only this recipient row moves.
 */
export async function snoozeTileAction(
  input: z.input<typeof snoozeSchema>,
): Promise<TileResult> {
  const parsed = snoozeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That didn't work. Try again." };

  const session = await requireSession();
  const db = getDb();

  const recipient = await db.actionRequestRecipient.findFirst({
    where: {
      actionRequestId: parsed.data.actionRequestId,
      userId: session.user.id,
      tenantId: session.tenant.id,
    },
    include: { actionRequest: true },
  });
  if (!recipient) return { ok: false, error: "That's no longer waiting for you." };

  const gate = canSnooze(recipient.snoozeCount);
  if (!gate.allowed) return { ok: false, error: gate.reason! };

  const now = new Date();
  const option = resolveSnoozeOption(
    parsed.data.optionKey,
    now,
    session.tenant.timezone,
  );
  if (!option) return { ok: false, error: "Choose how long to snooze for." };

  await db.actionRequestRecipient.update({
    where: { id: recipient.id },
    data: { snoozedUntil: option.until, snoozeCount: { increment: 1 } },
  });

  return { ok: true, message: `Back in ${option.label.toLowerCase()}.` };
}

const approveSchema = z.object({ actionRequestId: z.string().uuid() });

/**
 * One-tap approve, for the kinds where approving needs no further input.
 *
 * Delegates to the real action. Note what is NOT here: no direct write to
 * the attendance or task row, no permission check of its own beyond the
 * session, and no notification. All of that belongs to the action being
 * called, and duplicating it is how the two drift apart.
 */
export async function approveFromTileAction(
  input: z.input<typeof approveSchema>,
): Promise<TileResult> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That didn't work. Try again." };

  const session = await requireSession();
  const db = getDb();

  const recipient = await db.actionRequestRecipient.findFirst({
    where: {
      actionRequestId: parsed.data.actionRequestId,
      userId: session.user.id,
      tenantId: session.tenant.id,
    },
    include: { actionRequest: true },
  });
  if (!recipient) return { ok: false, error: "That's no longer waiting for you." };

  const request = recipient.actionRequest;
  if (request.status === "RESOLVED") {
    return { ok: false, error: "Someone has already dealt with this." };
  }

  const inline = APPROVE_INLINE[request.kind];
  if (!inline.allowed) {
    return {
      ok: false,
      error: `${inline.because ?? "This one needs the full screen."} Open it to decide.`,
    };
  }

  const result =
    request.kind === "ATTENDANCE_EXCEPTION"
      ? await reviewAttendanceAction({
          recordId: request.subjectId,
          decision: "APPROVED",
        })
      : request.kind === "FIELD_TRIP"
        ? await decideTripAction({ tripId: request.subjectId, decision: "APPROVED" })
        : await reviewProofAction({
            taskId: request.subjectId,
            decision: "APPROVED",
          });

  if (!result.ok) return { ok: false, error: result.error };

  await recordAuditEvent(session, {
    action: "action_request.approved_from_tile",
    entityType: request.subjectType,
    entityId: request.subjectId,
    metadata: { kind: request.kind, actionRequestId: request.id },
  });

  return { ok: true, message: result.message };
}

/**
 * Mark tiles as seen. Not the same as resolving: seeing a decision is not
 * making it, and the tile stays until someone decides.
 */
export async function markTilesSeenAction(
  actionRequestIds: string[],
): Promise<void> {
  if (actionRequestIds.length === 0) return;
  const session = await requireSession();
  await getDb().actionRequestRecipient.updateMany({
    where: {
      actionRequestId: { in: actionRequestIds.slice(0, 50) },
      userId: session.user.id,
      tenantId: session.tenant.id,
      seenAt: null,
    },
    data: { seenAt: new Date() },
  });
}
