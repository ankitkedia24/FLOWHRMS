import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { STATUS, statusLate, type Status } from "@/lib/status";
import { formatClockTime } from "@/lib/attendance/policy";
import { computeInviteStatus } from "@/lib/invites/policy";
import { EmployeeForm } from "./EmployeeForm";
import { loadWorkCalendar } from "@/lib/attendance/work-calendar";
import { loadEmployeeFormOptions } from "@/lib/employees/form-options";
import { mediaUrl } from "@/lib/media/urls";
import { PhotoCard } from "./PhotoCard";
import { DocumentsPanel } from "./DocumentsPanel";
import { SensitivePanel } from "./SensitivePanel";
import { InvitePanel } from "./InvitePanel";
import { DesignationPanel } from "./DesignationPanel";
import { SetSalaryCard } from "@/components/payroll/SetSalaryCard";
import { getPolicy } from "@/lib/policies";
import { resolvePayMode, type PaySetupPolicy } from "@/lib/payroll/simple";

/** "7 Aug 2026" in the tenant's timezone (copy-deck.md §1). */
function formatDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(at);
}

export const metadata: Metadata = { title: "Employee" };

const docStatus: Record<string, Status> = {
  PENDING_REVIEW: STATUS.needsReview,
  VERIFIED: STATUS.verified,
  REJECTED: STATUS.rejected,
};

/**
 * Employee profile (screen A5).
 *
 * Sensitive blocks (salary, bank) are never rendered inline — they need
 * the permission AND an explicit reveal, and revealing is audited
 * (Constitution §7).
 */
export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const { membershipId } = await params;
  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "employees.view",
  });
  if (!decision.allowed) redirect("/unauthorized");
  if (devFixtureOffline()) notFound();

  const db = getDb();
  const member = await db.tenantMembership.findFirst({
    where: { id: membershipId, tenantId: session.tenant.id },
    include: {
      user: true,
      role: true,
      branch: true,
      shift: true,
      reportingTo: { include: { user: true } },
      documents: { orderBy: { uploadedAt: "desc" } },
      invites: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!member) notFound();

  const latestInvite = member.invites[0];

  const canManage = session.permissions.has("employees.manage");

  // Designations (least access first, anything above the viewer marked),
  // departments, locations and shifts — and what may be added on the spot.
  const [formOptions, photoUrl] = await Promise.all([
    loadEmployeeFormOptions(session),
    mediaUrl(member.photoPath),
  ]);
  const canSeeDocuments = session.permissions.has("documents.view");
  const tz = session.tenant.timezone;

  // The salary card only renders for someone who could already edit
  // payroll, and only in the simple/pack setups where one number IS the
  // salary. Custom setups get a pointer to the Salaries page instead.
  const payrollAccess = await checkAccess({
    module: "PAYROLL",
    permission: "payroll.edit",
  });
  const canSetSalary = payrollAccess.decision.allowed;

  const workCalendar = await loadWorkCalendar(session.tenant.id);
  const [managers, recentAttendance, payPolicy, payComponents] = await Promise.all([
    db.tenantMembership.findMany({
      where: {
        tenantId: session.tenant.id,
        status: "ACTIVE",
        id: { not: member.id },
      },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    db.attendanceRecord.findMany({
      where: { tenantId: session.tenant.id, membershipId: member.id },
      include: { branch: true },
      orderBy: { workDate: "desc" },
      take: 10,
    }),
    canSetSalary
      ? getPolicy<PaySetupPolicy>(session.tenant.id, "pay_setup")
      : Promise.resolve(null),
    canSetSalary
      ? db.salaryComponent.findMany({
          where: { tenantId: session.tenant.id, isActive: true },
          select: { key: true, kind: true, calculation: true, prorated: true },
        })
      : Promise.resolve([]),
  ]);

  const payMode = resolvePayMode(payPolicy, payComponents);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/admin/employees"
          className="text-label text-brand-primary underline-offset-2 hover:underline"
        >
          ← All employees
        </Link>
        <h1 className="mt-2 font-heading text-h1 text-text-primary">
          {member.user.displayName}
        </h1>
        <p className="mt-1 text-secondary text-text-secondary">
          {member.designation ?? member.role.name}
          {member.branch && ` · ${member.branch.name}`}
        </p>
      </div>

      <InvitePanel
        membershipId={member.id}
        employeeName={member.user.displayName}
        email={member.user.email}
        inviteStatus={
          member.status === "DEACTIVATED"
            ? STATUS.inactive
            : member.status === "ACTIVE" && !latestInvite
              ? STATUS.active
              : computeInviteStatus(latestInvite ?? null, new Date())
        }
        sentAt={
          latestInvite?.sentAt
            ? formatDay(latestInvite.sentAt, tz)
            : null
        }
        expiresAt={
          latestInvite?.acceptedAt
            ? formatDay(latestInvite.acceptedAt, tz)
            : latestInvite
              ? formatDay(latestInvite.expiresAt, tz)
              : null
        }
        resendCount={latestInvite?.resendCount ?? 0}
        isDeactivated={member.status === "DEACTIVATED"}
        canManage={canManage}
      />

      <PhotoCard
        tenantId={session.tenant.id}
        membershipId={member.id}
        name={member.user.displayName}
        photoUrl={photoUrl}
        canManage={canManage}
      />

      <DesignationPanel
        membershipId={member.id}
        employeeName={member.user.displayName}
        currentDesignationId={member.designationId}
        currentDesignationName={member.designation}
        currentRoleId={member.roleId}
        currentRoleName={member.role.name}
        designations={formOptions.designations}
        accessLevels={formOptions.accessLevels}
        canManage={canManage}
        canCreate={formOptions.can.addDesignation}
        isSelf={member.userId === session.user.id}
      />

      <EmployeeForm
        canManage={canManage}
        member={{
          id: member.id,
          displayName: member.user.displayName,
          email: member.user.email,
          phone: member.user.phone,
          employeeCode: member.employeeCode,
          departmentId: member.departmentId,
          bloodGroup: member.bloodGroup,
          joinedOn: member.joinedOn
            ? member.joinedOn.toISOString().slice(0, 10)
            : "",
          branchId: member.branchId,
          shiftId: member.shiftId,
          reportingToId: member.reportingToId,
          canCheckInAtAnyBranch: member.canCheckInAtAnyBranch,
          status: member.status,
          hasOwnWeeklyOff: member.hasOwnWeeklyOff,
          weeklyOffDays: member.weeklyOffDays,
        }}
        options={formOptions}
        companyWeeklyOff={workCalendar.weeklyOffDays}
        managers={managers.map((m) => ({
          id: m.id,
          name: m.user.displayName,
        }))}
      />

      {canSetSalary && (
        <SetSalaryCard
          membershipId={member.id}
          employeeName={member.user.displayName}
          isCustomSetup={payMode.mode === "CUSTOM"}
        />
      )}

      <SensitivePanel
        membershipId={member.id}
        canSeeSalary={session.permissions.has("payroll.view")}
        canSeeBank={session.permissions.has("bank.view")}
      />

      {canSeeDocuments ? (
        <DocumentsPanel
          membershipId={member.id}
          canManage={canManage}
          canDownload={session.permissions.has("documents.download")}
          documents={member.documents.map((doc) => ({
            id: doc.id,
            kind: doc.kind,
            name: doc.name,
            sizeBytes: doc.sizeBytes,
            status: doc.status,
            reviewReason: doc.reviewReason,
            uploadedAt: new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: tz,
            }).format(doc.uploadedAt),
          }))}
        />
      ) : (
        <Card>
          <CardHeader title="Documents" />
          <p className="text-secondary text-text-secondary">
            You don&apos;t have access to employee documents. Ask your company
            owner if you need it.
          </p>
        </Card>
      )}

      <Card flush>
        <div className="p-5 pb-0">
          <CardHeader title="Recent attendance" meta="Last 10 days recorded" />
        </div>
        {recentAttendance.length === 0 ? (
          <EmptyState
            title="No records yet."
            body="Attendance appears here after their first check-in."
          />
        ) : (
          <ul className="flex flex-col p-5 pt-0">
            {recentAttendance.map((record) => {
              const statuses: Status[] = [];
              if (record.lateMinutes > 0)
                statuses.push(statusLate(record.lateMinutes));
              else if (record.checkInAt) statuses.push(STATUS.present);
              if (record.reviewStatus === "PENDING")
                statuses.push(STATUS.pendingReview);
              return (
                <li
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle py-2.5 last:border-0"
                >
                  <div>
                    <p className="font-mono text-data text-text-primary tabular-nums">
                      {new Intl.DateTimeFormat("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        timeZone: "UTC",
                      }).format(record.workDate)}
                      {" · "}
                      {record.checkInAt
                        ? formatClockTime(record.checkInAt, tz)
                        : "—"}
                      {" – "}
                      {record.checkOutAt
                        ? formatClockTime(record.checkOutAt, tz)
                        : "—"}
                    </p>
                    {record.branch && (
                      <p className="text-caption text-text-secondary">
                        {record.branch.name}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {statuses.map((status) => (
                      <StatusChip key={status.key} status={status} size="sm" />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
