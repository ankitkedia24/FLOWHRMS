import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { getPolicy } from "@/lib/policies";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { STATUS, type Status } from "@/lib/status";
import { formatRupees } from "@/lib/payroll/engine";
import {
  isSimpleStructure,
  resolvePayMode,
  type PaySetupPolicy,
} from "@/lib/payroll/simple";
import { BulkSalariesTable, type BulkRow } from "./BulkSalariesTable";
import { StarterPackPicker } from "./StarterPackPicker";
import { ComponentEditor, StructureEditor } from "./AdvancedEditors";

export const metadata: Metadata = { title: "Salaries" };

/** Same wording in the table and the mobile card — one source, not two. */
function structureStatus(hasStructure: boolean): Status {
  return hasStructure
    ? STATUS.ready
    : { key: "no-structure", label: "No salary set", tone: "neutral" };
}

function formatEffectiveFrom(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Salaries — what each person is paid.
 *
 * Most companies see one question per person: the monthly amount. The
 * component vocabulary (pay items, percentages, per-day amounts) exists
 * only in the custom setup, reached through the picker below. FlowHRMS ships
 * no statutory formulas either way (D-P3-01); the approval flow's
 * accountant acknowledgement (D-019) is unchanged by any of this.
 */
export default async function SalariesPage() {
  const { session, decision } = await checkAccess({
    module: "PAYROLL",
    permission: "payroll.view",
  });
  if (!decision.allowed) redirect("/unauthorized");

  const canEdit = session.permissions.has("payroll.edit");

  if (devFixtureOffline()) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-heading text-h1 text-text-primary">Salaries</h1>
        <Card flush>
          <EmptyState
            title="No salaries yet."
            body="Connect a database to configure payroll."
          />
        </Card>
      </div>
    );
  }

  const db = getDb();
  const [components, members, structures, policy] = await Promise.all([
    db.salaryComponent.findMany({
      where: { tenantId: session.tenant.id },
      orderBy: { sortOrder: "asc" },
    }),
    db.tenantMembership.findMany({
      where: { tenantId: session.tenant.id, status: "ACTIVE" },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    db.salaryStructure.findMany({
      where: { tenantId: session.tenant.id },
      include: {
        lines: {
          include: {
            component: {
              select: { key: true, kind: true, calculation: true },
            },
          },
        },
      },
      orderBy: { effectiveFrom: "desc" },
    }),
    getPolicy<PaySetupPolicy>(session.tenant.id, "pay_setup"),
  ]);

  const payMode = resolvePayMode(
    policy,
    components.filter((c) => c.isActive),
  );

  const latestByMember = new Map<string, (typeof structures)[number]>();
  for (const structure of structures) {
    if (!latestByMember.has(structure.membershipId)) {
      latestByMember.set(structure.membershipId, structure);
    }
  }

  // ------------------------------------------------------------- simple/pack
  if (payMode.mode !== "CUSTOM") {
    const packKeys = new Set(
      payMode.mode === "PACK"
        ? payMode.pack.components.map((c) => c.key)
        : [],
    );
    const rows: BulkRow[] = members.map((member) => {
      const structure = latestByMember.get(member.id);
      const simple = structure != null && isSimpleStructure(structure.lines);
      const packShaped =
        structure != null &&
        packKeys.size > 0 &&
        structure.lines.every((l) => packKeys.has(l.component.key));
      return {
        membershipId: member.id,
        name: member.user.displayName,
        // For the simple shape, the LINE is the salary. Structures saved
        // through the old editor could carry baseAmount 0 with all the pay
        // in the line, so baseAmount would read ₹0 for a person who is
        // paid — the one mistake this column must never make.
        currentPay: structure
          ? formatRupees(
              simple
                ? Number(structure.lines[0].amount)
                : Number(structure.baseAmount),
            )
          : null,
        isCustomShape: structure != null && !simple && !packShaped,
      };
    });

    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-h1 text-text-primary">Salaries</h1>
          <Link
            href="/admin/payroll"
            className="text-label text-brand-primary underline-offset-2 hover:underline"
          >
            Back to payroll
          </Link>
        </div>

        <p className="max-w-[70ch] text-secondary text-text-secondary">
          What each person is paid per month. Amounts here are what your
          company chooses to pay — FlowHRMS calculates payslips only from what
          you enter, your attendance records and approved leave.
        </p>

        {canEdit ? (
          <BulkSalariesTable rows={rows} />
        ) : (
          <Card flush>
            <EmptyState
              title="You can view payroll, not edit it."
              body="Salaries are set by someone with the payroll edit permission."
            />
          </Card>
        )}

        {canEdit && (
          <details className="group">
            <summary className="cursor-pointer text-label text-brand-primary underline-offset-2 hover:underline">
              Want to split salaries into parts, or use custom pay items?
            </summary>
            <div className="mt-3">
              <StarterPackPicker
                current={payMode.mode === "PACK" ? payMode.pack.id : "single"}
                percents={payMode.mode === "PACK" ? payMode.percents : {}}
              />
            </div>
          </details>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------ custom
  const activeComponents = components.filter((c) => c.isActive);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">Salaries</h1>
        <Link
          href="/admin/payroll"
          className="text-label text-brand-primary underline-offset-2 hover:underline"
        >
          Back to payroll
        </Link>
      </div>

      <p className="max-w-[70ch] text-secondary text-text-secondary">
        This company uses custom pay items. Amounts here are what your
        company chooses to pay — FlowHRMS calculates payslips only from what you
        enter.
      </p>

      <section aria-labelledby="components">
        <h2
          id="components"
          className="mb-3 font-heading text-h2 text-text-primary"
        >
          Pay items ({activeComponents.length})
        </h2>

        {activeComponents.length === 0 ? (
          <Card flush>
            <EmptyState
              title="No pay items yet."
              body="Add what your company pays and deducts each month."
            />
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {activeComponents.map((component) => (
              <Card key={component.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-h3 text-text-primary">
                      {component.name}
                    </h3>
                    <p className="mt-0.5 font-mono text-mono text-text-tertiary uppercase">
                      {component.key}
                    </p>
                  </div>
                  <StatusChip
                    status={
                      component.kind === "EARNING"
                        ? { key: "earning", label: "Earning", tone: "success" }
                        : { key: "deduction", label: "Deduction", tone: "neutral" }
                    }
                    size="sm"
                  />
                </div>
                <dl className="mt-3 flex flex-col gap-1 text-secondary text-text-secondary">
                  <div className="flex justify-between gap-3">
                    <dt>Calculated as</dt>
                    <dd className="text-text-primary">
                      {component.calculation === "PERCENT_OF_BASE"
                        ? "Percentage of base"
                        : component.calculation === "PER_DAY"
                          ? "Per payable day"
                          : "Fixed monthly amount"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Reduced by unpaid days</dt>
                    <dd className="text-text-primary">
                      {component.prorated ? "Yes" : "No"}
                    </dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="mt-4">
            <ComponentEditor />
          </div>
        )}
      </section>

      <section aria-labelledby="structures">
        <h2
          id="structures"
          className="mb-3 font-heading text-h2 text-text-primary"
        >
          Employees ({members.length})
        </h2>

        <div className="grid gap-4 lg:grid-cols-2">
          {members.map((member) => {
            const structure = latestByMember.get(member.id);
            return (
              <Card key={member.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-body font-semibold text-text-primary">
                    {member.user.displayName}
                  </p>
                  <StatusChip
                    status={structureStatus(Boolean(structure))}
                    size="sm"
                  />
                </div>
                <dl className="mt-2 flex flex-col gap-1 text-secondary">
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-secondary">Base</dt>
                    <dd className="font-mono text-data text-text-primary tabular-nums">
                      {structure ? formatRupees(Number(structure.baseAmount)) : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-secondary">Pay items</dt>
                    <dd className="font-mono text-data text-text-primary tabular-nums">
                      {structure ? structure.lines.length : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-secondary">Effective from</dt>
                    <dd className="font-mono text-data text-text-primary tabular-nums">
                      {structure ? formatEffectiveFrom(structure.effectiveFrom) : "—"}
                    </dd>
                  </div>
                </dl>
              </Card>
            );
          })}
        </div>

        {canEdit && activeComponents.length > 0 && (
          <div className="mt-4">
            <StructureEditor
              members={members.map((m) => ({
                id: m.id,
                name: m.user.displayName,
              }))}
              components={activeComponents.map((c) => ({
                id: c.id,
                name: c.name,
                kind: c.kind,
                calculation: c.calculation,
              }))}
            />
          </div>
        )}
      </section>

      {canEdit && (
        <details>
          <summary className="cursor-pointer text-label text-brand-primary underline-offset-2 hover:underline">
            Switch back to a simpler setup?
          </summary>
          <div className="mt-3">
            <StarterPackPicker current="custom" percents={{}} />
          </div>
        </details>
      )}
    </div>
  );
}
