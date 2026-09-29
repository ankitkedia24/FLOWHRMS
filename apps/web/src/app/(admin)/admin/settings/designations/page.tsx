import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { ROLE_PICKER_ORDER, privilegeRank } from "@/lib/catalog";
import { loadEmployeeFormOptions } from "@/lib/employees/form-options";
import { Alert } from "@/components/ui/Alert";
import { DesignationsPanel } from "./DesignationsPanel";

export const metadata: Metadata = { title: "Designations" };

/**
 * The company's job titles and the access each one carries. Adding a
 * person means picking one of these; so does changing what they can see.
 */
export default async function DesignationsPage() {
  const { session, decision } = await checkAccess({ module: "EMPLOYEES", permission: "employees.manage" });
  if (!decision.allowed) redirect("/unauthorized");
  if (devFixtureOffline()) return <Alert variant="info" title="Connect a database to manage designations." />;

  const db = getDb();
  const [designations, options] = await Promise.all([
    db.designation.findMany({
      where: { tenantId: session.tenant.id },
      include: {
        role: true,
        _count: { select: { memberships: { where: { status: { in: ["ACTIVE", "INVITED"] } } } } },
      },
    }),
    loadEmployeeFormOptions(session),
  ]);
  const myRank = privilegeRank(session.membership.roleKey);
  const order = (key: string) => {
    const i = ROLE_PICKER_ORDER.indexOf(key);
    return i === -1 ? ROLE_PICKER_ORDER.length : i;
  };

  return (
    <div className="flex max-w-[860px] flex-col gap-5">
      <div>
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-1 text-label text-brand-primary underline-offset-2 hover:underline"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Company settings
        </Link>
        <h1 className="mt-2 font-heading text-h1 text-text-primary">Designations</h1>
        <p className="mt-1 text-body text-text-secondary">
          Your job titles — Delivery Executive, Store Manager, Accountant — each with the access it gives in FlowHRMS.
          Pick one when you add a person; what they can see follows from it.
        </p>
      </div>
      <DesignationsPanel
        rows={designations
          .sort((a, b) => Number(b.isActive) - Number(a.isActive) || order(a.role.key) - order(b.role.key) || a.name.localeCompare(b.name))
          .map((d) => ({
            id: d.id,
            name: d.name,
            roleId: d.roleId,
            roleName: d.role.name,
            holders: d._count.memberships,
            isActive: d.isActive,
            aboveYou: privilegeRank(d.role.key) > myRank,
          }))}
        accessLevels={options.accessLevels}
        canChangeAccess={session.permissions.has("roles.manage")}
      />
    </div>
  );
}
