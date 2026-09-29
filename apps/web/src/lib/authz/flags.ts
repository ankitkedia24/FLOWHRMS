import { FEATURES, MODULES, type ModuleKey, type PermissionKey } from "@/lib/catalog";
import type { AppSession, TenantEntitlements } from "@/lib/auth/types";

/**
 * Module / feature-flag evaluation (FEATURE-FLAGS.md).
 *
 * Evaluation order for every request:
 *   tenant → module → feature → role permission → user exception → policy.
 *
 * The SAME decision must drive navigation, UI actions, API authorization,
 * background jobs, notifications, reports and offline sync — server-side
 * denial is mandatory; hiding a menu item is never the control
 * (Product Constitution §5). This module is pure and synchronous so it can
 * run identically in server components, route handlers and jobs.
 */

export type DenyReason =
  | "no-session"
  | "tenant-inactive"
  | "module-disabled"
  | "feature-disabled"
  | "missing-permission";

export interface AccessDecision {
  allowed: boolean;
  reason: "ok" | DenyReason;
  /** Plain-language explanation, safe to show the user. */
  message?: string;
}

const deny = (reason: DenyReason, message: string): AccessDecision => ({
  allowed: false,
  reason,
  message,
});

export function evaluateAccess(input: {
  session: AppSession | null;
  entitlements: TenantEntitlements;
  module: ModuleKey;
  /** Feature key inside the module (e.g. "gps_capture"). */
  feature?: string;
  /** Required permission, checked against the session's role. */
  permission?: PermissionKey;
}): AccessDecision {
  const { session, entitlements, module: moduleKey, feature, permission } = input;

  if (!session) {
    return deny("no-session", "Sign in to continue.");
  }

  // Module (tenant scope). CORE modules are always on.
  const moduleDef = MODULES[moduleKey];
  const moduleEnabled =
    moduleDef.category === "CORE" || entitlements.modules[moduleKey] === true;
  if (!moduleEnabled) {
    return deny(
      "module-disabled",
      `${moduleDef.name} is turned off for your company. Your company owner can turn it on in Module Management.`,
    );
  }

  // Feature (tenant scope, then user-scope exception).
  if (feature) {
    const featureId = `${moduleKey}.${feature}`;
    const setting = entitlements.features[featureId];
    const catalogDefault = FEATURES.find(
      (f) => f.module === moduleKey && f.key === feature,
    )?.defaultEnabled;
    let featureEnabled = setting ? setting.enabled : (catalogDefault ?? false);

    const exception = entitlements.userExceptions[featureId];
    if (exception !== undefined) featureEnabled = exception;

    if (!featureEnabled) {
      return deny(
        "feature-disabled",
        `This feature is turned off for your company.`,
      );
    }
  }

  // Role permission (role scope).
  if (permission && !session.permissions.has(permission)) {
    return deny(
      "missing-permission",
      "You don't have access to this. Ask your company owner if you need it.",
    );
  }

  return { allowed: true, reason: "ok" };
}

/** Read a policy value for a policy-scope flag (grace minutes, radius, …). */
export function getFeaturePolicy<T = unknown>(
  entitlements: TenantEntitlements,
  moduleKey: ModuleKey,
  feature: string,
): T | undefined {
  return entitlements.features[`${moduleKey}.${feature}`]?.policy as
    | T
    | undefined;
}

/**
 * Modules to show in navigation — strictly the enabled set; a disabled
 * module's nav item is absent, never greyed (component-specifications §16).
 */
export function enabledModuleKeys(
  entitlements: TenantEntitlements,
): ModuleKey[] {
  return (Object.values(MODULES) as Array<(typeof MODULES)[ModuleKey]>)
    .filter(
      (m) => m.category === "CORE" || entitlements.modules[m.key] === true,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => m.key);
}
