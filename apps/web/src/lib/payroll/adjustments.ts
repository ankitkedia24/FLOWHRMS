import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { AppSession } from "@/lib/auth/types";
import { recordAuditEvent } from "@/lib/audit";
import { lockPayrollRun } from "./lock";

/**
 * The one way money changes on a DRAFT payroll line (Constitution §6).
 * Extracted from `addAdjustmentAction` so that it can run inside a
 * caller’s transaction; the action is now a thin wrapper.
 *
 * Never on an approved run (owner decision, hardening batch 4): approval
 * fixes what the payslips say, so a later change goes into a later
 * month's run. The run's row is LOCKED and its status re-read before
 * anything is written, so an approval committing at the same moment
 * cannot receive this adjustment — callers must pass their transaction.
 *
 * Deliberately permission-free: the CALLER decides who may reach this.
 * `addAdjustmentAction` demands `payroll.edit`; the Expenses settlement
 * seam (EXPENSES-MODULE.md §13) reaches it without any payroll permission,
 * because a settler records a reimbursement and learns nothing about pay.
 * Do not add a payroll permission check here — that boundary is intended.
 */

export const APPROVED_RUN_ADJUSTMENT_ERROR =
  "This month's payroll is approved; add it to next month instead.";

/** The transaction client (or the client) — whichever the caller holds. */
export type PayrollWriter = Pick<
  PrismaClient,
  "payrollLine" | "payrollAdjustment" | "payrollRun" | "auditEvent" | "$queryRaw"
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
  const tenantId = session.tenant.id;
  const gone = { ok: false as const, error: "That payroll line is no longer available." };

  const found = await db.payrollLine.findFirst({
    where: { id: input.lineId, tenantId }, // tenant-scoped
    select: { runId: true },
  });
  if (!found) return gone;

  // Lock the run, then read its status and the line again under the lock:
  // an approval, or a recalculation that removed this line, may have
  // committed since the read above.
  const run = await lockPayrollRun(db, tenantId, found.runId);
  if (!run) return gone;
  if (run.status === "APPROVED") return { ok: false, error: APPROVED_RUN_ADJUSTMENT_ERROR };

  const line = await db.payrollLine.findFirst({
    where: { id: input.lineId, tenantId },
    include: { run: true, membership: { include: { user: true } } },
  });
  if (!line) return gone;

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
    periodMonth: line.run.periodMonth,
    membershipId: line.membershipId,
    employeeName: line.membership.user.displayName,
    previousNet,
    net,
  };
}
