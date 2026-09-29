import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { STATUS, type Status } from "@/lib/status";
import { computeInviteStatus, invitationsHeld } from "@/lib/invites/policy";
import { BranchFilter } from "@/components/filters/BranchFilter";
import {
  branchName,
  loadBranchOptions,
  resolveBranchFilter,
} from "@/lib/branches/scope";
import { EmployeeSearch } from "./EmployeeSearch";

export const metadata: Metadata = { title: "Employees" };

const membershipStatus: Record<string, Status> = {
  ACTIVE: STATUS.active,
  INVITED: { key: "invited", label: "Invited", tone: "info" },
  SUSPENDED: { key: "suspended", label: "Suspended", tone: "warning" },
  DEACTIVATED: STATUS.inactive,
};

/**
 * Employee directory (screen A4).
 *
 * Search covers name AND phone number — the spec is explicit that SME
 * admins look people up by phone (component-specifications.md §4).
 */
export default async function AdminEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; branch?: string; status?: string }>;
}) {
  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "employees.view",
  });
  if (!decision.allowed) redirect("/unauthorized");

  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const showInactive = params.status === "all";
  // Pending invitations are people the owner just added — hiding them made
  // a new employee vanish from the list the moment they were saved. Only
  // people who have left are hidden by default.
  const statusWhere = showInactive
    ? {}
    : { status: { not: "DEACTIVATED" as const } };

  const branchOptions = await loadBranchOptions(session.tenant.id);
  const branchFilter = resolveBranchFilter(
    params.branch,
    new Set(branchOptions.map((b) => b.id)),
  );
  const selectedBranchName = branchName(branchFilter, branchOptions);

  const members = devFixtureOffline()
    ? []
    : await getDb().tenantMembership.findMany({
        where: {
          tenantId: session.tenant.id,
          ...statusWhere,
          ...(branchFilter ? { branchId: branchFilter } : {}),
          ...(query.length >= 2
            ? {
                OR: [
                  { user: { displayName: { contains: query, mode: "insensitive" } } },
                  { user: { phone: { contains: query } } },
                  { user: { email: { contains: query, mode: "insensitive" } } },
                  { employeeCode: { contains: query, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: {
          user: true,
          branch: true,
          role: true,
          department: true,
          invites: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        take: 200,
      });

  const now = new Date();
  const held = invitationsHeld(session.tenant);
  /**
   * What to show in the Status column. For someone who has joined, their
   * membership status is the useful fact; for someone who has not, the
   * state of their invitation is — "Invited" alone does not tell an admin
   * whether to chase, resend or wait.
   */
  function displayStatus(member: (typeof members)[number]): Status {
    if (member.status !== "INVITED") {
      return membershipStatus[member.status] ?? STATUS.active;
    }
    return computeInviteStatus(member.invites[0] ?? null, now, held && Boolean(member.user.email));
  }

  const total = devFixtureOffline()
    ? 0
    : await getDb().tenantMembership.count({
        where: { tenantId: session.tenant.id, ...statusWhere },
      });

  const filtered = query.length >= 2 || branchFilter || showInactive;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">Employees</h1>
        <div className="flex flex-wrap items-end gap-3">
          <BranchFilter options={branchOptions} selected={branchFilter} />
          <a
            href="/print/id-cards?all=1"
            target="_blank"
            className="inline-flex h-11 items-center gap-2 rounded-button border-[1.5px] border-border-strong bg-surface-default px-4 text-label text-text-primary hover:bg-surface-sunken"
          >
            Print ID cards
          </a>
          {session.permissions.has("employees.manage") && (
            <Link
              href="/admin/employees/new"
              className="inline-flex h-11 items-center gap-2 rounded-button bg-brand-primary px-5 text-label text-text-on-primary hover:brightness-[0.94]"
            >
              <UserPlus className="size-4" aria-hidden="true" />
              Add employee
            </Link>
          )}
        </div>
      </div>

      <EmployeeSearch
        initialQuery={query}
        showInactive={showInactive}
        resultCount={members.length}
      />

      <p className="text-secondary text-text-secondary" aria-live="polite">
        Showing {members.length} of {total} {total === 1 ? "person" : "people"}
        {selectedBranchName && ` at ${selectedBranchName}`}
      </p>

      {members.length === 0 ? (
        <Card flush>
          <EmptyState
            title={
              query.length >= 2
                ? `No employee matches "${query}".`
                : selectedBranchName
                  ? `No employees at ${selectedBranchName}.`
                  : "No employees yet."
            }
            body={
              query.length >= 2
                ? "Check the spelling or search by phone number."
                : "People appear here once they are added to your company."
            }
            action={
              filtered ? (
                <Link
                  href="/admin/employees"
                  className="text-label text-brand-primary underline-offset-2 hover:underline"
                >
                  Clear search
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          {/* Mobile: stacked cards. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {members.map((member) => (
              <li key={member.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-body font-semibold text-text-primary">
                        <Link
                          href={`/admin/employees/${member.id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {member.user.displayName}
                        </Link>
                      </p>
                      <p className="text-caption text-text-secondary">
                        {member.role.name}
                        {member.employeeCode && ` · ${member.employeeCode}`}
                      </p>
                    </div>
                    <StatusChip
                      status={displayStatus(member)}
                      size="sm"
                    />
                  </div>
                  <p className="mt-1 text-secondary text-text-secondary">
                    {member.branch?.name ?? "No location set"}
                    {member.canCheckInAtAnyBranch && " · works across locations"}
                  </p>
                  {member.user.phone && (
                    <p className="font-mono text-data text-text-secondary tabular-nums">
                      {member.user.phone}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>

          {/* md+: table with the name as the row header. */}
          <div className="hidden overflow-hidden rounded-surface-card border border-border-default bg-surface-default shadow-elevation-1 md:block">
            <table className="w-full border-collapse">
              <caption className="sr-only">Employees in this company</caption>
              <thead>
                <tr className="bg-surface-sunken">
                  <th scope="col" className="micro-label px-4 py-2.5 text-left text-text-tertiary">
                    Employee
                  </th>
                  <th scope="col" className="micro-label px-4 py-2.5 text-left text-text-tertiary">
                    Role
                  </th>
                  <th scope="col" className="micro-label px-4 py-2.5 text-left text-text-tertiary">
                    Location
                  </th>
                  <th scope="col" className="micro-label px-4 py-2.5 text-left text-text-tertiary">
                    Contact
                  </th>
                  <th scope="col" className="micro-label px-4 py-2.5 text-left text-text-tertiary">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="border-t border-border-subtle hover:bg-surface-sunken"
                  >
                    <th
                      scope="row"
                      className="px-4 py-2.5 text-left text-body font-semibold text-text-primary"
                    >
                      <Link
                        href={`/admin/employees/${member.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {member.user.displayName}
                      </Link>
                      {member.employeeCode && (
                        <span className="ml-2 font-mono text-mono font-normal text-text-tertiary">
                          {member.employeeCode}
                        </span>
                      )}
                    </th>
                    <td className="px-4 py-2.5 text-body">{member.role.name}</td>
                    <td className="px-4 py-2.5 text-body">
                      {member.branch?.name ?? "—"}
                      {member.canCheckInAtAnyBranch && (
                        <span className="block text-caption text-text-secondary">
                          Works across locations
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-data text-text-secondary tabular-nums">
                      {member.user.phone ?? member.user.email ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusChip status={displayStatus(member)} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
