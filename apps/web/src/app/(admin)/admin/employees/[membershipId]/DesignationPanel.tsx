"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { InlineCreateSelect, NewDesignationForm } from "@/components/employees/QuickCreate";
import { changeEmployeeDesignationAction } from "@/lib/employees/actions";
import type { AccessLevelOption, DesignationOption } from "@/lib/employees/form-options";

/**
 * Someone's designation — their job title, which also decides what they
 * can see and do in the app.
 *
 * Its own card rather than a field in the profile form, because it can
 * change what a person can SEE. When the new designation carries different
 * access, that consequence is shown before the button and again in the
 * confirmation, with a reason for the record. A new title with the same
 * access just saves.
 */
export function DesignationPanel({
  membershipId,
  employeeName,
  currentDesignationId,
  currentDesignationName,
  currentRoleId,
  currentRoleName,
  designations: initial,
  accessLevels,
  canManage,
  canCreate,
  isSelf,
}: {
  membershipId: string;
  employeeName: string;
  currentDesignationId: string | null;
  currentDesignationName: string | null;
  currentRoleId: string;
  currentRoleName: string;
  designations: DesignationOption[];
  accessLevels: AccessLevelOption[];
  canManage: boolean;
  canCreate: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [designations, setDesignations] = useState(initial);
  const [designationId, setDesignationId] = useState(currentDesignationId ?? "");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = designations.find((d) => d.value === designationId);
  const changed = designationId !== (currentDesignationId ?? "") && designationId !== "";
  const accessChanges = Boolean(selected && selected.roleId !== currentRoleId);
  const firstName = employeeName.trim().split(/\s+/)[0];

  function save() {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const result = await changeEmployeeDesignationAction({
        membershipId,
        designationId,
        reason: reason || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        setDesignationId(currentDesignationId ?? "");
        return;
      }
      toast.show({ variant: "success", message: [result.message, result.detail].filter(Boolean).join(" ") });
      setReason("");
      router.refresh();
    });
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-text-secondary" />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-h3 text-text-primary">Designation and access</h2>
          <p className="mt-1 text-secondary text-text-secondary">
            {currentDesignationName ? (
              <>
                <strong className="text-text-primary">{currentDesignationName}</strong>, with {currentRoleName} access.
              </>
            ) : (
              <>
                No designation yet — {currentRoleName} access.
              </>
            )}
          </p>

          {!canManage ? (
            <p className="mt-4 text-secondary text-text-tertiary">You don&apos;t have permission to change this.</p>
          ) : (
            <>
              {error && (
                <div className="mt-4">
                  <Alert variant="error" title="That didn't work">
                    {error}
                  </Alert>
                </div>
              )}

              <div className="mt-4">
                <InlineCreateSelect
                  label="Designation"
                  required
                  placeholder="Choose a designation"
                  options={designations.map((d) => ({
                    value: d.value,
                    // Your own access can't change; titles with the same access still can.
                    label: d.aboveYou
                      ? `${d.label} — above your access`
                      : isSelf && d.roleId !== currentRoleId
                        ? `${d.label} — changes your own access`
                        : d.label,
                    disabled: d.aboveYou || (isSelf && d.roleId !== currentRoleId),
                  }))}
                  value={designationId}
                  onChange={(v) => {
                    setError(null);
                    setDesignationId(v);
                  }}
                  helper={selected ? `${selected.roleName} access: ${selected.consequence}` : undefined}
                  createLabel="Add a new designation"
                  canCreate={canCreate}
                  renderCreate={(done) => (
                    <NewDesignationForm
                      accessLevels={accessLevels}
                      onDone={(created) => {
                        if (created) {
                          const level = accessLevels.find((a) => a.value === created.roleId);
                          setDesignations((list) => [
                            ...list,
                            {
                              value: created.value,
                              label: created.label,
                              roleId: created.roleId,
                              roleName: level?.label ?? "",
                              consequence: level?.consequence ?? "",
                              aboveYou: false,
                            },
                          ]);
                        }
                        done(created);
                      }}
                    />
                  )}
                />
              </div>

              {changed && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    loading={pending}
                    onClick={() => (accessChanges ? setConfirming(true) : save())}
                    aria-label={`Make ${firstName} ${selected?.label}.${accessChanges ? ` ${selected?.consequence ?? ""}` : ""}`}
                  >
                    {accessChanges ? "Change designation and access" : "Save designation"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDesignationId(currentDesignationId ?? "");
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Make ${firstName} ${selected?.label}?`}
      >
        <p className="text-body text-text-secondary">
          This changes their access from {currentRoleName} to {selected?.roleName}. {selected?.consequence}
        </p>
        <p className="mt-3 text-secondary text-text-tertiary">
          It takes effect the next time they load a page. Their attendance, leave and payslips are unchanged.
        </p>
        <div className="mt-4">
          <TextArea
            label="Why"
            optional
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            helper="Kept on the activity log next to who made the change."
          />
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirming(false)}>
            Keep {currentDesignationName ?? currentRoleName}
          </Button>
          <Button loading={pending} onClick={save}>
            Change designation
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
