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
import { inviteEmployeeAction } from "@/lib/invites/actions";
import { describeSignInReadiness } from "@/lib/invites/policy";

/**
 * Add an employee (screen A4 → "Add employee").
 *
 * Mobile-first: an owner adds their first people from a phone, often while
 * standing next to the person. So the fields are ordered the way the
 * conversation goes — name, number, then the paperwork — and only three
 * are required.
 *
 * The consequence of pressing the button is stated above it and changes
 * live as the email field changes (integrity pattern 1): with an email
 * they get an invitation, without one they get a record and no sign-in.
 * Nobody should have to press it to find out which.
 */

export interface Option {
  value: string;
  label: string;
  /** For roles: one line on what this grants, shown under the picker. */
  consequence?: string;
}

const EMPLOYMENT_TYPES: Option[] = [
  { value: "FULL_TIME", label: "Full time" },
  { value: "PART_TIME", label: "Part time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "TEMPORARY", label: "Temporary" },
  { value: "APPRENTICE", label: "Apprentice" },
];

export function InviteEmployeeForm({
  roles,
  departments,
  managers,
  branches,
  shifts,
  defaultShiftLabel,
  emailConfigured,
}: {
  roles: Option[];
  departments: Option[];
  managers: Option[];
  branches: Option[];
  shifts: Option[];
  /** What "no shift of their own" means, e.g. "Company default (Shop shift, 10:00–20:00)". */
  defaultShiftLabel: string;
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    displayName: "",
    mobile: "",
    email: "",
    employeeCode: "",
    departmentId: "",
    designation: "",
    reportingToId: "",
    joinedOn: "",
    employmentType: "FULL_TIME",
    roleId: roles[0]?.value ?? "",
    branchId: "",
    shiftId: "",
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const readiness = describeSignInReadiness(form.email);
  const name = form.displayName.trim() || "This person";

  // The sentence the button is accountable for. Also the button's
  // accessible name, so it is not a visual-only promise.
  const consequence = readiness.canInvite
    ? emailConfigured
      ? `${name} will get an email at ${form.email.trim()} to set their own password.`
      : `${name} will be added. Email isn't set up, so you'll get a link to send them yourself.`
    : `${name} will be added without a sign-in. You can add an email later.`;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLink(null);
    startTransition(async () => {
      const result = await inviteEmployeeAction({
        displayName: form.displayName,
        mobile: form.mobile,
        email: form.email || undefined,
        employeeCode: form.employeeCode || undefined,
        departmentId: form.departmentId || null,
        designation: form.designation || undefined,
        reportingToId: form.reportingToId || null,
        joinedOn: form.joinedOn || undefined,
        employmentType: form.employmentType as "FULL_TIME",
        roleId: form.roleId,
        branchId: form.branchId || null,
        shiftId: form.shiftId || null,
      });

      if (!result.ok) {
        setError(result.error);
        if (result.inviteLink) setLink(result.inviteLink);
        return;
      }

      toast.show({
        variant: "success",
        message: result.detail
          ? `${result.message} ${result.detail}`
          : result.message,
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
        <h2 className="font-heading text-h3 text-text-primary">
          {form.displayName.trim()} is on your team
        </h2>
        <p className="mt-2 text-body text-text-secondary">
          Send them this link so they can set a password. It works for 7 days,
          once.
        </p>
        <CopyLink link={link} copied={copied} onCopied={() => setCopied(true)} />
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => router.push("/admin/employees")}>
            Done
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setLink(null);
              setCopied(false);
              setForm((f) => ({
                ...f,
                displayName: "",
                mobile: "",
                email: "",
                employeeCode: "",
                designation: "",
              }));
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
          {link && (
            <CopyLink link={link} copied={copied} onCopied={() => setCopied(true)} />
          )}
        </Alert>
      )}

      <Card>
        <h2 className="font-heading text-h3 text-text-primary">Who they are</h2>
        <div className="mt-4 flex flex-col gap-4">
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
        </div>
      </Card>

      <Card>
        <h2 className="font-heading text-h3 text-text-primary">Their job</h2>
        <div className="mt-4 flex flex-col gap-4">
          <Input
            label="Employee ID"
            optional
            value={form.employeeCode}
            onChange={(e) => set("employeeCode")(e.target.value)}
            placeholder="STF001"
            helper="Your own numbering, if you use one. Must be unique in your company."
          />
          <Select
            label="Department"
            optional
            options={departments}
            placeholder={
              departments.length === 0
                ? "No departments yet — add them in Settings"
                : "Not in a department"
            }
            value={form.departmentId}
            onChange={(e) => set("departmentId")(e.target.value)}
            helper="The department head sees this person's approvals alongside you."
          />
          <Input
            label="Designation"
            optional
            value={form.designation}
            onChange={(e) => set("designation")(e.target.value)}
            placeholder="Dispatch supervisor"
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
        <h2 className="font-heading text-h3 text-text-primary">
          Access and attendance
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <Select
            label="Role"
            required
            options={roles}
            value={form.roleId}
            onChange={(e) => set("roleId")(e.target.value)}
            helper={
              roles.find((r) => r.value === form.roleId)?.consequence ??
              "Decides what they can see and do."
            }
          />
          <Select
            label="Work location"
            optional
            options={branches}
            placeholder="No location set"
            value={form.branchId}
            onChange={(e) => set("branchId")(e.target.value)}
            helper="Where they check in. Without one, their location isn't checked."
          />
          <Select
            label="Shift"
            optional
            options={shifts}
            placeholder={defaultShiftLabel}
            value={form.shiftId}
            onChange={(e) => set("shiftId")(e.target.value)}
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

function CopyLink({
  link,
  copied,
  onCopied,
}: {
  link: string;
  copied: boolean;
  onCopied: () => void;
}) {
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
