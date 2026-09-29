"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { PhotoPicker } from "@/components/employees/PhotoPicker";
import {
  InlineCreateSelect,
  NewDepartmentForm,
  NewDesignationForm,
  NewLocationForm,
  NewShiftForm,
} from "@/components/employees/QuickCreate";
import { inviteEmployeeAction } from "@/lib/invites/actions";
import { describeSignInReadiness } from "@/lib/invites/policy";
import { BLOOD_GROUPS } from "@/lib/employees/profile";
import type { EmployeeFormOptions } from "@/lib/employees/form-options";

/**
 * Add an employee (screen A4 → "Add employee").
 *
 * Mobile-first: an owner adds their first people from a phone, often while
 * standing next to the person. So the fields are ordered the way the
 * conversation goes — name, number, then the paperwork — and only three
 * are required: name, mobile and designation.
 *
 * Nothing here sends the owner away. A department, designation, location
 * or shift that doesn't exist yet is added from the dropdown itself and
 * selected straight away.
 *
 * The consequence of pressing the button is stated above it and changes
 * live as the email field changes (integrity pattern 1): with an email
 * they get an invitation, without one they get a record and no sign-in.
 */

const EMPLOYMENT_TYPES = [
  { value: "FULL_TIME", label: "Full time" },
  { value: "PART_TIME", label: "Part time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "TEMPORARY", label: "Temporary" },
  { value: "APPRENTICE", label: "Apprentice" },
];

export function InviteEmployeeForm({
  tenantId,
  options: initial,
  managers,
  emailConfigured,
}: {
  tenantId: string;
  options: EmployeeFormOptions;
  managers: Array<{ value: string; label: string }>;
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Grows as the admin adds departments, designations, locations and shifts inline.
  const [opts, setOpts] = useState(initial);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState(0);

  const [form, setForm] = useState({
    displayName: "",
    mobile: "",
    email: "",
    employeeCode: "",
    departmentId: "",
    designationId: "",
    reportingToId: "",
    joinedOn: "",
    employmentType: "FULL_TIME",
    bloodGroup: "",
    branchId: "",
    shiftId: "",
  });

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const add = (list: "departments" | "branches" | "shifts") => (option: { value: string; label: string }) =>
    setOpts((o) => ({ ...o, [list]: [...o[list], option].sort((a, b) => a.label.localeCompare(b.label)) }));

  const readiness = describeSignInReadiness(form.email);
  const name = form.displayName.trim() || "This person";
  const designation = opts.designations.find((d) => d.value === form.designationId);

  const consequence = readiness.canInvite
    ? emailConfigured
      ? `${name} will get an email at ${form.email.trim()} to set their own password.`
      : `${name} will be added. Email isn't set up, so you'll get a link to send them yourself.`
    : `${name} will be added without a sign-in. You can add an email later.`;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLink(null);
    if (!form.designationId) {
      setError("Choose a designation — it decides what they can see in the app.");
      return;
    }
    startTransition(async () => {
      const result = await inviteEmployeeAction({
        displayName: form.displayName,
        mobile: form.mobile,
        email: form.email || undefined,
        employeeCode: form.employeeCode || undefined,
        departmentId: form.departmentId || null,
        reportingToId: form.reportingToId || null,
        joinedOn: form.joinedOn || undefined,
        employmentType: form.employmentType as "FULL_TIME",
        designationId: form.designationId,
        branchId: form.branchId || null,
        shiftId: form.shiftId || null,
        photoPath,
        bloodGroup: (form.bloodGroup || null) as "A+" | null,
      });

      if (!result.ok) {
        setError(result.error);
        if (result.inviteLink) setLink(result.inviteLink);
        return;
      }

      toast.show({
        variant: "success",
        message: result.detail ? `${result.message} ${result.detail}` : result.message,
      });
      if (result.inviteLink && !emailConfigured) {
        setLink(result.inviteLink);
        setError(null);
      } else {
        router.push("/admin/employees");
      }
    });
  }

  if (link && !error) {
    return (
      <Card>
        <h2 className="font-heading text-h3 text-text-primary">{form.displayName.trim()} is on your team</h2>
        <p className="mt-2 text-body text-text-secondary">
          Send them this link so they can set a password. It works for 7 days, once.
        </p>
        <CopyLink link={link} copied={copied} onCopied={() => setCopied(true)} />
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => router.push("/admin/employees")}>Done</Button>
          <Button
            variant="outline"
            onClick={() => {
              setLink(null);
              setCopied(false);
              setPhotoPath(null);
              setPhotoKey((k) => k + 1);
              setForm((f) => ({ ...f, displayName: "", mobile: "", email: "", employeeCode: "", bloodGroup: "" }));
            }}
          >
            Add another
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {error && (
        <Alert variant="error" title="That didn't save">
          {error}
          {link && <CopyLink link={link} copied={copied} onCopied={() => setCopied(true)} />}
        </Alert>
      )}

      <Card>
        <h2 className="font-heading text-h3 text-text-primary">Who they are</h2>
        <div className="mt-4 flex flex-col gap-4">
          <PhotoPicker key={photoKey} tenantId={tenantId} name={form.displayName} initialUrl={null} onChange={setPhotoPath} />
          <Input
            label="Full name"
            required
            autoComplete="name"
            value={form.displayName}
            onChange={(e) => set("displayName")(e.target.value)}
            placeholder="Ravi Kumar"
          />
          <Input
            label="Mobile number"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.mobile}
            onChange={(e) => set("mobile")(e.target.value)}
            placeholder="98765 43210"
            helper="How you'll reach them. Used to find them in search."
          />
          <Input
            label="Email"
            optional
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
            placeholder="ravi@company.example"
            helper={readiness.note}
          />
          <Select
            label="Blood group"
            optional
            options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))}
            placeholder="Not given"
            value={form.bloodGroup}
            onChange={(e) => set("bloodGroup")(e.target.value)}
            helper="Printed on the ID card, for emergencies."
          />
        </div>
      </Card>

      <Card>
        <h2 className="font-heading text-h3 text-text-primary">Their job</h2>
        <div className="mt-4 flex flex-col gap-4">
          <InlineCreateSelect
            label="Designation"
            required
            options={opts.designations.map((d) => ({
              value: d.value,
              label: d.aboveYou ? `${d.label} — above your access` : d.label,
              disabled: d.aboveYou,
            }))}
            placeholder="Choose a designation"
            value={form.designationId}
            onChange={set("designationId")}
            helper={
              designation
                ? `${designation.roleName} access: ${designation.consequence}`
                : "Their job title. It also decides what they can see in the app."
            }
            createLabel="Add a new designation"
            canCreate={opts.can.addDesignation}
            renderCreate={(done) => (
              <NewDesignationForm
                accessLevels={opts.accessLevels}
                onDone={(created) => {
                  if (created) {
                    const level = opts.accessLevels.find((a) => a.value === created.roleId);
                    setOpts((o) => ({
                      ...o,
                      designations: [
                        ...o.designations,
                        {
                          value: created.value,
                          label: created.label,
                          roleId: created.roleId,
                          roleName: level?.label ?? "",
                          consequence: level?.consequence ?? "",
                          aboveYou: false,
                        },
                      ],
                    }));
                  }
                  done(created);
                }}
              />
            )}
          />
          <InlineCreateSelect
            label="Department"
            optional
            options={opts.departments}
            placeholder={opts.departments.length === 0 ? "No departments yet" : "Not in a department"}
            value={form.departmentId}
            onChange={set("departmentId")}
            helper="The department head sees this person's approvals alongside you."
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
          <Input
            label="Employee ID"
            optional
            value={form.employeeCode}
            onChange={(e) => set("employeeCode")(e.target.value)}
            placeholder="STF001"
            helper="Your own numbering, if you use one. Must be unique in your company."
          />
          <Select
            label="Reporting manager"
            optional
            options={managers}
            placeholder="No manager"
            value={form.reportingToId}
            onChange={(e) => set("reportingToId")(e.target.value)}
          />
          <Input
            label="Joining date"
            optional
            type="date"
            value={form.joinedOn}
            onChange={(e) => set("joinedOn")(e.target.value)}
          />
          <Select
            label="Employment type"
            required
            options={EMPLOYMENT_TYPES}
            value={form.employmentType}
            onChange={(e) => set("employmentType")(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <h2 className="font-heading text-h3 text-text-primary">Attendance</h2>
        <div className="mt-4 flex flex-col gap-4">
          <InlineCreateSelect
            label="Work location"
            optional
            options={opts.branches}
            placeholder={opts.branches.length === 0 ? "No locations yet" : "No location set"}
            value={form.branchId}
            onChange={set("branchId")}
            helper="Where they check in. Without one, their location isn't checked."
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
            optional
            options={opts.shifts}
            placeholder={opts.defaultShiftLabel}
            value={form.shiftId}
            onChange={set("shiftId")}
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
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-5 border-t border-border-default bg-surface-default px-5 py-4 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0">
        <p className="mb-3 text-secondary text-text-secondary" aria-live="polite">
          {consequence}
        </p>
        <Button
          type="submit"
          size="xl"
          loading={pending}
          leadingIcon={<UserPlus aria-hidden="true" />}
          aria-label={`Add employee. ${consequence}`}
          className="lg:w-auto"
        >
          {pending ? "Adding…" : "Add employee"}
        </Button>
      </div>
    </form>
  );
}

function CopyLink({ link, copied, onCopied }: { link: string; copied: boolean; onCopied: () => void }) {
  return (
    <div className="mt-4">
      <p className="break-all rounded-surface-card border border-border-default bg-surface-sunken px-4 py-3 font-mono text-mono text-text-secondary">
        {link}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        leadingIcon={copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        onClick={() => {
          void navigator.clipboard.writeText(link).then(onCopied);
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
