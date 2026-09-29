"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { publishFieldVisitsPolicyAction } from "@/lib/field-visits/policy-actions";
import {
  FAR_FLAG_MAX_M,
  FAR_FLAG_MIN_M,
  MAX_RATE_PER_KM,
  PLACE_WORD_MAX,
  PLACE_WORD_PRESETS,
  slugify,
  withArticle,
  type FieldVisitsPolicy,
  type PhotoRule,
  type RecorderMode,
  type Vehicle,
  type VisitPurpose,
} from "@/lib/field-visits/policy";

/**
 * The field visit rules editor (FIELD-VISITS-MODULE.md §6). Every value is
 * the company's; publishing makes a new version and never rewrites a trip
 * already made under an older one.
 */

interface VehicleDraft extends Vehicle {
  /** Rate as typed, so a half-typed number is not clamped mid-keystroke. */
  rateText: string;
}

const CUSTOM = "custom";

function presetKeyFor(word: FieldVisitsPolicy["placeWord"]): string {
  return (
    PLACE_WORD_PRESETS.find((p) => p.singular === word.singular && p.plural === word.plural)?.key ?? CUSTOM
  );
}

function rateOk(text: string): boolean {
  if (text.trim() === "") return true;
  const n = Number(text);
  return Number.isFinite(n) && n > 0 && n <= MAX_RATE_PER_KM;
}

export function FieldVisitsEditor({
  initial,
  published,
  departments,
}: {
  initial: FieldVisitsPolicy;
  published: boolean;
  departments: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();

  const [wordKey, setWordKey] = useState(presetKeyFor(initial.placeWord));
  const [ownSingular, setOwnSingular] = useState(wordKey === CUSTOM ? initial.placeWord.singular : "");
  const [ownPlural, setOwnPlural] = useState(wordKey === CUSTOM ? initial.placeWord.plural : "");
  const [purposes, setPurposes] = useState<VisitPurpose[]>(initial.purposes);
  const [photo, setPhoto] = useState<PhotoRule>(initial.photo);
  const [far, setFar] = useState(String(initial.farFlagMeters));
  const [approval, setApproval] = useState(initial.goingOutApproval);
  const [updates, setUpdates] = useState(initial.managerUpdates);
  const [mode, setMode] = useState<RecorderMode>(initial.recorders.mode);
  const [chosen, setChosen] = useState<string[]>(initial.recorders.departmentIds);
  const [vehicles, setVehicles] = useState<VehicleDraft[]>(
    initial.vehicles.map((v) => ({ ...v, rateText: v.ratePerKm == null ? "" : String(v.ratePerKm) })),
  );

  const preset = PLACE_WORD_PRESETS.find((p) => p.key === wordKey);
  const singular = (preset?.singular ?? ownSingular).trim();
  const plural = (preset?.plural ?? (ownPlural.trim() || (singular ? `${singular}s` : ""))).trim();

  const farN = Number(far);
  const farOk = Number.isInteger(farN) && farN >= FAR_FLAG_MIN_M && farN <= FAR_FLAG_MAX_M;
  const ratesOk = vehicles.every((v) => rateOk(v.rateText));
  const blocker = !singular
    ? "Give the word for what your people visit."
    : !farOk
      ? `The away-from-saved-spot distance must be ${FAR_FLAG_MIN_M}–${FAR_FLAG_MAX_M} metres.`
      : mode === "DEPARTMENTS" && chosen.length === 0
        ? "Choose at least one department, or let everyone record visits."
        : !ratesOk
          ? `Rates must be more than ₹0 and at most ₹${MAX_RATE_PER_KM} per km.`
          : null;

  function updatePurpose(index: number, patch: Partial<VisitPurpose>) {
    setPurposes((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function updateVehicle(index: number, patch: Partial<VehicleDraft>) {
    setVehicles((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function toggleDepartment(id: string, on: boolean) {
    setChosen((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)));
  }

  function publish() {
    startTransition(async () => {
      const result = await publishFieldVisitsPolicyAction({
        placeWord: { singular, plural },
        purposes: purposes
          .filter((p) => p.name.trim())
          .map((p) => ({ ...p, key: p.key || slugify(p.name), name: p.name.trim() })),
        photo,
        farFlagMeters: farN,
        goingOutApproval: approval,
        managerUpdates: updates,
        recorders: { mode, departmentIds: mode === "DEPARTMENTS" ? chosen : [] },
        vehicles: vehicles
          .filter((v) => v.name.trim())
          .map((v) => ({
            key: v.key || slugify(v.name),
            name: v.name.trim(),
            isActive: v.isActive,
            sortOrder: v.sortOrder,
            ratePerKm: v.rateText.trim() === "" ? null : Number(v.rateText),
          })),
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
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="What your people visit" meta="Used on every button, heading and report" />
        <div role="radiogroup" aria-label="What your people visit" className="flex flex-wrap gap-2">
          {[...PLACE_WORD_PRESETS.map((p) => ({ key: p.key, label: p.singular })), { key: CUSTOM, label: "Your own word" }].map(
            (option) => (
              <label
                key={option.key}
                className={`flex cursor-pointer items-center gap-2 rounded-md border-[1.5px] px-3 py-1.5 text-label ${
                  wordKey === option.key
                    ? "border-brand-primary bg-brand-primary-subtle text-text-primary"
                    : "border-border-default text-text-secondary hover:border-border-strong"
                }`}
              >
                <input
                  type="radio"
                  name="place-word"
                  value={option.key}
                  checked={wordKey === option.key}
                  onChange={() => setWordKey(option.key)}
                  className="sr-only"
                />
                {option.key === CUSTOM ? option.label : option.label.charAt(0).toUpperCase() + option.label.slice(1)}
              </label>
            ),
          )}
        </div>
        {wordKey === CUSTOM && (
          <div className="mt-3 grid gap-1 sm:grid-cols-2">
            <Input
              label="One"
              value={ownSingular}
              maxLength={PLACE_WORD_MAX}
              onChange={(event) => setOwnSingular(event.target.value)}
              error={ownSingular.trim() ? undefined : "Give the word."}
            />
            <Input
              label="More than one"
              optional
              value={ownPlural}
              maxLength={PLACE_WORD_MAX}
              onChange={(event) => setOwnPlural(event.target.value)}
              helper={singular && !ownPlural.trim() ? `Left empty, it reads “${singular}s”.` : undefined}
            />
          </div>
        )}
        {singular && (
          <p className="mt-3 text-caption text-text-secondary">
            Buttons read “Reached {withArticle(singular)}” and “Search {plural}”.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Visit purposes"
          meta="Picking one is always optional"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setPurposes((rows) => [
                  ...rows,
                  { key: "", name: "", isActive: true, sortOrder: (rows.at(-1)?.sortOrder ?? 0) + 10 },
                ])
              }
            >
              Add purpose
            </Button>
          }
        />
        <ul className="flex flex-col divide-y divide-border-subtle">
          {purposes.map((p, index) => (
            <li key={p.key || `new-${index}`} className="grid gap-2 py-3 first:pt-0 sm:grid-cols-[1fr_auto] sm:items-end">
              <Input label="Name" value={p.name} onChange={(event) => updatePurpose(index, { name: event.target.value })} />
              <div className="pb-1">
                <Checkbox
                  label="In use"
                  checked={p.isActive}
                  onChange={(event) => updatePurpose(index, { isActive: event.target.checked })}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-caption text-text-secondary">
          Retire a purpose by unticking In use — visits already made keep its name.
        </p>
      </Card>

      <Card>
        <CardHeader title="At each visit" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Photo"
            options={[
              { value: "OFF", label: "Off" },
              { value: "OPTIONAL", label: "Optional" },
              { value: "REQUIRED", label: "Required" },
            ]}
            value={photo}
            onChange={(event) => setPhoto(event.target.value as PhotoRule)}
          />
          <Input
            label={`Flag a visit away from the saved ${singular || "place"}`}
            type="number"
            inputMode="numeric"
            min={FAR_FLAG_MIN_M}
            max={FAR_FLAG_MAX_M}
            suffix="metres"
            value={far}
            onChange={(event) => setFar(event.target.value)}
            helper="The visit still counts; the report shows a flag."
            error={farOk ? undefined : `${FAR_FLAG_MIN_M}–${FAR_FLAG_MAX_M} metres.`}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Reporting manager" meta="The person's reporting manager, else their department head" />
        <div className="flex flex-col gap-3">
          <Checkbox
            label="Going out needs approval"
            helper="The person is never stopped: the trip starts at once and the manager approves or declines it. Declined trips are left out of travel claims."
            checked={approval}
            onChange={(event) => setApproval(event.target.checked)}
          />
          <Checkbox
            label={`Tell the manager at every tap`}
            helper={`Reached ${withArticle(singular || "place")}, End visit and Back at office arrive as information — nothing to do.`}
            checked={updates}
            onChange={(event) => setUpdates(event.target.checked)}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Who records visits" meta="Owners never record — they see everyone's" />
        <Select
          label="Recorded by"
          options={[
            { value: "ALL", label: "Everyone except owners" },
            { value: "DEPARTMENTS", label: "Only people in chosen departments" },
          ]}
          value={mode}
          onChange={(event) => setMode(event.target.value as RecorderMode)}
        />
        {mode === "DEPARTMENTS" &&
          (departments.length === 0 ? (
            <p className="mt-2 text-caption text-text-secondary">
              Your company has no departments yet. Add them in Settings → Departments.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {departments.map((d) => (
                <Checkbox
                  key={d.id}
                  label={d.name}
                  checked={chosen.includes(d.id)}
                  onChange={(event) => toggleDepartment(d.id, event.target.checked)}
                />
              ))}
            </div>
          ))}
      </Card>

      <Card>
        <CardHeader
          title="Travel allowance"
          meta="Paid per km of road distance between the tapped spots, claimed monthly"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setVehicles((rows) => [
                  ...rows,
                  {
                    key: "",
                    name: "",
                    ratePerKm: null,
                    isActive: true,
                    sortOrder: (rows.at(-1)?.sortOrder ?? 0) + 10,
                    rateText: "",
                  },
                ])
              }
            >
              Add vehicle
            </Button>
          }
        />
        <ul className="flex flex-col divide-y divide-border-subtle">
          {vehicles.map((v, index) => (
            <li key={v.key || `new-${index}`} className="grid gap-2 py-3 first:pt-0 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <Input label="Vehicle" value={v.name} onChange={(event) => updateVehicle(index, { name: event.target.value })} />
              <Input
                label="Rate"
                optional
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                prefix="₹"
                suffix="/km"
                value={v.rateText}
                onChange={(event) => updateVehicle(index, { rateText: event.target.value })}
                error={rateOk(v.rateText) ? undefined : `Up to ₹${MAX_RATE_PER_KM}.`}
                className="sm:w-40"
              />
              <div className="pb-1">
                <Checkbox
                  label="In use"
                  checked={v.isActive}
                  onChange={(event) => updateVehicle(index, { isActive: event.target.checked })}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-caption text-text-secondary">
          Nobody can claim travel until a vehicle has a rate. Each person picks their vehicle once.
        </p>
      </Card>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Button
          size="lg"
          loading={pending}
          disabled={Boolean(blocker)}
          disabledReason={blocker ?? undefined}
          onClick={publish}
        >
          {published ? "Publish new version" : "Publish"}
        </Button>
        <p className="text-caption text-text-secondary">
          Location is saved only when someone taps — never in between.
        </p>
      </div>
    </div>
  );
}
