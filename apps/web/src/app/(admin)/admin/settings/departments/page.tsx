import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { DECIDING_PERMISSION, describeHeadGap } from "@/lib/actions/audience";
import { DepartmentsPanel, type DepartmentRow } from "./DepartmentsPanel";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "settings.manage",
  });
  if (!decision.allowed) redirect("/unauthorized");

  const db = getDb();
  const tenantId = session.tenant.id;
  const offline = devFixtureOffline();

  const [departments, people] = offline
    ? [[], []]
    : await Promise.all([
        db.department.findMany({
          where: { tenantId },
          include: {
            head: {
              include: {
                user: true,
                role: { include: { permissions: { include: { permission: true } } } },
              },
            },
            _count: { select: { members: true } },
          },
          orderBy: [{ isActive: "desc" }, { name: "asc" }],
        }),
        db.tenantMembership.findMany({
          where: { tenantId, status: "ACTIVE" },
          include: { user: true },
          orderBy: { createdAt: "asc" },
          take: 200,
        }),
      ]);

  const decidingKeys = new Set<string>(Object.values(DECIDING_PERMISSION));

  const rows: DepartmentRow[] = departments.map((d) => {
    const headCanDecide = Boolean(
      d.head?.role.permissions.some((p) => decidingKeys.has(p.permission.key)),
    );
    return {
      id: d.id,
      name: d.name,
      headId: d.headId,
      headName: d.head?.user.displayName ?? null,
      memberCount: d._count.members,
      isActive: d.isActive,
      headGap: d.isActive
        ? describeHeadGap({
            departmentName: d.name,
            headName: d.head?.user.displayName ?? null,
            headCanDecideAnything: headCanDecide,
          })
        : null,
    };
  });

  return (
    <div className="flex max-w-[820px] flex-col gap-5">
      <div>
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-1 text-label text-brand-primary underline-offset-2 hover:underline"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Settings
        </Link>
        <h1 className="mt-2 font-heading text-h1 text-text-primary">
          Departments
        </h1>
      </div>

      <DepartmentsPanel
        departments={rows}
        people={people.map((p) => ({
          value: p.id,
          label: p.user.displayName,
        }))}
        canManage
      />
    </div>
  );
}
