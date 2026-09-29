"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { saveCompanySettingsAction } from "@/lib/settings/actions";
import { TIMEZONES } from "@/lib/settings/constants";

/** Company name and timezone (screen A24). */
export function CompanyForm({
  name,
  timezone,
}: {
  name: string;
  timezone: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name, timezone });

  const timezoneChanged = form.timezone !== timezone;

  return (
    <Card>
      <CardHeader
        title="Company"
        meta="Shown in the app and on anything you export."
      />
      <div className="flex flex-col gap-1">
        <Input
          label="Company name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Select
          label="Timezone"
          value={form.timezone}
          onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          helper="Times are stored in UTC and shown in this timezone."
          options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
        />
      </div>

      {timezoneChanged && (
        <div className="mt-3">
          <Alert
            variant="consequence"
            title="Changing the timezone changes how existing times are shown."
          >
            Nothing already recorded moves — a check-in keeps the moment it
            happened. Shift start times and work dates will read differently.
          </Alert>
        </div>
      )}

      <div className="mt-4">
        <Button
          loading={pending}
          disabled={!form.name.trim()}
          disabledReason={
            !form.name.trim() ? "Give your company a name." : undefined
          }
          onClick={() =>
            startTransition(async () => {
              const result = await saveCompanySettingsAction({
                name: form.name.trim(),
                timezone: form.timezone as (typeof TIMEZONES)[number],
              });
              if (result.ok) {
                show({ variant: "success", message: result.message });
                router.refresh();
              } else {
                show({ variant: "error", message: result.error });
              }
            })
          }
        >
          Save changes
        </Button>
      </div>
    </Card>
  );
}
