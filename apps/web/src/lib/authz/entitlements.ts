import "server-only";

import { cache } from "react";
import { getDb } from "@/lib/db";
import type { ModuleKey } from "@/lib/catalog";
import { devFixtureOffline, fixtureEntitlements } from "@/lib/auth/fixture";
import type { TenantEntitlements } from "@/lib/auth/types";

/**
 * Load a tenant's entitlement snapshot for the current request.
 * Database-backed; falls back to fixtures only in the dev preview session.
 * Cached per request via React cache().
 */
export const loadEntitlements = cache(
  async (tenantId: string, userId: string): Promise<TenantEntitlements> => {
    if (devFixtureOffline()) return fixtureEntitlements();

    const db = getDb();
    const [moduleSettings, featureSettings, exceptions] = await Promise.all([
      db.tenantModuleSetting.findMany({
        where: { tenantId },
        include: { module: { select: { key: true } } },
      }),
      db.tenantFeatureSetting.findMany({
        where: { tenantId },
        include: {
          feature: {
            select: { key: true, module: { select: { key: true } } },
          },
        },
      }),
      db.userFeatureException.findMany({
        where: {
          tenantId,
          userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          feature: {
            select: { key: true, module: { select: { key: true } } },
          },
        },
      }),
    ]);

    const modules: TenantEntitlements["modules"] = {};
    for (const setting of moduleSettings) {
      modules[setting.module.key as ModuleKey] = setting.enabled;
    }

    const features: TenantEntitlements["features"] = {};
    for (const setting of featureSettings) {
      features[`${setting.feature.module.key}.${setting.feature.key}`] = {
        enabled: setting.enabled,
        policy: setting.policy ?? undefined,
      };
    }

    const userExceptions: TenantEntitlements["userExceptions"] = {};
    for (const exception of exceptions) {
      userExceptions[
        `${exception.feature.module.key}.${exception.feature.key}`
      ] = exception.enabled;
    }

    return { modules, features, userExceptions };
  },
);
