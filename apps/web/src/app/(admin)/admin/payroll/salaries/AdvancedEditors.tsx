"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import {
  saveSalaryComponentAction,
  saveSalaryStructureAction,
} from "@/lib/payroll/structure-actions";

/**
 * The advanced path: tenant-defined pay items and per-item salaries.
 *
 * Most companies never open these — the one-number salary forms cover
 * them. These editors exist for pay that genuinely has parts, and adding
 * an item here is what moves a tenant into the custom setup.
 */

/** Add or update a pay item (tenant-defined, never shipped by FlowHRMS). */
export function ComponentEditor() {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"EARNING" | "DEDUCTION">("EARNING");
  const [calculation, setCalculation] = useState<
    "FIXED" | "PERCENT_OF_BASE" | "PER_DAY"
  >("FIXED");
  const [prorated, setProrated] = useState(true);

  const key = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Add pay item</Button>;
  }

  return (
    <Card>
      <CardHeader title="Add a pay item" />
      <div className="flex flex-col gap-1">
        <Input
          label="Name"
          required
          placeholder="House rent allowance"
          value={name}
          onChange={(e) => setName(e.target.value)}
          helper={key ? `Key: ${key}` : undefined}
        />
        <Select
          label="Type"
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          options={[
            { value: "EARNING", label: "Earning — adds to pay" },
            { value: "DEDUCTION", label: "Deduction — reduces pay" },
          ]}
        />
        <Select
          label="Calculated as"
          value={calculation}
          onChange={(e) => setCalculation(e.target.value as typeof calculation)}
          options={[
            { value: "FIXED", label: "Fixed monthly amount" },
            { value: "PERCENT_OF_BASE", label: "Percentage of base" },
            { value: "PER_DAY", label: "Amount per payable day" },
          ]}
        />
        <div className="mt-2">
          <Checkbox
            checked={prorated}
            onChange={(e) => setProrated(e.target.checked)}
            label="Reduce this for unpaid days"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 md:flex-row">
        <Button
          loading={pending}
          disabled={!key}
          disabledReason={!key ? "Give the pay item a name." : undefined}
          onClick={() =>
            startTransition(async () => {
              const result = await saveSalaryComponentAction({
                key,
                name: name.trim(),
                kind,
                calculation,
                prorated,
              });
              if (result.ok) {
                show({ variant: "success", message: result.message });
                setOpen(false);
                setName("");
                router.refresh();
              } else {
                show({ variant: "error", message: result.error });
              }
            })
          }
        >
          Save pay item
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

interface ComponentOption {
  id: string;
  name: string;
  kind: string;
  calculation: string;
}

/** Set an employee's salary item by item, effective from a date. */
export function StructureEditor({
  members,
  components,
}: {
  members: Array<{ id: string; name: string }>;
  components: ComponentOption[];
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [membershipId, setMembershipId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const selected = components.filter((c) => {
    const raw = values[c.id];
    return raw != null && raw !== "" && Number(raw) > 0;
  });

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Set a custom salary</Button>;
  }

  return (
    <Card>
      <CardHeader
        title="Set a custom salary"
        meta="A new effective date supersedes the previous salary; history is kept."
      />
      <div className="flex flex-col gap-1">
        <Select
          label="Employee"
          required
          placeholder="Choose an employee"
          value={membershipId}
          onChange={(e) => setMembershipId(e.target.value)}
          options={members.map((m) => ({ value: m.id, label: m.name }))}
        />
        <Input
          label="Effective from"
          type="date"
          required
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
        />
        <Input
          label="Base amount"
          type="number"
          inputMode="numeric"
          required
          prefix="₹"
          helper="Percentage items are calculated from this."
          value={baseAmount}
          onChange={(e) => setBaseAmount(e.target.value)}
        />
      </div>

      <div className="mt-4 border-t border-border-subtle pt-3">
        <p className="micro-label mb-2 text-text-tertiary">Pay items</p>
        <ul className="flex flex-col gap-2">
          {components.map((component) => (
            <li
              key={component.id}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <label
                htmlFor={`component-${component.id}`}
                className="text-body text-text-primary"
              >
                {component.name}
                <span className="ml-2 text-caption text-text-secondary">
                  {component.calculation === "PERCENT_OF_BASE"
                    ? "% of base"
                    : component.calculation === "PER_DAY"
                      ? "₹ per day"
                      : "₹ per month"}
                </span>
              </label>
              <input
                id={`component-${component.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                value={values[component.id] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [component.id]: e.target.value,
                  }))
                }
                className="h-11 w-32 rounded-input border-[1.5px] border-border-default bg-surface-default px-3 text-right font-mono text-data text-text-primary tabular-nums hover:border-border-strong"
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-col gap-2 md:flex-row">
        <Button
          loading={pending}
          disabled={!membershipId || !effectiveFrom || selected.length === 0}
          disabledReason={
            !membershipId
              ? "Choose an employee."
              : !effectiveFrom
                ? "Choose an effective date."
                : selected.length === 0
                  ? "Give at least one pay item a value."
                  : undefined
          }
          onClick={() =>
            startTransition(async () => {
              const result = await saveSalaryStructureAction({
                membershipId,
                effectiveFrom,
                baseAmount: Number(baseAmount || 0),
                lines: selected.map((component) => {
                  const value = Number(values[component.id]);
                  return component.calculation === "PERCENT_OF_BASE"
                    ? { componentId: component.id, amount: 0, percent: value }
                    : { componentId: component.id, amount: value, percent: 0 };
                }),
              });
              if (result.ok) {
                show({ variant: "success", message: result.message });
                setOpen(false);
                setValues({});
                setMembershipId("");
                setBaseAmount("");
                router.refresh();
              } else {
                show({ variant: "error", message: result.error });
              }
            })
          }
        >
          Save salary
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
