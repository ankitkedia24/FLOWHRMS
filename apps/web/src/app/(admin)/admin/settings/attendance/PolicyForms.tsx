"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  makeDefaultShiftAction,
  saveAttendancePolicyAction,
  savePayrollPolicyAction,
  saveShiftAction,
} from "@/lib/policies/actions";
import { StatusChip } from "@/components/ui/StatusChip";
import { BUILT_IN_SHIFT, formatShiftRange } from "@/lib/attendance/shifts";

/**
 * Policy editors. Each states the effect of its rule in plain words so an
 * owner can see what a change does before saving it.
 */
interface Shift {
  id: string;
  name: string;
  startMinutes: number;
  endMinutes: number;
  graceMinutes: number;
  isDefault: boolean;
  /** People assigned to this shift directly (not via the default). */
  assignedCount: number;
}

function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function PolicyForms({
  attendance,
  attendanceVersion,
  locationsUsingDefault,
  locationsWithOwnRadius,
  payroll,
  payrollVersion,
  shifts,
}: {
  attendance: {
    graceMinutes: number;
    radiusM: number;
    requireReasonOutsideArea: boolean;
  };
  attendanceVersion: number;
  locationsUsingDefault: number;
  locationsWithOwnRadius: number;
  payroll: { latesPerDeductedDay: number; deductAbsentDays: boolean };
  payrollVersion: number;
  shifts: Shift[];
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();

  const [grace, setGrace] = useState(String(attendance.graceMinutes));
  const [radius, setRadius] = useState(String(attendance.radiusM));
  const [requireReason, setRequireReason] = useState(
    attendance.requireReasonOutsideArea,
  );

  const [lates, setLates] = useState(String(payroll.latesPerDeductedDay));
  const [deductAbsent, setDeductAbsent] = useState(payroll.deductAbsentDays);

  const [shiftDraft, setShiftDraft] = useState<Shift | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title="Attendance"
          meta={`Version ${attendanceVersion}`}
        />
        <div className="flex flex-col gap-1">
          <Input
            label="Grace period"
            type="number"
            inputMode="numeric"
            min={0}
            suffix="minutes"
            helper={`Arriving up to ${grace || 0} minutes after the shift starts is not late. Exactly ${grace || 0} minutes is not late.`}
            value={grace}
            onChange={(e) => setGrace(e.target.value)}
          />
          <Input
            label="Permitted area radius"
            type="number"
            inputMode="numeric"
            min={50}
            suffix="metres"
            helper={
              locationsWithOwnRadius > 0
                ? `Checking in beyond this distance becomes an exception for approval. ${locationsUsingDefault} location${locationsUsingDefault === 1 ? "" : "s"} use this radius; ${locationsWithOwnRadius} set their own and will not change.`
                : "Checking in beyond this distance from a location becomes an exception for approval. Any location can set its own radius instead."
            }
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
          />
          <div className="mt-2">
            <Checkbox
              checked={requireReason}
              onChange={(e) => setRequireReason(e.target.checked)}
              label="Require a reason when checking in outside the permitted area"
              helper="Employees can always check in; the reason goes to their manager."
            />
          </div>
        </div>
        <div className="mt-4">
          <Button
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await saveAttendancePolicyAction({
                  graceMinutes: Number(grace || 0),
                  radiusM: Number(radius || 300),
                  requireReasonOutsideArea: requireReason,
                });
                if (result.ok) {
                  show({ variant: "success", message: result.message });
                  router.refresh();
                } else {
                  show({ variant: "error", message: result.error });
                }
              })
            }
          >
            Save changes
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="How attendance affects pay"
          meta={`Version ${payrollVersion}`}
        />
        <Alert variant="consequence" title="This rule changes what people are paid.">
          Approved payroll periods keep the version they were calculated
          with — saving here affects future calculations only.
        </Alert>
        <div className="mt-3 flex flex-col gap-1">
          <Input
            label="Late arrivals that equal one unpaid day"
            type="number"
            inputMode="numeric"
            min={0}
            helper={
              Number(lates) > 0
                ? `Every ${lates} late arrivals in a month deduct one day's pay.`
                : "Lateness never reduces pay."
            }
            value={lates}
            onChange={(e) => setLates(e.target.value)}
          />
          <div className="mt-2">
            <Checkbox
              checked={deductAbsent}
              onChange={(e) => setDeductAbsent(e.target.checked)}
              label="Missed working days reduce pay"
              helper="A working day with no check-in and no approved leave. Weekly offs and holidays are never counted."
            />
          </div>
        </div>
        <div className="mt-4">
          <Button
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await savePayrollPolicyAction({
                  latesPerDeductedDay: Number(lates || 0),
                  deductAbsentDays: deductAbsent,
                });
                if (result.ok) {
                  show({ variant: "success", message: result.message });
                  router.refresh();
                } else {
                  show({ variant: "error", message: result.error });
                }
              })
            }
          >
            Save changes
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Shifts"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setShiftDraft({
                  id: "",
                  name: "",
                  startMinutes: 9 * 60 + 30,
                  endMinutes: 18 * 60 + 30,
                  graceMinutes: Number(grace || 10),
                  isDefault: false,
                  assignedCount: 0,
                })
              }
            >
              Add shift
            </Button>
          }
        />
        <p className="text-secondary text-text-secondary">
          {shifts.some((s) => s.isDefault)
            ? "Everyone without a shift of their own works the default shift. Set a person's own shift on their employee record."
            : shifts.length === 0
              ? `Until you add a shift, everyone works ${formatShiftRange(BUILT_IN_SHIFT.startMinutes, BUILT_IN_SHIFT.endMinutes)}. The first shift you add becomes the company default.`
              : `No shift is the default yet, so everyone without their own shift works ${formatShiftRange(BUILT_IN_SHIFT.startMinutes, BUILT_IN_SHIFT.endMinutes)}. Make one the default.`}
        </p>
        <ul className="mt-2 flex flex-col">
          {shifts.map((shift) => (
            <li
              key={shift.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle py-2.5 last:border-0"
            >
              <div>
                <p className="flex flex-wrap items-center gap-2 text-body font-semibold text-text-primary">
                  {shift.name}
                  {shift.isDefault && (
                    <StatusChip
                      status={{ key: "shift-default", label: "Company default", tone: "info" }}
                      size="sm"
                    />
                  )}
                </p>
                <p className="font-mono text-data text-text-secondary tabular-nums">
                  {toTime(shift.startMinutes)} – {toTime(shift.endMinutes)} ·
                  grace {shift.graceMinutes} min
                  {shift.assignedCount > 0
                    ? ` · ${shift.assignedCount} assigned`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!shift.isDefault && (
                  <Button
                    size="sm"
                    variant="tertiary"
                    loading={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await makeDefaultShiftAction({
                          shiftId: shift.id,
                        });
                        if (result.ok) {
                          show({
                            variant: "success",
                            message: result.detail
                              ? `${result.message} ${result.detail}`
                              : result.message,
                          });
                          router.refresh();
                        } else {
                          show({ variant: "error", message: result.error });
                        }
                      })
                    }
                  >
                    Make default
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShiftDraft(shift)}
                >
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {shiftDraft && (
          <div className="mt-4 border-t border-border-subtle pt-4">
            <div className="flex flex-col gap-1">
              <Input
                label="Shift name"
                required
                value={shiftDraft.name}
                onChange={(e) =>
                  setShiftDraft({ ...shiftDraft, name: e.target.value })
                }
              />
              <Input
                label="Starts"
                type="time"
                value={toTime(shiftDraft.startMinutes)}
                onChange={(e) =>
                  setShiftDraft({
                    ...shiftDraft,
                    startMinutes: toMinutes(e.target.value),
                  })
                }
              />
              <Input
                label="Ends"
                type="time"
                value={toTime(shiftDraft.endMinutes)}
                onChange={(e) =>
                  setShiftDraft({
                    ...shiftDraft,
                    endMinutes: toMinutes(e.target.value),
                  })
                }
              />
              <Input
                label="Grace"
                type="number"
                inputMode="numeric"
                suffix="minutes"
                value={String(shiftDraft.graceMinutes)}
                onChange={(e) =>
                  setShiftDraft({
                    ...shiftDraft,
                    graceMinutes: Number(e.target.value || 0),
                  })
                }
              />
            </div>
            <div className="mt-3 flex flex-col gap-2 md:flex-row">
              <Button
                loading={pending}
                disabled={!shiftDraft.name.trim()}
                disabledReason={
                  !shiftDraft.name.trim() ? "Name the shift." : undefined
                }
                onClick={() =>
                  startTransition(async () => {
                    const result = await saveShiftAction({
                      shiftId: shiftDraft.id || undefined,
                      name: shiftDraft.name.trim(),
                      startMinutes: shiftDraft.startMinutes,
                      endMinutes: shiftDraft.endMinutes,
                      graceMinutes: shiftDraft.graceMinutes,
                    });
                    if (result.ok) {
                      show({ variant: "success", message: result.message });
                      setShiftDraft(null);
                      router.refresh();
                    } else {
                      show({ variant: "error", message: result.error });
                    }
                  })
                }
              >
                Save shift
              </Button>
              <Button variant="outline" onClick={() => setShiftDraft(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
