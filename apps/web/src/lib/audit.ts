import "server-only";

import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import type { AppSession } from "@/lib/auth/types";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Audit-event helper (Product Constitution §3): the acting person,
 * decision, timestamp, reason and before/after values are preserved.
 * Events are append-only — no update or delete path exists anywhere in
 * application code.
 */
export interface AuditInput {
  /** Dotted action key, e.g. "module.disabled", "role.permissions_changed". */
  action: string;
  entityType: string;
  entityId?: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

/** Record an event performed by a signed-in user within their tenant. */
export async function recordAuditEvent(
  session: AppSession,
  input: AuditInput,
  /** Pass the transaction client to commit the event with the change it describes. */
  client: Pick<PrismaClient, "auditEvent"> = getDb(),
): Promise<void> {
  if (session.source === "dev-fixture" || devFixtureOffline()) {
    // Dev preview session has no database; make the skip loud in dev logs.
    console.warn(
      `[audit:dev-preview-skipped] ${input.action} ${input.entityType}${input.entityId ? `#${input.entityId}` : ""}`,
    );
    return;
  }

  await client.auditEvent.create({
    data: {
      tenantId: session.tenant.id,
      actorUserId: session.user.id,
      actorType: "USER",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      reason: input.reason,
      before: input.before === undefined ? undefined : (input.before as object),
      after: input.after === undefined ? undefined : (input.after as object),
      metadata:
        input.metadata === undefined ? undefined : (input.metadata as object),
    },
  });
}

/** Record a system event (jobs, seeds, scheduled work). */
export async function recordSystemAuditEvent(
  tenantId: string | null,
  input: AuditInput,
): Promise<void> {
  if (devFixtureOffline()) {
    console.warn(`[audit:dev-preview-skipped] ${input.action}`);
    return;
  }
  await getDb().auditEvent.create({
    data: {
      tenantId,
      actorType: "SYSTEM",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      reason: input.reason,
      metadata:
        input.metadata === undefined ? undefined : (input.metadata as object),
    },
  });
}
