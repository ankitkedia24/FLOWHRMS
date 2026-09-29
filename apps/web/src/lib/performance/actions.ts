"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { getPolicy, setPolicy } from "@/lib/policies";
import {
  RULE_KEYS,
  normalizeScoring,
  type ScoringPolicy,
} from "./scoring";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const ruleSchema = z.object({
  enabled: z.boolean(),
  points: z.number().min(0).max(10_000),
});

const scoringSchema = z.object({
  rules: z.record(z.enum(RULE_KEYS), ruleSchema),
  earlyBirdMinutes: z.number().min(1).max(240),
  taskEarlyHours: z.number().min(1).max(168),
  perfectWeekDays: z.number().min(2).max(7),
  comebackRunLength: z.number().min(2).max(30),
  dailyTaskCap: z.number().min(0).max(10_000),
  monthMinDays: z.number().min(1).max(31),
  plannedLeaveDays: z.number().min(1).max(60),
  levelNames: z.array(z.string().min(1).max(30)).length(5),
});

/**
 * Publish a scoring definition. Publishing is the deliberate act: points
 * only count once a version exists, its version is stamped on every award
 * from then on, and the leaderboard gate (P3) checks exactly this.
 */
export async function publishScoringAction(
  input: z.input<typeof scoringSchema>,
): Promise<ActionResult> {
  const parsed = scoringSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the scoring values — something is out of range." };
  }

  const { session, decision } = await checkAccess({
    module: "PERFORMANCE",
    permission: "settings.manage",
  });
  if (!decision.allowed) {
    return {
      ok: false,
      error: decision.message ?? "You don't have access to performance settings.",
    };
  }

  const previous = await getPolicy<ScoringPolicy>(session.tenant.id, "performance");
  const normalized = normalizeScoring(parsed.data);
  const { version } = await setPolicy(
    session.tenant.id,
    "performance",
    normalized,
    session.user.id,
  );

  await recordAuditEvent(session, {
    action: "performance.scoring_published",
    entityType: "tenant_policy",
    before: previous
      ? { enabledRules: RULE_KEYS.filter((k) => previous.rules?.[k]?.enabled).length }
      : undefined,
    after: {
      version,
      enabledRules: RULE_KEYS.filter((k) => normalized.rules[k].enabled).length,
      dailyTaskCap: normalized.dailyTaskCap,
    },
  });

  revalidatePath("/admin/settings/performance");
  revalidatePath("/performance");
  revalidatePath("/home");

  return {
    ok: true,
    message: `Scoring version ${version} is published. Points count from now.`,
  };
}

const celebrateSchema = z.object({
  badgeKeys: z.array(z.string().min(1).max(60)).min(1).max(10),
});

/**
 * Mark celebration moments as shown. Scoped to the caller's own
 * membership — nobody can dismiss anyone else's moment — and idempotent:
 * a second call finds celebratedAt already set and changes nothing.
 */
export async function markCelebratedAction(
  input: z.input<typeof celebrateSchema>,
): Promise<ActionResult> {
  const parsed = celebrateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nothing to mark." };

  const { session, decision } = await checkAccess({ module: "PERFORMANCE" });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const { getDb } = await import("@/lib/db");
  await getDb().employeeBadge.updateMany({
    where: {
      tenantId: session.tenant.id,
      membershipId: session.membership.id,
      badgeKey: { in: parsed.data.badgeKeys },
      celebratedAt: null,
    },
    data: { celebratedAt: new Date() },
  });

  return { ok: true, message: "Celebrated." };
}

// ------------------------------------------------- double-points days (P3)

const boostSchema = z.object({
  name: z.string().min(2).max(80),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Declare a double-points window (festival rush, stock-taking). Applied
 * at award time from the moment it exists; rows already written are never
 * rewritten, because history is history.
 */
export async function createBoostAction(
  input: z.input<typeof boostSchema>,
): Promise<ActionResult> {
  const parsed = boostSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the dates and the name." };

  const { session, decision } = await checkAccess({
    module: "PERFORMANCE",
    permission: "settings.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const start = new Date(`${parsed.data.startDate}T00:00:00.000Z`);
  const end = new Date(`${parsed.data.endDate}T00:00:00.000Z`);
  if (end < start) return { ok: false, error: "The end date is before the start." };
  if (end.getTime() - start.getTime() > 31 * 86_400_000) {
    return {
      ok: false,
      error: "Cap a boost at a month. A permanent ×2 is just a different scoring policy.",
    };
  }

  const { getDb } = await import("@/lib/db");
  await getDb().performanceBoost.create({
    data: {
      tenantId: session.tenant.id,
      name: parsed.data.name.trim(),
      startDate: start,
      endDate: end,
      multiplier: 2,
      createdById: session.user.id,
    },
  });

  await recordAuditEvent(session, {
    action: "performance.boost_created",
    entityType: "performance_boost",
    entityId: session.tenant.id,
    metadata: { name: parsed.data.name.trim(), start: parsed.data.startDate, end: parsed.data.endDate },
  });

  revalidatePath("/admin/performance");
  return { ok: true, message: "Double-points window declared. The Home widget announces it." };
}

const deleteBoostSchema = z.object({ boostId: z.string().uuid() });

/** Remove a window. Points already paid under it stay paid — history. */
export async function deleteBoostAction(
  input: z.input<typeof deleteBoostSchema>,
): Promise<ActionResult> {
  const parsed = deleteBoostSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That window could not be read." };

  const { session, decision } = await checkAccess({
    module: "PERFORMANCE",
    permission: "settings.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const { getDb } = await import("@/lib/db");
  const removed = await getDb().performanceBoost.deleteMany({
    where: { id: parsed.data.boostId, tenantId: session.tenant.id },
  });
  if (removed.count === 0) return { ok: false, error: "That window is already gone." };

  await recordAuditEvent(session, {
    action: "performance.boost_deleted",
    entityType: "performance_boost",
    entityId: parsed.data.boostId,
  });

  revalidatePath("/admin/performance");
  return { ok: true, message: "Window removed. Points already earned under it stay." };
}
