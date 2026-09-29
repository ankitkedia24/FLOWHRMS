import "server-only";

import { getDb } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import type { PayslipData } from "@/components/payroll/PayslipDetail";
import type { PayslipComponentLine } from "./engine";
import { periodLabel } from "./engine";

/**
 * Load one payslip, enforcing who may see it.
 *
 * An employee sees only their own. Anyone else needs the sensitive
 * `payroll.view` permission, and drafts are never shown to employees —
 * a figure is only shared once the period is approved.
 */
export async function loadPayslip(
  session: AppSession,
  lineId: string,
): Promise<PayslipData | null> {
  const db = getDb();
  const line = await db.payrollLine.findFirst({
    where: { id: lineId, tenantId: session.tenant.id }, // tenant-scoped
    include: {
      run: true,
      membership: { include: { user: true } },
      adjustments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!line) return null;

  const isOwn = line.membershipId === session.membership.id;
  const canViewOthers = session.permissions.has("payroll.view");
  if (!isOwn && !canViewOthers) return null;

  // Employees never see an unapproved figure.
  if (isOwn && !canViewOthers && line.run.status !== "APPROVED") return null;

  const snapshot = line.run.inputsSnapshot as
    | { policyVersion?: number }
    | null;

  return {
    periodLabel: periodLabel(line.run.periodMonth, session.tenant.timezone),
    employeeName: line.membership.user.displayName,
    employeeCode: line.membership.employeeCode,
    calendarDays: line.calendarDays,
    workingDays: line.workingDays,
    weeklyOffDays: line.weeklyOffDays,
    holidayDays: line.holidayDays,
    presentDays: Number(line.presentDays),
    paidLeaveDays: Number(line.paidLeaveDays),
    unpaidDays: Number(line.unpaidDays),
    payableDays: Number(line.payableDays),
    lateMinutes: line.lateMinutes,
    lateDeductionDays: Number(line.lateDeductionDays),
    earnings: (line.earnings as PayslipComponentLine[] | null) ?? [],
    deductions: (line.deductions as PayslipComponentLine[] | null) ?? [],
    adjustments: line.adjustments.map((a) => ({
      label: a.label,
      amount: Number(a.amount),
      reason: a.reason,
    })),
    gross: Number(line.gross),
    deductionTotal: Number(line.deductionTotal),
    adjustmentTotal: Number(line.adjustmentTotal),
    net: Number(line.net),
    policyVersion: snapshot?.policyVersion ?? null,
    approvedAt: line.run.approvedAt?.toISOString() ?? null,
  };
}
