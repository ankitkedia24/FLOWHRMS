import { Card, CardHeader } from "@/components/ui/Card";
import { formatRupees } from "@/lib/payroll/engine";
import type { PayslipComponentLine } from "@/lib/payroll/engine";

/**
 * Payslip breakdown (screens E19 / A16).
 *
 * Constitution §6 — no hidden calculations: every line shows how it was
 * reached, the attendance that produced it, the policy version and the
 * period. Statutory components say who defined them. Nothing animates.
 */
export interface PayslipData {
  periodLabel: string;
  employeeName: string;
  employeeCode: string | null;
  calendarDays: number;
  /** 0 on payslips approved before the work calendar existed. */
  workingDays: number;
  weeklyOffDays: number;
  holidayDays: number;
  presentDays: number;
  paidLeaveDays: number;
  unpaidDays: number;
  payableDays: number;
  lateMinutes: number;
  lateDeductionDays: number;
  earnings: PayslipComponentLine[];
  deductions: PayslipComponentLine[];
  adjustments: Array<{ label: string; amount: number; reason: string }>;
  gross: number;
  deductionTotal: number;
  adjustmentTotal: number;
  net: number;
  policyVersion: number | null;
  approvedAt: string | null;
}

export function PayslipDetail({
  data,
  company,
}: {
  data: PayslipData;
  /** Whose payslip this is: the company's name and, if it has one, its logo. */
  company?: { name: string; logoUrl: string | null };
}) {
  return (
    <div className="flex flex-col gap-4">
      {company && (
        <div className="flex items-center gap-3">
          {company.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
            <img src={company.logoUrl} alt="" className="h-10 w-auto max-w-[140px] object-contain" />
          )}
          <p className="font-heading text-h3 text-text-primary">{company.name}</p>
        </div>
      )}
      <Card>
        <CardHeader
          title={`Net pay · ${data.periodLabel}`}
          meta={
            data.employeeCode
              ? `${data.employeeName} · ${data.employeeCode}`
              : data.employeeName
          }
        />
        <p className="font-mono text-data-xl font-semibold text-text-primary tabular-nums">
          {formatRupees(data.net)}
        </p>
      </Card>

      <Card>
        <CardHeader title="Attendance used" />
        <dl className="flex flex-col gap-2">
          <Row label="Days in period" value={String(data.calendarDays)} />
          {data.workingDays > 0 && (
            <>
              <Row label="Working days" value={String(data.workingDays)} />
              <Row
                label="Weekly offs (paid)"
                value={String(data.weeklyOffDays)}
              />
              {data.holidayDays > 0 && (
                <Row label="Holidays (paid)" value={String(data.holidayDays)} />
              )}
            </>
          )}
          <Row label="Present" value={String(data.presentDays)} />
          {data.paidLeaveDays > 0 && (
            <Row label="Paid leave" value={String(data.paidLeaveDays)} />
          )}
          <Row label="Unpaid days" value={String(data.unpaidDays)} />
          <Row label="Payable days" value={String(data.payableDays)} />
          {data.lateMinutes > 0 && (
            <Row label="Late minutes" value={String(data.lateMinutes)} />
          )}
          {data.lateDeductionDays > 0 && (
            <Row
              label="Days deducted for lateness"
              value={String(data.lateDeductionDays)}
            />
          )}
        </dl>
      </Card>

      <Card>
        <CardHeader title="Earnings" />
        <ul className="flex flex-col">
          {data.earnings.map((line) => (
            <ComponentRow key={line.key} line={line} />
          ))}
          <li className="flex items-center justify-between gap-3 border-t-2 border-border-strong pt-2.5">
            <span className="text-label text-text-primary">Gross</span>
            <span className="font-mono text-data font-semibold text-text-primary tabular-nums">
              {formatRupees(data.gross)}
            </span>
          </li>
        </ul>
      </Card>

      {data.deductions.length > 0 && (
        <Card>
          <CardHeader title="Deductions" />
          <ul className="flex flex-col">
            {data.deductions.map((line) => (
              <ComponentRow key={line.key} line={line} />
            ))}
            <li className="flex items-center justify-between gap-3 border-t-2 border-border-strong pt-2.5">
              <span className="text-label text-text-primary">
                Total deductions
              </span>
              <span className="font-mono text-data font-semibold text-text-primary tabular-nums">
                {formatRupees(data.deductionTotal)}
              </span>
            </li>
          </ul>
        </Card>
      )}

      {data.adjustments.length > 0 && (
        <Card>
          <CardHeader
            title="Adjustments"
            meta="Recorded separately so the original figures stay visible."
          />
          <ul className="flex flex-col">
            {data.adjustments.map((adjustment, index) => (
              <li
                key={`${adjustment.label}-${index}`}
                className="flex items-start justify-between gap-3 border-b border-border-subtle py-2 last:border-0"
              >
                <span className="text-body text-text-primary">
                  {adjustment.label}
                  <span className="mt-0.5 block text-caption text-text-secondary">
                    {adjustment.reason}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-data text-text-primary tabular-nums">
                  {formatRupees(adjustment.amount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between gap-3">
          <span className="font-heading text-h3 text-text-primary">
            Net pay
          </span>
          <span className="font-mono text-data-lg font-semibold text-text-primary tabular-nums">
            {formatRupees(data.net)}
          </span>
        </div>
        <p className="mt-3 border-t border-border-subtle pt-3 text-caption text-text-secondary">
          Gross {formatRupees(data.gross)} − deductions{" "}
          {formatRupees(data.deductionTotal)}
          {data.adjustmentTotal !== 0 &&
            ` ${data.adjustmentTotal > 0 ? "+" : "−"} adjustments ${formatRupees(Math.abs(data.adjustmentTotal))}`}
          . Amounts are rounded to whole rupees; totals match the sum of the
          lines above.
        </p>
      </Card>

      <p className="text-caption text-text-secondary">
        {data.policyVersion != null &&
          `Policy version ${data.policyVersion} applied for ${data.periodLabel}. `}
        If something looks wrong, ask HR to review — changes are recorded.
      </p>
    </div>
  );
}

function ComponentRow({ line }: { line: PayslipComponentLine }) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-border-subtle py-2 last:border-0">
      <span className="text-body text-text-primary">
        {line.name}
        <span className="mt-0.5 block text-caption text-text-secondary">
          {line.basis}
        </span>
      </span>
      <span className="shrink-0 font-mono text-data text-text-primary tabular-nums">
        {formatRupees(line.amount)}
      </span>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2 last:border-0">
      <dt className="text-secondary text-text-secondary">{label}</dt>
      <dd className="font-mono text-data text-text-primary tabular-nums">
        {value}
      </dd>
    </div>
  );
}
