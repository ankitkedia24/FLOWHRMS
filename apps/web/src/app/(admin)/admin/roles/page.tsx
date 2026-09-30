import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { PERMISSIONS, ROLE_TEMPLATES } from "@/lib/catalog";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { roleEditRefusal } from "@/lib/roles/policy";
import { RoleEditor } from "./RoleEditor";

export const metadata: Metadata = { title: "Access levels" };

/**
 * Roles and permissions (screen A19).
 *
 * Roles are templates; granular permissions are the enforcement unit.
 * Sensitive permissions are grouped and labelled, and changing one warns
 * in advance what it lets people see (user-flows.md §9).
 */
export default async function RolesPage() {
  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "roles.manage",
  });
  if (!decision.allowed) redirect("/unauthorized");

  if (devFixtureOffline()) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-heading text-h1 text-text-primary">
          Access levels
        </h1>
        <Alert variant="info" title="Connect a database to edit roles." />
      </div>
    );
  }

  const db = getDb();
  const roles = await db.role.findMany({
    where: { tenantId: session.tenant.id },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
    },
    orderBy: { key: "asc" },
  });

  const order = ROLE_TEMPLATES.map((r) => r.key);
  const sorted = [...roles].sort(
    (a, b) => order.indexOf(a.key) - order.indexOf(b.key),
  );
  // Levels you can't change say why up front, and permissions you don't
  // hold are shown but can't be moved (src/lib/roles/policy.ts).
  const myRoleId = roles.find((r) => r.key === session.membership.roleKey)?.id ?? "";
  const mine = [...session.permissions] as string[];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-h1 text-text-primary">
        Access levels
      </h1>
      <p className="-mt-3 text-body text-text-secondary">
        What each access level can see and do. Every designation is tied to one of these —
        manage job titles in <a href="/admin/settings/designations" className="text-brand-primary underline-offset-2 hover:underline">Designations</a>.
      </p>

      <Alert variant="info" title="Record scope is applied before every permission">
        A permission only ever applies within the records a person can
        already see. Owner, Super Admin, Admin and HR see the whole company;
        everyone else sees their team — the people who report to them,
        directly or through others, and the departments they head. Changes
        take effect on each person&apos;s next request and are recorded in
        the activity log.
      </Alert>

      <div className="flex flex-col gap-4">
        {sorted.map((role) => (
          <Card key={role.id}>
            <RoleEditor
              roleId={role.id}
              roleKey={role.key}
              roleName={role.name}
              description={role.description}
              memberCount={role._count.memberships}
              granted={role.permissions.map((rp) => rp.permission.key)}
              refusal={roleEditRefusal({
                actorRoleKey: session.membership.roleKey,
                actorRoleId: myRoleId,
                role: { id: role.id, key: role.key, name: role.name },
              })}
              mine={mine}
              permissions={PERMISSIONS.map((p) => ({
                key: p.key,
                name: p.name,
                isSensitive: p.isSensitive,
              }))}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
