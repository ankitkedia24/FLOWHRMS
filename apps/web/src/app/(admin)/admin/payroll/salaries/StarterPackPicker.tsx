"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { applyStarterPackAction } from "@/lib/payroll/structure-actions";
import { STARTER_PACKS, type PackId } from "@/lib/payroll/simple";

/**
 * How salaries are shaped: one amount, a split, or fully custom.
 *
 * Choosing here never rewrites anyone's existing salary — it changes what
 * NEW saves look like. That is said on screen, because "will this change
 * what people are paid?" is the first question an owner will have.
 */
export function StarterPackPicker({
  current,
  percents,
}: {
  current: PackId;
  percents: Record<string, number>;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<PackId>(current);
  const [edited, setEdited] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(percents).map(([k, v]) => [k, String(v)]),
    ),
  );

  const chosenPack = STARTER_PACKS.find((p) => p.id === choice) ?? null;
  const percentComponents =
    chosenPack?.components.filter((c) => c.defaultPercent != null) ?? [];

  const percentSum = percentComponents.reduce(
    (sum, c) => sum + Number(edited[c.key] ?? c.defaultPercent ?? 0),
    0,
  );
  const percentsValid = percentComponents.every((c) => {
    const value = Number(edited[c.key] ?? c.defaultPercent ?? 0);
    return Number.isFinite(value) && value >= 0 && value <= 100;
  });

  function apply() {
    startTransition(async () => {
      const result = await applyStarterPackAction({
        pack: choice,
        percents:
          percentComponents.length > 0
            ? Object.fromEntries(
                percentComponents.map((c) => [
                  c.key,
                  Number(edited[c.key] ?? c.defaultPercent ?? 0),
                ]),
              )
            : undefined,
      });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="How are salaries structured?"
        meta="Changing this never alters a salary you already saved — only what new saves look like."
      />

      <div role="radiogroup" aria-label="Salary shape" className="flex flex-col gap-2">
        {[
          ...STARTER_PACKS.map((pack) => ({
            id: pack.id as PackId,
            label: pack.label,
            description: pack.description,
          })),
          {
            id: "custom" as PackId,
            label: "Custom (advanced)",
            description:
              "Define your own pay items — earnings, deductions, percentages, per-day amounts — and set each salary item by item.",
          },
        ].map((option) => (
          <label
            key={option.id}
            className={`flex cursor-pointer items-start gap-3 rounded-md border-[1.5px] p-3 ${
              choice === option.id
                ? "border-brand-primary bg-brand-primary-subtle"
                : "border-border-default hover:border-border-strong"
            }`}
          >
            <input
              type="radio"
              name="starter-pack"
              value={option.id}
              checked={choice === option.id}
              onChange={() => setChoice(option.id)}
              className="mt-1"
            />
            <span>
              <span className="block text-body font-semibold text-text-primary">
                {option.label}
              </span>
              <span className="block text-secondary text-text-secondary">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </div>

      {percentComponents.length > 0 && (
        <div className="mt-4 border-t border-border-subtle pt-3">
          <p className="micro-label mb-2 text-text-tertiary">
            The split — change it to whatever your company uses
          </p>
          <div className="flex flex-wrap gap-3">
            {percentComponents.map((c) => (
              <div key={c.key} className="w-40">
                <Input
                  label={c.name}
                  type="number"
                  inputMode="numeric"
                  suffix="%"
                  value={edited[c.key] ?? String(c.defaultPercent)}
                  onChange={(e) =>
                    setEdited((prev) => ({ ...prev, [c.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <p className="mt-1 text-caption text-text-secondary">
            The rest of each salary is saved as a fixed allowance, so the
            total always equals the amount you enter.
          </p>
          {(!percentsValid || percentSum > 100) && (
            <div className="mt-2">
              <Alert
                variant="error"
                title="Percentages must be 0–100 and add up to at most 100."
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        <Button
          loading={pending}
          disabled={
            (!percentsValid || percentSum > 100) ||
            (choice === current && percentComponents.length === 0)
          }
          disabledReason={
            !percentsValid || percentSum > 100
              ? "Fix the percentages first."
              : choice === current && percentComponents.length === 0
                ? "This is already the current setup."
                : undefined
          }
          onClick={apply}
        >
          Use this setup
        </Button>
      </div>
    </Card>
  );
}
