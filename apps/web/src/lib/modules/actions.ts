"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { isFeatureBuilt, MODULES, type ModuleKey } from "@/lib/catalog";
import { disableImpact, missingRequirements, type EnabledMap } from "./impact";

/**
 * Module and feature toggle actions.
 *
 * Constitution §5 in force:
 * - The server is the control. A toggle that the UI allows is still
 *   re-checked here, including dependencies.
 * - Disabling requires the typed confirmation and a reason; both are
 *   verified server-side, not just collected by the modal.
 * - Enabling a module whose dependency is off is refused with a plain
 *   reason and the name of the dependency to turn on first.
 * - Every change writes an audit event with before/after values.
 */

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const moduleKeys = Object.keys(MODULES) as [ModuleKey, ...ModuleKey[]];

const toggleSchema = z.object({
  moduleKey: z.enum(moduleKeys),
  enabled: z.boolean(),
  reason: z.string().trim().max(500).optional(),
  typedConfirm: z.string().trim().optional(),
});

export async function setModuleEnabledAction(
  input: z.input<typeof toggleSchema>,
): Promise<ActionResult> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That change could not be read. Try again." };
  }

  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "modules.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const moduleKey = parsed.data.moduleKey;
  const moduleDef = MODULES[moduleKey];

  if (moduleDef.category === "CORE") {
    return {
      ok: false,
      error: `${moduleDef.name} is a core capability and is always on.`,
    };
  }
  if (moduleDef.category === "OPTIONAL" && parsed.data.enabled) {
    return {
      ok: false,
      error:
        "Optional modules are enabled by your FlowHRMS contact once their rules are approved.",
    };
  }

  const db = getDb();
  const entitlements = await loadEntitlements(
    session.tenant.id,
    session.user.id,
  );
  const enabledMap = entitlements.modules as EnabledMap;

  if (parsed.data.enabled) {
    // Flowacord decides what is in a company's plan (platform area); the
    // company switches only within it.
    const setting = await db.tenantModuleSetting.findFirst({
      where: { tenantId: session.tenant.id, module: { key: moduleKey } },
      select: { allowedByPlatform: true },
    });
    if (setting && !setting.allowedByPlatform) {
      return {
        ok: false,
        error: `${moduleDef.name} isn't included in your plan. Write to help@flowacord.com to add it.`,
      };
    }
  }

  if (parsed.data.enabled) {
    // Dependency check: never a silent failure.
    const missing = missingRequirements(enabledMap, moduleKey);
    if (missing.length > 0) {
      const names = missing.map((m) => MODULES[m].name).join(" or ");
      return { ok: false, error: `${moduleDef.name} needs ${names} to be on.` };
    }
  } else {
    // Disabling requires a typed confirmation and a reason.
    if (parsed.data.typedConfirm !== moduleKey) {
      return {
        ok: false,
        error: `Type ${moduleKey} to confirm turning off ${moduleDef.name}.`,
      };
    }
    if (!parsed.data.reason?.trim()) {
      return { ok: false, error: "A reason is required and is recorded in the activity log." };
    }
  }

  const record = await db.module.findUnique({ where: { key: moduleKey } });
  if (!record) return { ok: false, error: "That module is not available." };

  const before = enabledMap[moduleKey] === true;
  if (before === parsed.data.enabled) {
    return {
      ok: true,
      message: `${moduleDef.name} is already ${parsed.data.enabled ? "enabled" : "disabled"}.`,
    };
  }

  const counts = await db.tenantMembership.count({
    where: { tenantId: session.tenant.id, status: "ACTIVE" },
  });

  await db.tenantModuleSetting.upsert({
    where: {
      tenantId_moduleId: { tenantId: session.tenant.id, moduleId: record.id },
    },
    update: { enabled: parsed.data.enabled, updatedById: session.user.id },
    create: {
      tenantId: session.tenant.id,
      moduleId: record.id,
      enabled: parsed.data.enabled,
      updatedById: session.user.id,
    },
  });

  await recordAuditEvent(session, {
    action: parsed.data.enabled ? "module.enabled" : "module.disabled",
    entityType: "module",
    entityId: record.id,
    reason: parsed.data.reason?.trim(),
    before: { enabled: before },
    after: { enabled: parsed.data.enabled },
    metadata: {
      moduleKey,
      affectedEmployees: counts,
      impact: parsed.data.enabled
        ? undefined
        : disableImpact(enabledMap, moduleKey, {
            employees: counts,
            adminUsers: 0,
          }).sentence,
    },
  });

  revalidatePath("/admin/modules");
  revalidatePath("/admin");
  revalidatePath("/home");

  return {
    ok: true,
    message: parsed.data.enabled
      ? `${moduleDef.name} is on.`
      : `${moduleDef.name} is off. No data was deleted.`,
  };
}

const featureSchema = z.object({
  moduleKey: z.enum(moduleKeys),
  featureKey: z.string().min(1),
  enabled: z.boolean(),
});

export async function setFeatureEnabledAction(
  input: z.input<typeof featureSchema>,
): Promise<ActionResult> {
  const parsed = featureSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That change could not be read. Try again." };
  }

  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "modules.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  // A switch no code reads is not offered on the page; refused here too,
  // so a saved "on" can never claim something the product doesn't do.
  if (!isFeatureBuilt(parsed.data.moduleKey, parsed.data.featureKey)) {
    return {
      ok: false,
      error: "That feature isn't built yet, so there is nothing to switch.",
    };
  }

  const db = getDb();
  const moduleRecord = await db.module.findUnique({
    where: { key: parsed.data.moduleKey },
  });
  if (!moduleRecord) return { ok: false, error: "That module is not available." };

  const feature = await db.feature.findUnique({
    where: {
      moduleId_key: {
        moduleId: moduleRecord.id,
        key: parsed.data.featureKey,
      },
    },
  });
  if (!feature) return { ok: false, error: "That feature is not available." };

  // The leaderboard's publish gate (PERFORMANCE-MODULE.md §C): ranking
  // people by rules nobody can read is exactly the opaque scoring this
  // module exists to end, so the flag refuses until a definition is
  // published. Enforced here in code, not in anyone's memory.
  if (
    parsed.data.moduleKey === "PERFORMANCE" &&
    parsed.data.featureKey === "leaderboard" &&
    parsed.data.enabled
  ) {
    const { getPolicy } = await import("@/lib/policies");
    const scoring = await getPolicy(session.tenant.id, "performance");
    if (scoring == null) {
      return {
        ok: false,
        error:
          "Publish the scoring rules first (Settings → Performance scoring). A leaderboard needs published rules everyone can read.",
      };
    }
  }

  const existing = await db.tenantFeatureSetting.findUnique({
    where: {
      tenantId_featureId: {
        tenantId: session.tenant.id,
        featureId: feature.id,
      },
    },
  });
  const before = existing ? existing.enabled : feature.defaultEnabled;

  await db.tenantFeatureSetting.upsert({
    where: {
      tenantId_featureId: {
        tenantId: session.tenant.id,
        featureId: feature.id,
      },
    },
    update: { enabled: parsed.data.enabled, updatedById: session.user.id },
    create: {
      tenantId: session.tenant.id,
      featureId: feature.id,
      enabled: parsed.data.enabled,
      updatedById: session.user.id,
    },
  });

  await recordAuditEvent(session, {
    action: parsed.data.enabled ? "feature.enabled" : "feature.disabled",
    entityType: "feature",
    entityId: feature.id,
    before: { enabled: before },
    after: { enabled: parsed.data.enabled },
    metadata: {
      moduleKey: parsed.data.moduleKey,
      featureKey: parsed.data.featureKey,
    },
  });

  revalidatePath("/admin/modules");

  return {
    ok: true,
    message: `${feature.name} is ${parsed.data.enabled ? "on" : "off"}.`,
  };
}
