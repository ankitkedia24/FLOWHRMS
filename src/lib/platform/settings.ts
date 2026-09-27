import "server-only";

import { getDb } from "@/lib/db";
import { normaliseTrialSettings, type TrialSettings } from "./trial-defaults";

const TRIAL_KEY = "trial";

export async function loadTrialSettings(): Promise<TrialSettings> {
  const row = await getDb().platformSetting.findUnique({ where: { key: TRIAL_KEY } });
  return normaliseTrialSettings(row?.value);
}

export async function saveTrialSettings(
  value: TrialSettings,
  updatedById: string,
): Promise<{ before: TrialSettings; after: TrialSettings }> {
  const before = await loadTrialSettings();
  const after = normaliseTrialSettings(value);
  await getDb().platformSetting.upsert({
    where: { key: TRIAL_KEY },
    update: { value: after as unknown as object, updatedById },
    create: { key: TRIAL_KEY, value: after as unknown as object, updatedById },
  });
  return { before, after };
}
