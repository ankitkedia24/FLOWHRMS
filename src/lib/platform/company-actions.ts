"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { MODULES, type ModuleKey } from "@/lib/catalog";
import { dependentModules, missingRequirements, type EnabledMap } from "@/lib/modules/impact";
import { saveTrialSettings } from "./settings";
import type { TrialSettings } from "./trial-defaults";

/**
 * Flowacord's controls over one company: its trial, its plan, and which
 * modules it has. Every change is audited against the company, by the
 * Flowacord person who made it.
 */

type Result = { ok: true; message: string } | { ok: false; error: string };

const DAY = 24 * 60 * 60 * 1000;

async function audit(input: {
  tenantId: string;
  actorUserId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}) {
  await getDb().auditEvent.create({
    data: {
      tenantId: input.tenantId,
      actorType: "PLATFORM",
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: "tenant",
      entityId: input.tenantId,
      reason: input.reason,
      before: input.before as object | undefined,
      after: input.after as object | undefined,
    },
  });
}

function done(tenantId: string, message: string): Result {
  revalidatePath(`/platform/companies/${tenantId}`);
  revalidatePath("/platform");
  return { ok: true, message };
}

const extendSchema = z.object({
  tenantId: z.string().uuid(),
  /** Add this many days to the later of now and the current end. */
  days: z.number().int().min(1).max(365).optional(),
  /** Or set an exact end date, "YYYY-MM-DD" (end of that day, IST). */
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function extendTrialAction(input: z.input<typeof extendSchema>): Promise<Result> {
  const session = await requirePlatformAdmin();
  const parsed = extendSchema.safeParse(input);
  if (!parsed.success || (!parsed.data.days && !parsed.data.until)) {
    return { ok: false, error: "Choose how long to extend by, or a date." };
  }
  const db = getDb();
  const tenant = await db.tenant.findUnique({ where: { id: parsed.data.tenantId } });
  if (!tenant) return { ok: false, error: "That company no longer exists." };

  const now = new Date();
  const endsAt = parsed.data.until
    ? new Date(`${parsed.data.until}T23:59:59.000+05:30`)
    : new Date(
        Math.max(now.getTime(), tenant.trialEndsAt?.getTime() ?? now.getTime()) +
          parsed.data.days! * DAY,
      );
  if (endsAt <= now) return { ok: false, error: "Choose a date in the future." };

  await db.tenant.update({
    where: { id: tenant.id },
    data: { plan: "TRIAL", trialEndsAt: endsAt },
  });
  await audit({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    action: "tenant.trial_extended",
    before: { plan: tenant.plan, trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null },
    after: { plan: "TRIAL", trialEndsAt: endsAt.toISOString() },
  });
  return done(
    tenant.id,
    `${tenant.name}'s trial now ends ${endsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}.`,
  );
}

export async function endTrialAction(input: { tenantId: string; reason: string }): Promise<Result> {
  const session = await requirePlatformAdmin();
  const reason = input.reason?.trim();
  if (!reason) return { ok: false, error: "Say why. It goes on the record." };
  const db = getDb();
  const tenant = await db.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) return { ok: false, error: "That company no longer exists." };
  const now = new Date();
  await db.tenant.update({ where: { id: tenant.id }, data: { plan: "TRIAL", trialEndsAt: now } });
  await audit({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    action: "tenant.trial_ended",
    reason,
    before: { plan: tenant.plan, trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null },
    after: { plan: "TRIAL", trialEndsAt: now.toISOString() },
  });
  return done(tenant.id, `${tenant.name}'s trial has ended. Their access is paused; nothing is deleted.`);
}

export async function verifyOwnerEmailAction(input: { tenantId: string; reason: string }): Promise<Result> {
  const session = await requirePlatformAdmin();
  const reason = input.reason?.trim();
  if (!reason) return { ok: false, error: "Say how you confirmed it. It goes on the record." };
  const db = getDb();
  const tenant = await db.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) return { ok: false, error: "That company no longer exists." };
  if (tenant.ownerEmailVerifiedAt) return { ok: true, message: "Already confirmed." };
  await db.tenant.update({ where: { id: tenant.id }, data: { ownerEmailVerifiedAt: new Date() } });
  await audit({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    action: "tenant.owner_email_verified_by_platform",
    reason,
  });
  return done(tenant.id, `${tenant.name} can now invite its team.`);
}

const moduleSchema = z.object({
  tenantId: z.string().uuid(),
  moduleKey: z.string(),
  enabled: z.boolean(),
});

/**
 * Include or remove a module for a company. Including switches it on and
 * lets the company manage it; removing switches it off and stops the
 * company switching it back on. Data is never deleted either way.
 */
export async function setCompanyModuleAction(input: z.input<typeof moduleSchema>): Promise<Result> {
  const session = await requirePlatformAdmin();
  const parsed = moduleSchema.safeParse(input);
  if (!parsed.success || !(parsed.data.moduleKey in MODULES)) {
    return { ok: false, error: "That module doesn't exist." };
  }
  const key = parsed.data.moduleKey as ModuleKey;
  const def = MODULES[key];
  if (def.category === "CORE") return { ok: false, error: `${def.name} is always on.` };

  const db = getDb();
  const settings = await db.tenantModuleSetting.findMany({
    where: { tenantId: parsed.data.tenantId },
    include: { module: { select: { key: true } } },
  });
  const enabledMap: EnabledMap = Object.fromEntries(
    settings.map((s) => [s.module.key, s.enabled || MODULES[s.module.key as ModuleKey]?.category === "CORE"]),
  );
  const setting = settings.find((s) => s.module.key === key);
  if (!setting) return { ok: false, error: "That company has no setting for this module." };

  if (parsed.data.enabled) {
    const missing = missingRequirements(enabledMap, key);
    if (missing.length > 0) {
      return { ok: false, error: `${def.name} needs ${missing.map((m) => MODULES[m].name).join(" or ")} first.` };
    }
  } else {
    const dependents = dependentModules(enabledMap, key);
    if (dependents.length > 0) {
      return {
        ok: false,
        error: `Remove ${dependents.map((m) => MODULES[m].name).join(", ")} first — ${dependents.length === 1 ? "it depends" : "they depend"} on ${def.name}.`,
      };
    }
  }

  await db.tenantModuleSetting.update({
    where: { tenantId_moduleId: { tenantId: parsed.data.tenantId, moduleId: setting.moduleId } },
    data: {
      enabled: parsed.data.enabled,
      allowedByPlatform: parsed.data.enabled,
      updatedById: session.user.id,
    },
  });
  await audit({
    tenantId: parsed.data.tenantId,
    actorUserId: session.user.id,
    action: parsed.data.enabled ? "module.included_by_platform" : "module.removed_by_platform",
    before: { module: key, enabled: setting.enabled, allowedByPlatform: setting.allowedByPlatform },
    after: { module: key, enabled: parsed.data.enabled, allowedByPlatform: parsed.data.enabled },
  });
  return done(parsed.data.tenantId, `${def.name} ${parsed.data.enabled ? "included and switched on" : "removed"}.`);
}

const settingsSchema = z.object({
  days: z.number().int().min(1).max(365),
  modules: z.array(z.string()),
});

export async function saveTrialSettingsAction(input: z.input<typeof settingsSchema>): Promise<Result> {
  const session = await requirePlatformAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Trial length must be 1–365 days." };
  const { before, after } = await saveTrialSettings(parsed.data as TrialSettings, session.user.id);
  await getDb().auditEvent.create({
    data: {
      tenantId: null,
      actorType: "PLATFORM",
      actorUserId: session.user.id,
      action: "platform.trial_settings_changed",
      entityType: "platform_setting",
      entityId: "trial",
      before: before as unknown as object,
      after: after as unknown as object,
    },
  });
  revalidatePath("/platform/settings");
  return { ok: true, message: `New trials: ${after.days} days with ${after.modules.length} modules.` };
}
