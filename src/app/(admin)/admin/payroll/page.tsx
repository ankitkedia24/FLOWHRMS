import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { STATUS, type Status } from "@/lib/status";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { evaluateAccess } from "@/lib/authz/flags";
import { formatRupees, periodLabel, roundRupees } from "@/lib/payroll/engine";
import { buildPayrollPreview, currentPeriod } from "@/lib/payroll/service";
import { payrollRoundingNote, settlementMonth } from "@/lib/expenses/payroll-settlement";
import { listClaimsAwaitingPayroll } from "@/lib/expenses/queries";
import { claimRef } from "@/lib/expenses/state";
import { PayrollControls } from "./PayrollControls";
import { SettleIntoRun } from "./SettleIntoRun";
import { describeWeekdays } from "@/lib/attendance/calendar";

export const metadata: Metadata = { title: "Payroll" };

const lineStatus: Record<string, Status> = {
  READY: STATUS.ready,
  NO_SALARY_STRUCTURE: {
    key: "no-structure",
    label: "No salary set",
    tone: "neutral",
  },
  BLOCKED: { key: "blocked", label: "Needs review", tone: "error" },
};

/**
 * Payroll dashboard and run preview (screens A14/A15).
 *
 * Every figure is shown with its inputs, the policy version and the
 * period (Constitution §6). Nothing animates, nothing is partial.
 */
export default async function AdminPayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { session, decision } = await checkAccess({
    module: "PAYROLL",
    permission: "payroll.view",
  });
  if (!decision.allowed) redirect("/unauthorized");

  const tz = session.tenant.timezone;
  const params = await searchParams;

  if (devFixtureOffline()) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-heading text-h1 text-text-primary">Payroll</h1>
        <Card flush>
          <EmptyState
            title="No payroll for this month yet."
            body="Connect a database to calculate payroll."
          />
        </Card>
      </div>
    );
  }

  const periodMonth = params.period?.match(/^\d{4}-\d{2}$/)
    ? new Date(`${params.period}-01T00:00:00.000Z`)
    : currentPeriod(tz);
  const periodValue = periodMonth.toISOString().slice(0, 7);
  const label = periodLabel(periodMonth, tz);

  const [run, preview, structureCount] = await Promise.all([
    getDb().payrollRun.findUnique({
      where: {
        tenantId_periodMonth: { tenantId: session.tenant.id, periodMonth },
      },
      include: { lines: { include: { adjustments: true } } },
    }),
    buildPayrollPreview(session, periodMonth),
    // Gate on STRUCTURES, not components: a simple-mode tenant legitimately
    // has zero components until the first salary is saved, and a tenant
    // with components but no salaries still cannot run payroll.
    getDb().salaryStructure.count({
      where: { tenantId: session.tenant.id },
    }),
  ]);

  // Saved line ids, so a calculated row can open its payslip.
  const savedLineIdByMembership = new Map(
    (run?.lines ?? []).map((line) => [line.membershipId, line.id]),
  );

  const approved = run?.status === "APPROVED";
  const ready = preview.lines.filter((l) => l.status === "READY");
  const excluded = preview.lines.filter(
    (l) => l.status === "NO_SALARY_STRUCTURE",
  );
  const blocked = preview.lines.filter((l) => l.status === "BLOCKED");
  const canApprove = session.permissions.has("payroll.approve");
  const canEdit = session.permissions.has("payroll.edit");

  // Payroll pulls (EXPENSES-MODULE.md §13 rule 8): approved expense claims
  // for people on this DRAFT run. Only when Expenses is on and the viewer
  // may settle claims; the write still goes through the seam.
  const entitlements = await loadEntitlements(session.tenant.id, session.user.id);
  const expensesOn = evaluateAccess({ session, entitlements, module: "EXPENSES" }).allowed;
  const canSettleExpenses =
    expensesOn && session.permissions.has("expenses.approve") && Boolean(run) && !approved;
  const awaiting = canSettleExpenses ? await listClaimsAwaitingPayroll(session) : [];
  const payableMembers = new Set(
    (run?.lines ?? [])
      .filter((line) => line.status !== "NO_SALARY_STRUCTURE")
      .map((line) => line.membershipId),
  );
  const claimsForRun = awaiting
    .filter((c) => c.approvedAmount !== null && payableMembers.has(c.membershipId))
    .filter((c) => settlementMonth(c.decidedAt ?? new Date(), tz).getTime() <= periodMonth.getTime())
    .map((c) => {
      const approvedAmount = Number(c.approvedAmount);
      const payrollAmount = roundRupees(approvedAmount);
      return {
        id: c.id,
        ref: claimRef(c.claimNumber),
        personName: c.membership.user.displayName,
        categoryName: c.categoryName,
        approvedAmount,
        payrollAmount,
        note: payrollRoundingNote(approvedAmount, payrollAmount),
      };
    });

  if (structureCount === 0) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-heading text-h1 text-text-primary">Payroll</h1>
        <Alert variant="info" title="Set salaries first">
          Tell FlowHRMS what each person is paid per month. Payroll is calculated
          from that, your attendance records and approved leave.
        </Alert>
        <Card flush>
          <EmptyState
            title="No salaries set yet."
            body="One amount per person is enough to start."
            action={
              <Link
                href="/admin/payroll/salaries"
                className="inline-flex h-11 items-center rounded-button bg-brand-primary px-5 font-heading text-label text-text-on-primary hover:bg-brand-primary-hover"
              >
                Set salaries
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">Payroll</h1>
        <Link
          href="/admin/payroll/salaries"
          className="text-label text-brand-primary underline-offset-2 hover:underline"
        >
          Salaries
        </Link>
      </div>

      <PayrollControls
        period={periodValue}
        periodLabel={label}
        status={approved ? "APPROVED" : run ? "DRAFT" : "NOT_CALCULATED"}
        canEdit={canEdit}
        canApprove={canApprove}
        employeeCount={ready.length}
        netTotal={preview.netTotal}
        excluded={excluded.map((l) => l.name)}
        blocked={blocked.map((l) => ({
          name: l.name,
          reason: l.statusReason ?? "Needs review",
        }))}
        unreviewedExceptions={preview.unreviewedExceptions}
      />

      {preview.adjustmentsOnExcludedLines.length > 0 && (
        <Alert variant="warning" title="Adjustments on lines this run will not pay.">
          {preview.adjustmentsOnExcludedLines
            .map((x) => `${x.name}: ${x.count} adjustment${x.count === 1 ? "" : "s"}, ${formatRupees(x.total)}`)
            .join(" · ")}
          {" — "}no salary is set, or the person has left, so these amounts are in no payslip.
          Set a salary and recalculate, or settle them outside payroll.
        </Alert>
      )}

      {canSettleExpenses && claimsForRun.length > 0 && (
        <SettleIntoRun periodLabel={label} claims={claimsForRun} />
      )}

      {/* Inputs used — payroll traceability. */}
      <Card>
        <CardHeader title="Inputs used" meta={label} />
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <Row label="Period" value={label} />
          <Row label="Days in period" value={String(preview.calendarDays)} />
          <Row
            label="Paid days off"
            value={`${describeWeekdays(preview.workCalendar.weeklyOffDays)} off each week${
              preview.workCalendar.holidaysInPeriod.length > 0
                ? ` · ${preview.workCalendar.holidaysInPeriod.length} holiday${preview.workCalendar.holidaysInPeriod.length === 1 ? "" : "s"}`
                : ""
            } (people with their own weekly off use theirs)`}
          />
          <Row
            label="Attendance"
            value="Approved records for the period"
          />
          <Row label="Leave" value="Approved leave, paid and unpaid" />
          <Row
            label="Late policy"
            value={
              preview.latePolicy.latesPerDeductedDay > 0
                ? `${preview.latePolicy.latesPerDeductedDay} lates = 1 unpaid day`
                : "No deduction for lateness"
            }
          />
          <Row
            label="Absent days"
            value={
              preview.latePolicy.deductAbsentDays
                ? "Missed working days reduce pay"
                : "Do not reduce pay"
            }
          />
          <Row label="Rounding" value="Half-up to whole rupees" />
          {run?.approvedAt && (
            <Row
              label="Approved"
              value={new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                timeZone: tz,
              }).format(run.approvedAt)}
            />
          )}
        </dl>
      </Card>

      <section aria-labelledby="payroll-lines">
        <h2
          id="payroll-lines"
          className="mb-3 font-heading text-h2 text-text-primary"
        >
          Employees ({preview.lines.length})
        </h2>

        {/* Mobile: stacked cards — a scrolling table is not acceptable. */}
        <ul className="flex flex-col gap-3 md:hidden">
          {preview.lines.map((line) => (
            <li key={line.membershipId}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-body font-semibold text-text-primary">
                    {line.name}
                  </p>
                  <StatusChip status={lineStatus[line.status]} size="sm" />
                </div>
                {line.result ? (
                  <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-data text-text-secondary tabular-nums">
                    <div className="flex gap-1.5">
                      <dt>Payable</dt>
                      <dd className="text-text-primary">
                        {line.result.payableDays} d
                      </dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt>Gross</dt>
                      <dd className="text-text-primary">
                        {formatRupees(line.result.gross)}
                      </dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt>Net</dt>
                      <dd className="font-semibold text-text-primary">
                        {formatRupees(line.result.net)}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-1 text-secondary text-text-secondary">
                    {line.statusReason}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>

        {/* md+: full table with a pinned totals row. */}
        <div className="hidden overflow-hidden rounded-surface-card border border-border-default bg-surface-default shadow-elevation-1 md:block">
          <table className="w-full border-collapse">
            <caption className="sr-only">
              Payroll lines for {label}. Totals reconcile to the sum of the
              rows.
            </caption>
            <thead>
              <tr className="bg-surface-sunken">
                <th scope="col" className="micro-label px-4 py-2.5 text-left text-text-tertiary">
                  Employee
                </th>
                <th scope="col" className="micro-label px-4 py-2.5 text-right text-text-tertiary">
                  Payable days
                </th>
                <th scope="col" className="micro-label px-4 py-2.5 text-right text-text-tertiary">
                  Gross
                </th>
                <th scope="col" className="micro-label px-4 py-2.5 text-right text-text-tertiary">
                  Deductions
                </th>
                <th scope="col" className="micro-label px-4 py-2.5 text-right text-text-tertiary">
                  Adjustments
                </th>
                <th scope="col" className="micro-label px-4 py-2.5 text-right text-text-tertiary">
                  Net pay
                </th>
                <th scope="col" className="micro-label px-4 py-2.5 text-left text-text-tertiary">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {preview.lines.map((line) => (
                <tr
                  key={line.membershipId}
                  className="border-t border-border-subtle hover:bg-surface-sunken"
                >
                  <th
                    scope="row"
                    className="px-4 py-2.5 text-left text-body font-semibold text-text-primary"
                  >
                    {savedLineIdByMembership.get(line.membershipId) ? (
                      <Link
                        href={`/admin/payroll/payslips/${savedLineIdByMembership.get(line.membershipId)}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {line.name}
                      </Link>
                    ) : (
                      line.name
                    )}
                    {line.employeeCode && (
                      <span className="ml-2 font-mono text-mono font-normal text-text-tertiary">
                        {line.employeeCode}
                      </span>
                    )}
                  </th>
                  <td className="px-4 py-2.5 text-right font-mono text-data tabular-nums">
                    {line.result ? line.result.payableDays : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-data tabular-nums">
                    {line.result ? formatRupees(line.result.gross) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-data tabular-nums">
                    {line.result ? formatRupees(line.result.deductionTotal) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-data tabular-nums">
                    {line.result && line.result.adjustmentTotal !== 0
                      ? formatRupees(line.result.adjustmentTotal)
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-data font-semibold tabular-nums">
                    {line.result ? formatRupees(line.result.net) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusChip status={lineStatus[line.status]} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border-strong bg-surface-sunken">
                <th scope="row" className="px-4 py-2.5 text-left text-label text-text-primary">
                  Totals ({ready.length} payable)
                </th>
                <td />
                <td className="px-4 py-2.5 text-right font-mono text-data font-semibold tabular-nums">
                  {formatRupees(preview.grossTotal)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-data font-semibold tabular-nums">
                  {formatRupees(preview.deductionTotal)}
                </td>
                <td />
                <td className="px-4 py-2.5 text-right font-mono text-data font-semibold tabular-nums">
                  {formatRupees(preview.netTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p className="text-caption text-text-secondary">
        Statutory calculations must be checked by your accountant. FlowHRMS does
        not certify compliance.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2">
      <dt className="text-secondary text-text-secondary">{label}</dt>
      <dd className="text-body text-text-primary">{value}</dd>
    </div>
  );
}
