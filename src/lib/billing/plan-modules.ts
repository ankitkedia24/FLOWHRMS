import { MODULES, type ModuleKey } from "@/lib/catalog";
import { missingRequirements, type EnabledMap } from "@/lib/modules/impact";

/**
 * A plan decides which modules a company may use. Pure, so the platform's
 * plan editor, the payment step and the tests all agree.
 */

export function isModuleKey(key: string): key is ModuleKey {
  return key in MODULES;
}

/**
 * Problems with a plan's module list: unknown keys, and modules whose
 * requirements are not in the plan (Payroll without Attendance, say).
 * Core modules are always included and never need listing.
 */
export function planModuleProblems(modules: string[]): string[] {
  const problems: string[] = [];
  const unknown = modules.filter((m) => !isModuleKey(m));
  if (unknown.length) problems.push(`Unknown module${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`);
  const set: EnabledMap = Object.fromEntries(modules.filter(isModuleKey).map((m) => [m, true]));
  for (const key of modules.filter(isModuleKey)) {
    const missing = missingRequirements(set, key);
    if (missing.length) {
      problems.push(`${MODULES[key].name} needs ${missing.map((m) => MODULES[m].name).join(" or ")}`);
    }
  }
  return problems;
}

export interface ModuleSettingState {
  key: ModuleKey;
  enabled: boolean;
  allowedByPlatform: boolean;
}

/**
 * What a company's module settings become when it moves onto a plan.
 *
 * - Not in the plan: left exactly as it is. Paying, or Flowacord applying
 *   a plan, never takes away something the company already has (decided
 *   29 Sept 2026, pricing brief §13: "never automatically remove an
 *   existing customer capability"). Flowacord removes a module from one
 *   company deliberately, from /platform/companies.
 * - In the plan and already the company's to manage: left as the company
 *   set it — paying never undoes their own choices.
 * - Newly included: switched on, with anything it needs.
 * - Core modules: always on.
 *
 * Returns only the settings that change.
 */
export function applyPlanModules(
  current: ModuleSettingState[],
  planModules: string[],
): ModuleSettingState[] {
  const inPlan = new Set(planModules.filter(isModuleKey));
  const next = new Map<ModuleKey, ModuleSettingState>();
  for (const s of current) {
    if (MODULES[s.key].category === "CORE") {
      next.set(s.key, { key: s.key, enabled: true, allowedByPlatform: true });
    } else if (!inPlan.has(s.key)) {
      next.set(s.key, s);
    } else {
      next.set(s.key, {
        key: s.key,
        enabled: s.allowedByPlatform ? s.enabled : true,
        allowedByPlatform: true,
      });
    }
  }

  // A module switched on must have what it needs switched on too, as long
  // as the plan includes it. Repeat until nothing more changes.
  for (let changed = true; changed; ) {
    changed = false;
    const enabled: EnabledMap = Object.fromEntries([...next.values()].map((s) => [s.key, s.enabled]));
    for (const s of next.values()) {
      if (!s.enabled) continue;
      const need = missingRequirements(enabled, s.key).find((m) => inPlan.has(m) && next.has(m));
      if (need) {
        next.set(need, { key: need, enabled: true, allowedByPlatform: true });
        changed = true;
        break;
      }
    }
  }

  return current
    .map((s) => next.get(s.key)!)
    .filter((n, i) => n.enabled !== current[i].enabled || n.allowedByPlatform !== current[i].allowedByPlatform);
}
