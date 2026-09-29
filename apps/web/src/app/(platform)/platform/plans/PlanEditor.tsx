"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input, TextArea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { applyPlanToCompaniesAction, savePlanAction } from "@/lib/billing/platform-actions";

interface PlanDraft {
  id: string;
  key: string;
  name: string;
  target: string;
  priceMonthly: number;
  priceAnnual: number;
  modules: string[];
  /** One per line; a leading "*" makes it bold. */
  features: string;
  flagship: boolean;
  active: boolean;
  sortOrder: number;
}

/** One plan's price, modules and website text — or a new plan when `plan` is null. */
export function PlanEditor({
  plan,
  companies,
  modules,
  nextSortOrder = 0,
}: {
  plan: PlanDraft | null;
  companies: number;
  modules: Array<{ key: string; name: string; optional: boolean }>;
  nextSortOrder?: number;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(plan !== null);
  const [draft, setDraft] = useState<Omit<PlanDraft, "id" | "priceMonthly" | "priceAnnual" | "sortOrder"> & {
    priceMonthly: string;
    priceAnnual: string;
    sortOrder: string;
  }>({
    key: plan?.key ?? "",
    name: plan?.name ?? "",
    target: plan?.target ?? "",
    priceMonthly: String(plan?.priceMonthly ?? ""),
    priceAnnual: String(plan?.priceAnnual ?? ""),
    modules: plan?.modules ?? ["EMPLOYEES", "ATTENDANCE", "LEAVE", "NOTIFICATIONS"],
    features: plan?.features ?? "",
    flagship: plan?.flagship ?? false,
    active: plan?.active ?? true,
    sortOrder: String(plan?.sortOrder ?? nextSortOrder),
  });
  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const monthly = Number(draft.priceMonthly);
  const annual = Number(draft.priceAnnual);
  const saving = monthly > 0 && annual > 0 && annual < monthly ? Math.round((1 - annual / monthly) * 100) : 0;

  function save() {
    startTransition(async () => {
      const r = await savePlanAction({
        id: plan?.id,
        key: draft.key,
        name: draft.name,
        target: draft.target,
        priceMonthly: draft.priceMonthly,
        priceAnnual: draft.priceAnnual,
        modules: draft.modules,
        features: draft.features,
        flagship: draft.flagship,
        active: draft.active,
        sortOrder: draft.sortOrder,
      });
      show({ variant: r.ok ? "success" : "error", message: r.ok ? r.message : r.error });
      if (r.ok) {
        if (!plan) setOpen(false);
        router.refresh();
      }
    });
  }

  if (!plan && !open) {
    return (
      <div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Add a plan
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader
        title={plan ? plan.name : "New plan"}
        meta={
          plan
            ? `${plan.key} · ${companies} paid ${companies === 1 ? "company" : "companies"} on it${plan.active ? "" : " · hidden from buyers"}`
            : "Shown to buyers once saved as active."
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" value={draft.name} onChange={(e) => set("name", e.target.value)} />
            <Input
              label="Key"
              helper={plan ? "Fixed once created" : "e.g. starter"}
              value={draft.key}
              disabled={Boolean(plan)}
              onChange={(e) => set("key", e.target.value.toLowerCase())}
            />
          </div>
          <Input label="Who it's for" value={draft.target} onChange={(e) => set("target", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Monthly price"
              prefix="₹"
              suffix="/ emp / mo"
              inputMode="numeric"
              value={draft.priceMonthly}
              onChange={(e) => set("priceMonthly", e.target.value.replace(/\D/g, ""))}
            />
            <Input
              label="Yearly price"
              helper={saving ? `Per month, paid yearly — ${saving}% saving` : "Per month, paid yearly"}
              prefix="₹"
              suffix="/ emp / mo"
              inputMode="numeric"
              value={draft.priceAnnual}
              onChange={(e) => set("priceAnnual", e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <TextArea
            label="Bullet points on the website"
            helper="One per line. Start a line with * to make it bold."
            rows={5}
            value={draft.features}
            onChange={(e) => set("features", e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Order"
              inputMode="numeric"
              value={draft.sortOrder}
              onChange={(e) => set("sortOrder", e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Switch label="Highlighted as “Popular”" checked={draft.flagship} onChange={(v) => set("flagship", v)} />
          <Switch label="Offered to buyers" checked={draft.active} onChange={(v) => set("active", v)} />
        </div>

        <fieldset>
          <legend className="text-label text-text-primary">Modules in this plan</legend>
          <p className="text-caption text-text-secondary">
            A company on this plan gets these; the rest show “Not in your plan”. A module&apos;s requirements must be
            included too.
          </p>
          <div className="mt-1">
            {modules.map((m) => (
              <Checkbox
                key={m.key}
                label={m.name}
                helper={m.optional ? "Optional module" : undefined}
                checked={draft.modules.includes(m.key)}
                onChange={(e) =>
                  set(
                    "modules",
                    e.target.checked ? [...draft.modules, m.key] : draft.modules.filter((k) => k !== m.key),
                  )
                }
              />
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
        <Button loading={pending} onClick={save}>
          {plan ? "Save plan" : "Create plan"}
        </Button>
        {plan && companies > 0 && (
          <Button
            variant="outline"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await applyPlanToCompaniesAction({ planId: plan.id });
                show({ variant: r.ok ? "success" : "error", message: r.ok ? r.message : r.error });
                if (r.ok) router.refresh();
              })
            }
          >
            Apply modules to {companies} {companies === 1 ? "company" : "companies"}
          </Button>
        )}
        {!plan && (
          <Button variant="tertiary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}
