import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { Card, CardHeader } from "@/components/ui/Card";
import { MODULES, type ModuleKey } from "@/lib/catalog";
import { loadTrialSettings } from "@/lib/platform/settings";
import { TrialSettingsForm } from "./TrialSettingsForm";

export const metadata: Metadata = { title: "Platform settings" };

/** What every new self-signup trial gets. Existing companies are not changed. */
export default async function PlatformSettingsPage() {
  await requirePlatformAdmin();
  const settings = await loadTrialSettings();
  const modules = (Object.keys(MODULES) as ModuleKey[])
    .filter((k) => MODULES[k].category !== "CORE")
    .map((k) => ({ key: k, name: MODULES[k].name, optional: MODULES[k].category === "OPTIONAL" }));

  return (
    <>
      <h1 className="font-heading text-h1 text-text-primary">Platform settings</h1>
      <div className="mt-5 max-w-[640px]">
        <Card>
          <CardHeader
            title="New free trials"
            meta="Applies to companies that sign up from now on. Change an existing company from its own page."
          />
          <TrialSettingsForm days={settings.days} selected={settings.modules} modules={modules} />
        </Card>
      </div>
    </>
  );
}
