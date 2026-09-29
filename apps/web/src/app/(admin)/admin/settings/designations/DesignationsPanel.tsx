"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { NewDesignationForm } from "@/components/employees/QuickCreate";
import { saveDesignationAction, setDesignationActiveAction } from "@/lib/designations/actions";
import type { AccessLevelOption } from "@/lib/employees/form-options";

export interface DesignationRow {
  id: string;
  name: string;
  roleId: string;
  roleName: string;
  holders: number;
  isActive: boolean;
  aboveYou: boolean;
}

export function DesignationsPanel({
  rows,
  accessLevels,
  canChangeAccess,
}: {
  rows: DesignationRow[];
  accessLevels: AccessLevelOption[];
  canChangeAccess: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<DesignationRow | null>(null);
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");

  const run = (action: () => Promise<{ ok: true; message: string; detail?: string } | { ok: false; error: string }>, after?: () => void) =>
    startTransition(async () => {
      const r = await action();
      show({ variant: r.ok ? "success" : "error", message: r.ok ? [r.message, r.detail].filter(Boolean).join(" ") : r.error });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });

  const level = accessLevels.find((a) => a.value === roleId);
  const accessLocked = Boolean(editing && editing.holders > 0 && !canChangeAccess);

  return (
    <>
      <div>
        <Button leadingIcon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setAdding(true)}>
          Add a designation
        </Button>
      </div>

      <Card flush>
        <ul className="divide-y divide-border-subtle">
          {rows.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className={d.isActive ? "text-body font-semibold text-text-primary" : "text-body text-text-tertiary line-through"}>
                  {d.name}
                </p>
                <p className="text-caption text-text-secondary">
                  {d.roleName} access · {d.holders} {d.holders === 1 ? "person" : "people"}
                  {d.isActive ? "" : " · turned off"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!d.aboveYou && d.isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(d);
                      setName(d.name);
                      setRoleId(d.roleId);
                    }}
                  >
                    Edit
                  </Button>
                )}
                {!d.aboveYou && (d.isActive ? d.holders === 0 : true) && (
                  <Button
                    size="sm"
                    variant="tertiary"
                    loading={pending}
                    onClick={() => run(() => setDesignationActiveAction({ id: d.id, active: !d.isActive }))}
                  >
                    {d.isActive ? "Turn off" : "Turn on"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a designation">
        {adding && (
          <NewDesignationForm
            accessLevels={accessLevels}
            onDone={(created) => {
              setAdding(false);
              if (created) {
                show({ variant: "success", message: `${created.label} added.` });
                router.refresh();
              }
            }}
          />
        )}
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={`Edit ${editing?.name ?? ""}`}>
        {editing && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveDesignationAction({ id: editing.id, name, roleId }), () => setEditing(null));
            }}
          >
            <Input label="Designation" required value={name} onChange={(e) => setName(e.target.value)} />
            <Select
              label="What can they access?"
              required
              disabled={accessLocked}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              options={accessLevels.map((a) => ({
                value: a.value,
                label: a.aboveYou ? `${a.label} — above your own access` : a.label,
                disabled: a.aboveYou,
              }))}
              helper={
                accessLocked
                  ? "People hold this designation, so only someone who manages access levels can change its access."
                  : level?.consequence
              }
            />
            {editing.holders > 0 && roleId !== editing.roleId && (
              <p className="text-secondary text-status-warning-text">
                {editing.holders} {editing.holders === 1 ? "person" : "people"} with this designation will get {level?.label} access.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="tertiary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
