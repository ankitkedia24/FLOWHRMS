"use client";

import { useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { LocationPicker, type PickedLocation } from "@/components/maps/LocationPicker";
import { saveDepartmentAction } from "@/lib/departments/actions";
import { saveDesignationAction } from "@/lib/designations/actions";
import { saveBranchAction } from "@/lib/branches/actions";
import { saveShiftAction } from "@/lib/policies/actions";

/**
 * Adding an employee must never mean leaving the form. Each picker that
 * needs something the company hasn't set up yet — a department, a
 * designation, a location, a shift — offers "+ Add …" as its last option,
 * which opens a small form here and selects the new entry when saved.
 */

export interface PickOption {
  value: string;
  label: string;
  disabled?: boolean;
}

const NEW = "__new__";

export function InlineCreateSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  helper,
  optional,
  required,
  error,
  createLabel,
  canCreate,
  renderCreate,
  wide = false,
  disabled = false,
}: {
  label: string;
  options: PickOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helper?: string;
  optional?: boolean;
  required?: boolean;
  error?: string;
  /** "Add a new department" — the menu entry and the dialog title. */
  createLabel: string;
  /** False: the signed-in person can't create these; no entry is offered. */
  canCreate: boolean;
  renderCreate: (done: (created: PickOption | null) => void) => ReactNode;
  /** Wider dialog, for the map. */
  wide?: boolean;
  disabled?: boolean;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <>
      <Select
        label={label}
        optional={optional}
        required={required}
        error={error}
        helper={helper}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        options={canCreate && !disabled ? [...options, { value: NEW, label: `＋ ${createLabel}…` }] : options}
        onChange={(e) => {
          if (e.target.value === NEW) setCreating(true);
          else onChange(e.target.value);
        }}
      />
      {/* Portalled: this sits inside the employee form, and a form must not
          contain another form. */}
      {creating &&
        createPortal(
          <Modal open onClose={() => setCreating(false)} title={createLabel} width={wide ? "review" : "default"}>
            {renderCreate((created) => {
              setCreating(false);
              if (created) onChange(created.value);
            })}
          </Modal>,
          document.body,
        )}
    </>
  );
}

function useSave() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(action: () => Promise<{ ok: true; id?: string } | { ok: false; error: string }>, onOk: (id: string) => void) {
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) setError(r.error);
      else if (r.id) onOk(r.id);
      else setError("Saved, but it couldn't be selected. Pick it from the list.");
    });
  }
  return { pending, error, run };
}

function Actions({ pending, onCancel, saveLabel }: { pending: boolean; onCancel: () => void; saveLabel: string }) {
  return (
    <div className="mt-2 flex flex-wrap justify-end gap-2">
      <Button type="button" variant="tertiary" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" loading={pending}>
        {saveLabel}
      </Button>
    </div>
  );
}

export function NewDepartmentForm({ onDone }: { onDone: (created: PickOption | null) => void }) {
  const { pending, error, run } = useSave();
  const [name, setName] = useState("");
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        run(() => saveDepartmentAction({ name }), (id) => onDone({ value: id, label: name.trim() }));
      }}
    >
      {error && <Alert variant="error" title={error} />}
      <Input label="Department name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Delivery" />
      <p className="text-caption text-text-secondary">You can set its head later in Settings → Departments.</p>
      <Actions pending={pending} onCancel={() => onDone(null)} saveLabel="Add department" />
    </form>
  );
}

export interface AccessOption {
  value: string;
  label: string;
  consequence: string;
  aboveYou: boolean;
}

export function NewDesignationForm({
  accessLevels,
  onDone,
}: {
  accessLevels: AccessOption[];
  onDone: (created: (PickOption & { roleId: string }) | null) => void;
}) {
  const { pending, error, run } = useSave();
  const [name, setName] = useState("");
  const allowed = accessLevels.filter((a) => !a.aboveYou);
  const [roleId, setRoleId] = useState(allowed[0]?.value ?? "");
  const chosen = accessLevels.find((a) => a.value === roleId);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        run(() => saveDesignationAction({ name, roleId }), (id) => onDone({ value: id, label: name.trim(), roleId }));
      }}
    >
      {error && <Alert variant="error" title={error} />}
      <Input
        label="Designation"
        required
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Delivery Executive"
        helper="The job title, as printed on payslips and the ID card."
      />
      <Select
        label="What can they access?"
        required
        value={roleId}
        onChange={(e) => setRoleId(e.target.value)}
        options={accessLevels.map((a) => ({
          value: a.value,
          label: a.aboveYou ? `${a.label} — above your own access` : a.label,
          disabled: a.aboveYou,
        }))}
        helper={chosen?.consequence}
      />
      <p className="text-caption text-text-secondary">
        Everyone given this designation gets this access. Fine-tune what each access level can do in Settings →
        Access levels.
      </p>
      <Actions pending={pending} onCancel={() => onDone(null)} saveLabel="Add designation" />
    </form>
  );
}

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export function NewShiftForm({ onDone }: { onDone: (created: PickOption | null) => void }) {
  const { pending, error, run } = useSave();
  const [name, setName] = useState("");
  const [start, setStart] = useState("09:30");
  const [end, setEnd] = useState("18:30");
  const [grace, setGrace] = useState("10");
  const [localError, setLocalError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const startMinutes = toMinutes(start);
        const endMinutes = toMinutes(end);
        if (startMinutes === null || endMinutes === null) {
          setLocalError("Enter a start and end time.");
          return;
        }
        setLocalError(null);
        run(
          () => saveShiftAction({ name, startMinutes, endMinutes, graceMinutes: Number(grace) || 0 }),
          (id) => onDone({ value: id, label: name.trim() }),
        );
      }}
    >
      {(localError || error) && <Alert variant="error" title={(localError ?? error)!} />}
      <Input label="Shift name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning shift" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Starts" type="time" required value={start} onChange={(e) => setStart(e.target.value)} />
        <Input label="Ends" type="time" required value={end} onChange={(e) => setEnd(e.target.value)} helper="Earlier than the start = ends next day" />
      </div>
      <Input
        label="Late after"
        type="number"
        inputMode="numeric"
        min={0}
        max={120}
        suffix="minutes"
        value={grace}
        onChange={(e) => setGrace(e.target.value)}
        helper="Checking in this many minutes after the start still counts as on time."
      />
      <Actions pending={pending} onCancel={() => onDone(null)} saveLabel="Add shift" />
    </form>
  );
}

export function NewLocationForm({
  defaultRadiusM,
  onDone,
}: {
  defaultRadiusM: number;
  onDone: (created: PickOption | null) => void;
}) {
  const { pending, error, run } = useSave();
  const [name, setName] = useState("");
  const [radius, setRadius] = useState("");
  const [place, setPlace] = useState<PickedLocation>({ address: "", lat: null, lng: null });
  const radiusM = Number(radius) >= 50 ? Number(radius) : defaultRadiusM;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        run(
          () =>
            saveBranchAction({
              name,
              address: place.address,
              lat: place.lat,
              lng: place.lng,
              radiusM: radius.trim() ? Number(radius) : null,
              isActive: true,
            }),
          (id) => onDone({ value: id, label: name.trim() }),
        );
      }}
    >
      {error && <Alert variant="error" title={error} />}
      <Input label="Location name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Main shop" />
      <LocationPicker value={place} onChange={setPlace} radiusM={radiusM} onPlaceName={(n) => setName((cur) => cur || n)} />
      <Input
        label="Check-in radius"
        optional
        type="number"
        inputMode="numeric"
        min={50}
        max={5000}
        suffix="metres"
        value={radius}
        onChange={(e) => setRadius(e.target.value)}
        helper={`Leave empty to use the company's ${defaultRadiusM} m.`}
      />
      {place.lat == null && (
        <p className="text-caption text-text-secondary">
          Without a point on the map, check-ins here aren&apos;t checked for location.
        </p>
      )}
      <Actions pending={pending} onCancel={() => onDone(null)} saveLabel="Add location" />
    </form>
  );
}
