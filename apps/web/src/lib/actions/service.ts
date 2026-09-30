import "server-only";

import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import type { AppSession } from "@/lib/auth/types";
import { isTileVisible } from "./snooze";
import {
  resolveAudience,
  DECIDING_PERMISSION,
  OWNER_DECIDES_OWN,
  TEAM_SCOPED_KINDS,
  type AudienceCandidate,
  type Recipient,
} from "./audience";
import { mayDecideOwn } from "@/lib/authz/approvals";
import { approversInScope } from "@/lib/authz/record-scope";
import { MODULE_FOR_KIND, type ActionKind } from "./kinds";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { enabledModuleKeys } from "@/lib/authz/flags";

/**
 * The action queue — durable "somebody must decide this" records.
 *
 * Raised alongside the existing notification, never instead of it: the bell
 * is the record that something happened, the tile is the request for a
 * decision. Suppressing one to make room for the other would lose history.
 *
 * Raising a tile NEVER fails the thing that caused it. If a leave request
 * saves but its tile cannot be written, the leave request still stands and
 * the failure is logged — an approval queue is a convenience layered on
 * top of records that are already correct.
 */

export interface RaiseInput {
  tenantId: string;
  kind: ActionKind;
  /** The row being decided about, e.g. "attendance_record". */
  subjectType: string;
  subjectId: string;
  /** Whose work it is — used to find their department head. */
  aboutMembershipId?: string | null;
  title: string;
  body?: string;
  href: string;
  /** Who caused it; never asked to decide their own request. */
  actorUserId?: string | null;
  /**
   * Who to ask, when that follows from a relationship rather than a
   * permission — a field trip goes to the person's reporting manager,
   * whatever their role (FIELD-VISITS-MODULE.md §4). The caller has
   * already excluded the person themselves.
   */
  recipients?: Recipient[];
}

/**
 * Everyone who could decide this, with the department head marked.
 *
 * Filtered by tenant. The permission join and the record-scope filter are
 * the same ones the notification fan-out uses, so the tile and the bell
 * agree on who counts.
 */
async function loadCandidates(
  tenantId: string,
  kind: ActionKind,
  aboutMembershipId?: string | null,
): Promise<{
  candidates: AudienceCandidate[];
  departmentName: string | null;
  aboutUserId: string | null;
  aboutMayDecideOwn: boolean;
}> {
  const db = getDb();
  const permission = DECIDING_PERMISSION[kind];

  const about = aboutMembershipId
    ? await db.tenantMembership.findFirst({
        where: { id: aboutMembershipId, tenantId },
        select: {
          userId: true,
          role: { select: { key: true } },
          department: { select: { id: true, name: true, headId: true, isActive: true } },
        },
      })
    : null;

  const department = about?.department?.isActive ? about.department : null;

  const able = await db.tenantMembership.findMany({
    where: {
      tenantId,
      status: "ACTIVE",
      role: { permissions: { some: { permission: { key: permission } } } },
    },
    select: {
      id: true,
      userId: true,
      role: { select: { key: true } },
      user: { select: { displayName: true } },
    },
  });

  // Where the deciding action applies record scope, a manager outside the
  // person's line would only be refused — so they are not asked.
  const inScope = TEAM_SCOPED_KINDS.has(kind)
    ? new Set(
        (
          await approversInScope(
            tenantId,
            aboutMembershipId,
            able.map((m) => ({ membershipId: m.id, roleKey: m.role.key })),
          )
        ).map((a) => a.membershipId),
      )
    : null;

  return {
    candidates: able.map((m) => ({
      userId: m.userId,
      membershipId: m.id,
      displayName: m.user.displayName,
      canDecide: inScope ? inScope.has(m.id) : true,
      isDepartmentHead: Boolean(department?.headId && department.headId === m.id),
    })),
    departmentName: department?.name ?? null,
    aboutUserId: about?.userId ?? null,
    aboutMayDecideOwn:
      OWNER_DECIDES_OWN.has(kind) && Boolean(about && mayDecideOwn(about.role.key)),
  };
}

/** Raise (or refresh) a decision request. Idempotent per subject. */
export async function raiseActionRequest(input: RaiseInput): Promise<void> {
  if (devFixtureOffline()) return;

  try {
    const db = getDb();
    let recipients: Recipient[];
    if (input.recipients) {
      recipients = input.recipients;
    } else {
      const { candidates, departmentName, aboutUserId, aboutMayDecideOwn } =
        await loadCandidates(input.tenantId, input.kind, input.aboutMembershipId);
      recipients = resolveAudience({
        candidates,
        actorUserId: input.actorUserId,
        aboutUserId,
        aboutMayDecideOwn,
        departmentName,
      });
    }
    if (recipients.length === 0) return; // nobody can act; the bell still fired

    const request = await db.actionRequest.upsert({
      where: {
        tenantId_subjectType_subjectId: {
          tenantId: input.tenantId,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
        },
      },
      create: {
        tenantId: input.tenantId,
        kind: input.kind,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        aboutMembershipId: input.aboutMembershipId ?? null,
        title: input.title,
        body: input.body,
        href: input.href,
      },
      // Re-raising a resolved subject (proof resubmitted after rejection)
      // reopens the same row rather than accumulating duplicates.
      update: {
        status: "PENDING",
        title: input.title,
        body: input.body,
        href: input.href,
        resolvedAt: null,
        resolvedByUserId: null,
        resolution: null,
      },
    });

    await db.actionRequestRecipient.deleteMany({
      where: { actionRequestId: request.id },
    });
    await db.actionRequestRecipient.createMany({
      data: recipients.map((r) => ({
        actionRequestId: request.id,
        tenantId: input.tenantId,
        userId: r.userId,
        reason: r.reason,
      })),
    });
  } catch (error) {
    // Never let the queue break the thing it is about.
    console.error("[action-request:raise-failed]", input.subjectType, input.subjectId, error);
  }
}

/** Mark a decision made, so the tile clears for everyone at once. */
export async function resolveActionRequest(input: {
  tenantId: string;
  subjectType: string;
  subjectId: string;
  resolvedByUserId: string;
  resolution: string;
}): Promise<void> {
  if (devFixtureOffline()) return;
  try {
    await getDb().actionRequest.updateMany({
      where: {
        tenantId: input.tenantId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        status: { in: ["PENDING", "SNOOZED"] },
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedByUserId: input.resolvedByUserId,
        resolution: input.resolution,
      },
    });
  } catch (error) {
    console.error("[action-request:resolve-failed]", input.subjectId, error);
  }
}

export interface ActionTile {
  id: string;
  kind: ActionKind;
  title: string;
  body: string | null;
  href: string;
  reason: string;
  snoozeCount: number;
  raisedAt: string;
}

/**
 * What this person is being asked to decide right now.
 *
 * Snoozed rows are filtered in the query AND re-checked in memory: the
 * database comparison uses the server clock, and the in-memory pass is what
 * the pure tests exercise.
 */
export async function loadActionTiles(
  session: AppSession,
  now: Date = new Date(),
  limit = 20,
): Promise<ActionTile[]> {
  if (devFixtureOffline()) return [];

  // A tile for a disabled module would open a page that redirects away
  // (EXPENSES-MODULE.md §7): only kinds whose module is on are shown.
  const kinds = await enabledKinds(session.tenant.id, session.user.id);

  const rows = await getDb().actionRequestRecipient.findMany({
    where: {
      tenantId: session.tenant.id,
      userId: session.user.id,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      actionRequest: { status: { in: ["PENDING", "SNOOZED"] }, kind: { in: kinds } },
    },
    include: { actionRequest: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return rows
    .filter((r) => isTileVisible(r, now))
    .map((r) => ({
      id: r.actionRequest.id,
      kind: r.actionRequest.kind as ActionKind,
      title: r.actionRequest.title,
      body: r.actionRequest.body,
      href: r.actionRequest.href,
      reason: r.reason,
      snoozeCount: r.snoozeCount,
      raisedAt: r.actionRequest.createdAt.toISOString(),
    }));
}

/** Count only — for the bell badge, without shipping every tile. */
export async function countActionTiles(
  tenantId: string,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  if (devFixtureOffline()) return 0;
  const kinds = await enabledKinds(tenantId, userId);
  return getDb().actionRequestRecipient.count({
    where: {
      tenantId,
      userId,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      actionRequest: { status: { in: ["PENDING", "SNOOZED"] }, kind: { in: kinds } },
    },
  });
}

/** The tile kinds whose module is enabled for this tenant. */
async function enabledKinds(tenantId: string, userId: string): Promise<ActionKind[]> {
  const enabled = new Set(enabledModuleKeys(await loadEntitlements(tenantId, userId)));
  return (Object.keys(MODULE_FOR_KIND) as ActionKind[]).filter((kind) =>
    enabled.has(MODULE_FOR_KIND[kind]),
  );
}
