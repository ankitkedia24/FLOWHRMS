import {
  MODULES,
  MODULE_DEPENDENCIES,
  type ModuleKey,
} from "@/lib/catalog";

/**
 * Module dependency + impact computation (MODULES.md, FEATURE-FLAGS.md,
 * user-flows.md §8). Pure functions so the same result drives the
 * confirmation modal AND the server-side guard.
 *
 * Dependency rules: entries sharing an `anyOfGroup` are satisfied when ANY
 * module of that group is enabled; ungrouped entries are all required.
 */

export type EnabledMap = Partial<Record<ModuleKey, boolean>>;

function isOn(enabled: EnabledMap, key: ModuleKey): boolean {
  return MODULES[key].category === "CORE" || enabled[key] === true;
}

/** Modules that `key` needs but which are currently off. */
export function missingRequirements(
  enabled: EnabledMap,
  key: ModuleKey,
): ModuleKey[] {
  const deps = MODULE_DEPENDENCIES.filter((d) => d.module === key);
  const missing: ModuleKey[] = [];

  const ungrouped = deps.filter((d) => !d.anyOfGroup);
  for (const dep of ungrouped) {
    if (!isOn(enabled, dep.requires)) missing.push(dep.requires);
  }

  const groups = new Set(
    deps.filter((d) => d.anyOfGroup).map((d) => d.anyOfGroup!),
  );
  for (const group of groups) {
    const options = deps.filter((d) => d.anyOfGroup === group);
    if (!options.some((d) => isOn(enabled, d.requires))) {
      missing.push(...options.map((d) => d.requires));
    }
  }

  return [...new Set(missing)];
}

/** Enabled modules that depend on `key` and would break if it went off. */
export function dependentModules(
  enabled: EnabledMap,
  key: ModuleKey,
): ModuleKey[] {
  const dependents = new Set<ModuleKey>();

  for (const dep of MODULE_DEPENDENCIES) {
    if (dep.requires !== key) continue;
    if (!isOn(enabled, dep.module)) continue;

    if (!dep.anyOfGroup) {
      dependents.add(dep.module);
      continue;
    }
    // Any-of group: only breaks if no OTHER option remains enabled.
    const siblings = MODULE_DEPENDENCIES.filter(
      (d) =>
        d.module === dep.module &&
        d.anyOfGroup === dep.anyOfGroup &&
        d.requires !== key,
    );
    if (!siblings.some((d) => isOn(enabled, d.requires))) {
      dependents.add(dep.module);
    }
  }

  return [...dependents];
}

export interface DisableImpact {
  /** Plain consequence sentence, e.g. "Payroll cannot calculate hours…". */
  sentence: string;
  /** What stops immediately. */
  stops: string[];
  /** Data-retention reassurance. */
  retention: string;
  /** Typed confirmation token for irreversible disables. */
  typedConfirm: string;
  dependents: ModuleKey[];
}

/** What turning `key` off does — computed, never generic. */
export function disableImpact(
  enabled: EnabledMap,
  key: ModuleKey,
  counts: { employees: number; adminUsers: number },
): DisableImpact {
  const moduleDef = MODULES[key];
  const dependents = dependentModules(enabled, key);

  const sentence =
    dependents.length > 0
      ? `${dependents.map((d) => MODULES[d].name).join(" and ")} cannot work without ${moduleDef.name}.`
      : `${moduleDef.name} will be removed from your company's app.`;

  const stops: string[] = [];
  if (key === "ATTENDANCE") {
    stops.push(`Check-in disappears for ${counts.employees} employees`);
    stops.push("Attendance exceptions can no longer be reviewed");
    stops.push("The daily summary loses its attendance section");
  }
  if (key === "TASKS") {
    stops.push(`Tasks disappear for ${counts.employees} employees`);
    stops.push("Task proof can no longer be submitted or reviewed");
  }
  if (key === "LEAVE") {
    stops.push("Employees can no longer request leave");
    stops.push("Pending leave requests cannot be decided");
  }
  stops.push(`${moduleDef.name} leaves the navigation for all users`);
  stops.push("Its notifications and scheduled jobs stop");
  for (const dependent of dependents) {
    stops.push(`${MODULES[dependent].name} stops updating`);
  }

  return {
    sentence,
    stops,
    retention: `No ${moduleDef.name.toLowerCase()} data is deleted. You can enable it again.`,
    typedConfirm: key,
    dependents,
  };
}
