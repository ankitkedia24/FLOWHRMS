import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { STATUS } from "@/lib/status";
import { formatRupees, periodLabel } from "@/lib/payroll/engine";

export const metadata: Metadata = { title: "Payslips" };

/**
 * My payslips (screen E18). An employee sees only their own, and only
 * after the period is approved — never a draft figure.
 */
export default async function PayslipsPage() {
  const { session, decision } = await checkAccess({ module: "PAYROLL" });
  if (!decision.allowed) redirect("/unauthorized");

  const tz = session.tenant.timezone;
  const lines = devFixtureOffline()
    ? []
    : await getDb().payrollLine.findMany({
        where: {
          tenantId: session.tenant.id,
          membershipId: session.membership.id,
          status: "READY",
          run: { status: "APPROVED" }, // drafts are never shown
        },
        include: { run: true },
        orderBy: { run: { periodMonth: "desc" } },
        take: 24,
      });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="mt-2 font-heading text-h1 text-text-primary">Payslips</h1>

      {lines.length === 0 ? (
        <Card flush>
          <EmptyState
            warm
            title="No payslips yet."
            body="Payslips appear here after payroll is approved for a month."
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {lines.map((line) => (
            <li key={line.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-body font-semibold text-text-primary">
                      <Link
                        href={`/payslips/${line.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {periodLabel(line.run.periodMonth, tz)}
                      </Link>
                    </p>
                    <p className="text-caption text-text-secondary">
                      {line.payableDays.toString()} payable days
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusChip status={STATUS.paid} size="sm" />
                    <p className="mt-1 font-mono text-data-lg font-semibold text-text-primary tabular-nums">
                      {formatRupees(Number(line.net))}
                    </p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="text-caption text-text-secondary">
        If something looks wrong, ask HR to review — changes are recorded.
      </p>
    </div>
  );
}
