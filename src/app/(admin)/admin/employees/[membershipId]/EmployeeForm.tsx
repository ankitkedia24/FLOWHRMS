"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { saveEmployeeAction } from "@/lib/employees/actions";
import { describeWeekdays, WEEKDAYS } from "@/lib/attendance/calendar";
import { BLOOD_GROUPS } from "@/lib/employees/profile";
import type { EmployeeFormOptions } from "@/lib/employees/form-options";
import {
  InlineCreateSelect,
  NewDepartmentForm,
  NewLocationForm,
  NewShiftForm,
} from "@/components/employees/QuickCreate";

/**
 * Employee details (screen A5). This is where a person's home location,
 * shift and roaming capability are set — the settings multi-location
 * depends on.
 */
interface Member {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  employeeCode: string | null;
  departmentId: string | null;
  bloodGroup: string | null;
  joinedOn: string;
  branchId: string | null;
  shiftId: string | null;
  reportingToId: string | null;
  canCheckInAtAnyBranch: boolean;
  status: string;
  hasOwnWeeklyOff: boolean;
  weeklyOffDays: number[];
}

export function EmployeeForm({
  member,
  options,
  companyWeeklyOff,
  managers,
  canManage,
}: {
  member: Member;
  /** Departments, locations and shifts, and which of them may be added here. */
  options: EmployeeFormOptions;
  /** The company's weekly off days, for the "Company default" label. */
  companyWeeklyOff: number[];
  managers: Array<{ id: string; name: string }>;
  canManage: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(member);
  // Grows as departments, locations and shifts are added inline.
  const [opts, setOpts] = useState(options);
  const add = (list: "departments" | "branches" | "shifts") => (option: { value: string; label: string }) =>
    setOpts((o) => ({ ...o, [list]: [...o[list], option].sort((a, b) => a.label.localeCompare(b.label)) }));

  const set = <K extends keyof Member>(key: K, value: Member[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const invited = member.status === "INVITED";
  const ownOffAll = form.hasOwnWeeklyOff && form.weeklyOffDays.length >= 7;
  const roamingChanged =
    form.canCheckInAtAnyBranch !== member.canCheckInAtAnyBranch;
  const branchChanged = form.branchId !== member.branchId;

  return (
    <Card>
      <CardHeader
        title="Details"
        meta={
          canManage
            ? undefined
            : "You can see this record but not change it."
        }
      />

      <div className="grid gap-x-6 md:grid-cols-2">
        <Input
          label="Name"
          required
          disabled={!canManage}
          value={form.displayName}
          onChange={(e) => set("displayName", e.target.value)}
        />
        <Input
          label="Employee code"
          optional
          disabled={!canManage}
          value={form.employeeCode ?? ""}
          onChange={(e) => set("employeeCode", e.target.value)}
        />
        <InlineCreateSelect
          label="Department"
          optional
          disabled={!canManage}
          value={form.departmentId ?? ""}
          onChange={(v) => set("departmentId", v || null)}
          options={[{ value: "", label: "Not in a department" }, ...opts.departments]}
          createLabel="Add a new department"
          canCreate={opts.can.addDepartment}
          renderCreate={(done) => (
            <NewDepartmentForm
              onDone={(created) => {
                if (created) add("departments")(created);
                done(created);
              }}
            />
          )}
        />
        <Select
          label="Blood group"
          optional
          disabled={!canManage}
          value={form.bloodGroup ?? ""}
          onChange={(e) => set("bloodGroup", e.target.value || null)}
          options={[{ value: "", label: "Not given" }, ...BLOOD_GROUPS.map((g) => ({ value: g, label: g }))]}
          helper="Printed on the ID card."
        />
        <Input
          label="Joined on"
          type="date"
          optional
          disabled={!canManage}
          value={form.joinedOn}
          onChange={(e) => set("joinedOn", e.target.value)}
        />
        <Input
          label="Phone"
          readOnly
          value={form.phone ?? "Not set"}
          helper="Sign-in details are managed by the person's account."
        />
        <Input label="Email" readOnly value={form.email ?? "Not set"} />
      </div>

      <div className="mt-4 border-t border-border-subtle pt-4">
        <p className="micro-label mb-2 text-text-tertiary">Where they work</p>
        <div className="grid gap-x-6 md:grid-cols-2">
          <InlineCreateSelect
            label="Home location"
            disabled={!canManage}
            value={form.branchId ?? ""}
            onChange={(v) => set("branchId", v || null)}
            helper="Their usual place of work. Check-ins are matched to it."
            options={[{ value: "", label: "No location set" }, ...opts.branches]}
            createLabel="Add a new work location"
            canCreate={opts.can.addLocation}
            wide
            renderCreate={(done) => (
              <NewLocationForm
                defaultRadiusM={opts.defaultRadiusM}
                onDone={(created) => {
                  if (created) add("branches")(created);
                  done(created);
                }}
              />
            )}
          />
          <InlineCreateSelect
            label="Shift"
            disabled={!canManage}
            value={form.shiftId ?? ""}
            onChange={(v) => set("shiftId", v || null)}
            options={[{ value: "", label: opts.defaultShiftLabel }, ...opts.shifts]}
            createLabel="Add a new shift"
            canCreate={opts.can.addShift}
            renderCreate={(done) => (
              <NewShiftForm
                onDone={(created) => {
                  if (created) add("shifts")(created);
                  done(created);
                }}
              />
            )}
          />
          <Select
            label="Weekly off"
            disabled={!canManage}
            value={form.hasOwnWeeklyOff ? "OWN" : "COMPANY"}
            onChange={(e) => {
              const own = e.target.value === "OWN";
              set("hasOwnWeeklyOff", own);
              if (own && form.weeklyOffDays.length === 0) {
                set("weeklyOffDays", companyWeeklyOff);
              }
            }}
            options={[
              {
                value: "COMPANY",
                label: `Company default (${companyWeeklyOff.length ? describeWeekdays(companyWeeklyOff) : "no weekly off"})`,
              },
              { value: "OWN", label: "Their own days" },
            ]}
          />
          <Select
            label="Reports to"
            optional
            disabled={!canManage}
            value={form.reportingToId ?? ""}
            onChange={(e) => set("reportingToId", e.target.value || null)}
            options={[
              { value: "", label: "No manager set" },
              ...managers.map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
          <Select
            label="Status"
            disabled={!canManage}
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
            options={
              invited
                ? [
                    { value: "INVITED", label: "Invited — hasn't joined yet" },
                    { value: "DEACTIVATED", label: "Has left" },
                  ]
                : [
                    { value: "ACTIVE", label: "Active" },
                    { value: "SUSPENDED", label: "Suspended" },
                    { value: "DEACTIVATED", label: "Has left" },
                  ]
            }
          />
        </div>

        {form.hasOwnWeeklyOff && (
          <fieldset className="mt-3">
            <legend className="text-label text-text-primary">
              Their weekly off
            </legend>
            <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-4">
              {WEEKDAYS.map((name, day) => (
                <Checkbox
                  key={name}
                  label={name}
                  disabled={!canManage}
                  checked={form.weeklyOffDays.includes(day)}
                  onChange={(e) =>
                    set(
                      "weeklyOffDays",
                      e.target.checked
                        ? [...new Set([...form.weeklyOffDays, day])].sort()
                        : form.weeklyOffDays.filter((d) => d !== day),
                    )
                  }
                />
              ))}
            </div>
            <p className="mt-1 text-caption text-text-secondary">
              {ownOffAll
                ? "Leave them at least one working day in the week."
                : "Paid days off. Company holidays apply to them too."}
            </p>
          </fieldset>
        )}

        <div className="mt-3">
          <Checkbox
            checked={form.canCheckInAtAnyBranch}
            disabled={!canManage}
            onChange={(e) => set("canCheckInAtAnyBranch", e.target.checked)}
            label="Works across locations"
            helper="For delivery, field and relief staff. They can check in at any of your locations without it being sent for approval."
          />
        </div>
      </div>

      {/* Consequence before the action — say what a change does. */}
      {canManage && (roamingChanged || branchChanged) && (
        <div className="mt-4">
          <Alert
            variant="consequence"
            title={
              roamingChanged
                ? form.canCheckInAtAnyBranch
                  ? "They will be able to check in at any of your locations."
                  : "They will only be able to check in at their own location."
                : "Their check-ins will be matched to a different location."
            }
          >
            Attendance already recorded is not changed. This takes effect on
            their next check-in.
          </Alert>
        </div>
      )}

      {canManage && (
        <div className="mt-4">
          <Button
            loading={pending}
            disabled={!form.displayName.trim() || ownOffAll}
            disabledReason={
              !form.displayName.trim()
                ? "Give the person a name."
                : ownOffAll
                  ? "Leave them at least one working day in the week."
                  : undefined
            }
            onClick={() =>
              startTransition(async () => {
                const result = await saveEmployeeAction({
                  membershipId: form.id,
                  displayName: form.displayName.trim(),
                  employeeCode: form.employeeCode?.trim() || undefined,
                  departmentId: form.departmentId,
                  bloodGroup: (form.bloodGroup || null) as "A+" | null,
                  joinedOn: form.joinedOn || undefined,
                  branchId: form.branchId,
                  shiftId: form.shiftId,
                  reportingToId: form.reportingToId,
                  canCheckInAtAnyBranch: form.canCheckInAtAnyBranch,
                  status: form.status as
                    | "ACTIVE"
                    | "SUSPENDED"
                    | "DEACTIVATED"
                    | "INVITED",
                  hasOwnWeeklyOff: form.hasOwnWeeklyOff,
                  weeklyOffDays: form.weeklyOffDays,
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
      )}
    </Card>
  );
}
