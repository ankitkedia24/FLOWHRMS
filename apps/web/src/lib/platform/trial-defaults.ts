import { DEFAULT_ENABLED_MODULES, MODULES, type ModuleKey } from "@/lib/catalog";

/**
 * What a new self-signup company gets, until Flowacord changes it in
 * /platform/settings. Plain values, shared with the settings screen.
 */
export interface TrialSettings {
  days: number;
  /** Modules switched on for a new trial company. Others are "not in your plan". */
  modules: ModuleKey[];
}

export const DEFAULT_TRIAL_SETTINGS: TrialSettings = {
  days: 30,
  modules: [...DEFAULT_ENABLED_MODULES],
};

export function normaliseTrialSettings(raw: unknown): TrialSettings {
  const value = (raw ?? {}) as Partial<TrialSettings>;
  const days =
    Number.isInteger(value.days) && (value.days as number) >= 1 && (value.days as number) <= 365
      ? (value.days as number)
      : DEFAULT_TRIAL_SETTINGS.days;
  const known = new Set(Object.keys(MODULES));
  const modules = Array.isArray(value.modules)
    ? (value.modules.filter((m) => known.has(m)) as ModuleKey[])
    : DEFAULT_TRIAL_SETTINGS.modules;
  // Notifications is core platform plumbing and always on.
  return { days, modules: [...new Set<ModuleKey>([...modules, "NOTIFICATIONS" as ModuleKey])] };
}
