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
import { monthsFree } from "@/lib/billing/pricing";

type NumberField =
  | "priceMonthly"
  | "priceAnnual"
  | "includedEmployees"
  | "extraEmployeeMonthly"
  | "extraEmployeeAnnual"
  | "sortOrder";

interface PlanDraft {
  id: string;
  key: string;
  name: string;
  target: string;
  priceMonthly: number;
  priceAnnual: number;
  includedEmployees: number;
  extraEmployeeMonthly: number;
  extraEmployeeAnnual: number;
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
  modules: Array<{ key: string; name: string; optional: boolean; built: boolean }>;
  nextSortOrder?: number;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(plan !== null);
  const [draft, setDraft] = useState<
    Omit<PlanDraft, "id" | NumberField> & Record<NumberField, string>
  >({
    key: plan?.key ?? "",
    name: plan?.name ?? "",
    target: plan?.target ?? "",
    priceMonthly: String(plan?.priceMonthly ?? ""),
    priceAnnual: String(plan?.priceAnnual ?? ""),
    includedEmployees: String(plan?.includedEmployees ?? ""),
    extraEmployeeMonthly: String(plan?.extraEmployeeMonthly ?? ""),
    extraEmployeeAnnual: String(plan?.extraEmployeeAnnual ?? ""),
    modules: plan?.modules ?? ["EMPLOYEES", "ATTENDANCE", "LEAVE", "NOTIFICATIONS"],
    features: plan?.features ?? "",
    flagship: plan?.flagship ?? false,
    active: plan?.active ?? true,
    sortOrder: String(plan?.sortOrder ?? nextSortOrder),
  });
  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const free = monthsFree({ priceMonthly: Number(draft.priceMonthly), priceAnnual: Number(draft.priceAnnual) });
  const extraFree = monthsFree({
    priceMonthly: Number(draft.extraEmployeeMonthly),
    priceAnnual: Number(draft.extraEmployeeAnnual),
  });
  const digits = (k: NumberField) => (e: { target: { value: string } }) => set(k, e.target.value.replace(/\D/g, ""));

  function save() {
    startTransition(async () => {
      const r = await savePlanAction({
        id: plan?.id,
        key: draft.key,
        name: draft.name,
        target: draft.target,
        priceMonthly: draft.priceMonthly,
        priceAnnual: draft.priceAnnual,
        includedEmployees: draft.includedEmployees,
        extraEmployeeMonthly: draft.extraEmployeeMonthly,
        extraEmployeeAnnual: draft.extraEmployeeAnnual,
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
              helper={plan ? "Fixed once created" : "e.g. core"}
              value={draft.key}
              disabled={Boolean(plan)}
              onChange={(e) => set("key", e.target.value.toLowerCase())}
            />
          </div>
          <Input label="Who it's for" value={draft.target} onChange={(e) => set("target", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Base price, monthly"
              prefix="₹"
              suffix="/ month"
              inputMode="numeric"
              value={draft.priceMonthly}
              onChange={digits("priceMonthly")}
            />
            <Input
              label="Base price, yearly"
              helper={free ? `Paid at once — ${free} ${free === 1 ? "month" : "months"} free` : "Paid at once for the year"}
              prefix="₹"
              suffix="/ year"
              inputMode="numeric"
              value={draft.priceAnnual}
              onChange={digits("priceAnnual")}
            />
          </div>
          <Input
            label="Employees included"
            helper="Active employees the base price covers"
            inputMode="numeric"
            value={draft.includedEmployees}
            onChange={digits("includedEmployees")}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Each extra employee, monthly"
              prefix="₹"
              suffix="/ month"
              inputMode="numeric"
              value={draft.extraEmployeeMonthly}
              onChange={digits("extraEmployeeMonthly")}
            />
            <Input
              label="Each extra employee, yearly"
              helper={extraFree ? `${extraFree} ${extraFree === 1 ? "month" : "months"} free` : undefined}
              prefix="₹"
              suffix="/ year"
              inputMode="numeric"
              value={draft.extraEmployeeAnnual}
              onChange={digits("extraEmployeeAnnual")}
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
          <Switch label="Highlighted as “Most popular”" checked={draft.flagship} onChange={(v) => set("flagship", v)} />
          <Switch label="Offered to buyers" checked={draft.active} onChange={(v) => set("active", v)} />
        </div>

        <fieldset>
          <legend className="text-label text-text-primary">Modules in this plan</legend>
          <p className="text-caption text-text-secondary">
            Paying for this plan switches these on. Modules the company already has stay on; the rest show “Not in
            your plan”. A module&apos;s requirements must be included too.
          </p>
          <div className="mt-1">
            {/* A module with nothing behind it can't be sold. One already
                ticked stays untickable, so an old plan can be tidied. */}
            {modules.map((m) => (
              <Checkbox
                key={m.key}
                label={m.name}
                helper={
                  !m.built
                    ? draft.modules.includes(m.key)
                      ? "Not built yet — untick it to save this plan"
                      : "Not built yet"
                    : m.optional
                      ? "Optional module"
                      : undefined
                }
                disabled={!m.built && !draft.modules.includes(m.key)}
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
