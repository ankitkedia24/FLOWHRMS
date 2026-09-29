"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { STATUS } from "@/lib/status";
import {
  deactivateDepartmentAction,
  saveDepartmentAction,
} from "@/lib/departments/actions";

export interface DepartmentRow {
  id: string;
  name: string;
  headId: string | null;
  headName: string | null;
  memberCount: number;
  isActive: boolean;
  /** Set when the head cannot approve anything — shown, not hidden. */
  headGap: string | null;
}

/**
 * Departments and their heads.
 *
 * The head-gap warning is the point of this screen: naming a head who
 * cannot approve anything looks like delegation and is not, and an owner
 * would otherwise only discover it by noticing approvals never reach them.
 */
export function DepartmentsPanel({
  departments,
  people,
  canManage,
}: {
  departments: DepartmentRow[];
  people: Array<{ value: string; label: string }>;
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [headId, setHeadId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function open(row?: DepartmentRow) {
    setError(null);
    setEditing(row?.id ?? "new");
    setName(row?.name ?? "");
    setHeadId(row?.headId ?? "");
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveDepartmentAction({
        id: editing === "new" ? undefined : (editing ?? undefined),
        name,
        headId: headId || null,
        isActive: true,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.show({
        variant: result.detail ? "info" : "success",
        message: result.detail ? `${result.message} ${result.detail}` : result.message,
      });
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-h3 text-text-primary">Departments</h2>
          <p className="mt-1 text-secondary text-text-secondary">
            A department head sees their team&apos;s approvals alongside you.
            This is about who decides, not where people work — locations are
            separate.
          </p>
        </div>
        {canManage && editing === null && (
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Plus aria-hidden="true" />}
            onClick={() => open()}
          >
            Add department
          </Button>
        )}
      </div>

      {editing !== null && (
        <div className="mt-5 rounded-surface-card border border-border-default bg-surface-sunken p-4">
          {error && (
            <div className="mb-4">
              <Alert variant="error" title="That didn't save">
                {error}
              </Alert>
            </div>
          )}
          <div className="flex flex-col gap-4">
            <Input
              label="Department name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Dispatch"
            />
            <Select
              label="Head of department"
              optional
              options={people}
              placeholder="No head — approvals go to admins"
              value={headId}
              onChange={(event) => setHeadId(event.target.value)}
              helper="They'll be asked to decide on their team's leave, attendance and task proof."
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              loading={pending}
              disabled={name.trim().length === 0}
              disabledReason={
                name.trim().length === 0 ? "Give it a name first." : undefined
              }
              onClick={save}
            >
              Save
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="mt-5">
        {departments.length === 0 ? (
          <EmptyState
            title="No departments yet."
            body="You don't need them. Add them when you want a team's approvals to reach their head as well as you."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {departments.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 border-t border-border-subtle pt-3 first:border-0 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="text-body font-semibold text-text-primary">
                    {row.name}
                  </p>
                  <p className="text-secondary text-text-secondary">
                    {row.headName ? `Head: ${row.headName}` : "No head"} ·{" "}
                    {row.memberCount}{" "}
                    {row.memberCount === 1 ? "person" : "people"}
                  </p>
                  {row.headGap && (
                    <p className="mt-1 text-caption text-status-warning-text">
                      {row.headGap}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip
                    status={row.isActive ? STATUS.active : STATUS.inactive}
                    size="sm"
                  />
                  {canManage && row.isActive && (
                    <>
                      <Button variant="tertiary" size="sm" onClick={() => open(row)}>
                        Edit
                      </Button>
                      <Button
                        variant="tertiary"
                        size="sm"
                        loading={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await deactivateDepartmentAction({
                              id: row.id,
                            });
                            toast.show({
                              variant: result.ok ? "success" : "error",
                              message: result.ok
                                ? `${result.message} ${result.detail ?? ""}`.trim()
                                : result.error,
                            });
                            router.refresh();
                          })
                        }
                      >
                        Switch off
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
