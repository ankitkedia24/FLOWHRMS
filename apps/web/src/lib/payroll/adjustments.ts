import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { AppSession } from "@/lib/auth/types";
import { recordAuditEvent } from "@/lib/audit";

/**
 * The one way money changes on a payroll line — including after approval
 * (Constitution §6). Extracted from `addAdjustmentAction` so that it can
 * run inside a caller’s transaction; the action is now a thin wrapper.
 *
 * Deliberately permission-free: the CALLER decides who may reach this.
 * `addAdjustmentAction` demands `payroll.edit`; the Expenses settlement
 * seam (EXPENSES-MODULE.md §13) reaches it without any payroll permission,
 * because a settler records a reimbursement and learns nothing about pay.
 * Do not add a payroll permission check here — that boundary is intended.
 */

/** The client or a transaction client — whichever the caller holds. */
export type PayrollWriter = Pick<
  PrismaClient,
  "payrollLine" | "payrollAdjustment" | "payrollRun" | "auditEvent"
>;

export interface RecordAdjustmentInput {
  lineId: string;
  label: string;
  /** Signed: positive adds to net pay, negative reduces it. Whole rupees. */
  amount: number;
  reason: string;
}

export type RecordAdjustmentResult =
  | {
      ok: true;
      adjustmentId: string;
      lineId: string;
      runId: string;
      runStatus: "DRAFT" | "APPROVED";
      periodMonth: Date;
      membershipId: string;
      employeeName: string;
      previousNet: number;
      net: number;
    }
  | { ok: false; error: string };

export async function recordAdjustment(
  db: PayrollWriter,
  session: AppSession,
  input: RecordAdjustmentInput,
): Promise<RecordAdjustmentResult> {
  const line = await db.payrollLine.findFirst({
    where: { id: input.lineId, tenantId: session.tenant.id }, // tenant-scoped
    include: { run: true, membership: { include: { user: true } } },
  });
  if (!line) return { ok: false, error: "That payroll line is no longer available." };

  const adjustment = await db.payrollAdjustment.create({
    data: {
      tenantId: session.tenant.id,
      lineId: line.id,
      label: input.label,
      amount: input.amount,
      reason: input.reason,
      createdById: session.user.id,
    },
  });

  // Adjustments change net pay only; gross and deductions stand as
  // calculated so the original figures remain visible.
  const total = await db.payrollAdjustment.aggregate({
    where: { lineId: line.id },
    _sum: { amount: true },
  });
  const adjustmentTotal = Number(total._sum.amount ?? 0);
  const previousNet = Number(line.net);
  const net = Number(line.gross) - Number(line.deductionTotal) + adjustmentTotal;

  await db.payrollLine.update({
    where: { id: line.id },
    data: { adjustmentTotal, net },
  });

  const runTotals = await db.payrollLine.aggregate({
    where: { runId: line.runId },
    _sum: { net: true },
  });
  await db.payrollRun.update({
    where: { id: line.runId },
    data: { netTotal: Number(runTotals._sum.net ?? 0) },
  });

  await recordAuditEvent(
    session,
    {
      action: "payroll.adjustment_added",
      entityType: "payroll_line",
      entityId: line.id,
      reason: input.reason,
      before: { net: previousNet },
      after: {
        net,
        adjustment: { label: input.label, amount: input.amount },
        adjustmentId: adjustment.id,
        runStatus: line.run.status,
      },
    },
    db,
  );

  return {
    ok: true,
    adjustmentId: adjustment.id,
    lineId: line.id,
    runId: line.runId,
    runStatus: line.run.status,
    periodMonth: line.run.periodMonth,
    membershipId: line.membershipId,
    employeeName: line.membership.user.displayName,
    previousNet,
    net,
  };
}
