"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { saveTrialSettingsAction } from "@/lib/platform/company-actions";

export function TrialSettingsForm({
  days,
  selected,
  modules,
}: {
  days: number;
  selected: string[];
  modules: Array<{ key: string; name: string; optional: boolean; built: boolean }>;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [length, setLength] = useState(String(days));
  const [chosen, setChosen] = useState<string[]>(selected);

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Trial length"
        type="number"
        inputMode="numeric"
        min={1}
        max={365}
        suffix="days"
        value={length}
        onChange={(e) => setLength(e.target.value)}
      />
      <fieldset>
        <legend className="text-label text-text-primary">Modules included in a new trial</legend>
        <p className="text-caption text-text-secondary">
          Core modules (employees, notifications) are always included. A
          module&apos;s requirements must be included too.
        </p>
        <div className="mt-1">
          {/* A module with nothing behind it can't be in a trial; saving
              drops it anyway (normaliseTrialSettings). */}
          {modules.map((m) => (
            <Checkbox
              key={m.key}
              label={m.name}
              helper={!m.built ? "Not built yet" : m.optional ? "Optional module" : undefined}
              disabled={!m.built}
              checked={m.built && chosen.includes(m.key)}
              onChange={(e) =>
                setChosen((c) => (e.target.checked ? [...c, m.key] : c.filter((k) => k !== m.key)))
              }
            />
          ))}
        </div>
      </fieldset>
      <div>
        <Button
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await saveTrialSettingsAction({ days: Number(length), modules: chosen });
              show({ variant: r.ok ? "success" : "error", message: r.ok ? r.message : r.error });
              if (r.ok) router.refresh();
            })
          }
        >
          Save trial settings
        </Button>
      </div>
    </div>
  );
}
