"use server";

import { revalidatePath } from "next/cache";
import { recordAdjustment } from "./adjustments";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { getPolicyVersion } from "@/lib/policies";
import { periodLabel, runBlockers, runExclusions } from "./engine";
import {
  compareRunLines,
  lineFigures,
  planLineWrites,
  storedLineFigures,
  type LineFigures,
} from "./lines";
import { lockPayrollRun } from "./lock";
import { buildPayrollPreview, type PayrollPreview } from "./service";

/**
 * Payroll server actions (Constitution §6).
 *
 * Enforced here, never only in the UI:
 * - Figures are RE-COMPUTED server-side; the client cannot submit totals.
 * - Attendance nobody has decided yet blocks Calculate and Approve.
 * - A run cannot be approved while any line has negative net pay, and
 *   employees with no salary structure are named as excluded.
 * - Approval requires a reason AND the accountant acknowledgement.
 * - Approval approves the STORED lines — the ones payslips are read from —
 *   and only when a fresh calculation matches them exactly.
 * - Approval LOCKS the period: it is never recalculated, overwritten or
 *   adjusted again. Later changes go into a later month as an adjustment.
 * - Calculate, Approve and adjustments each run in ONE transaction that
 *   first takes the run's row lock (src/lib/payroll/lock.ts), so none of
 *   them can act on a status another has just changed.
 */

export type ActionResult =
  | { ok: true; message: string; detail?: string }
  | { ok: false; error: string };

/**
 * Room for a whole company's lines in one transaction: the preview and
 * one write per person all happen while the run's lock is held.
 */
const TX = { timeout: 60_000, maxWait: 10_000 };

const FIGURES_CHANGED =
  "Figures changed since you calculated — calculate again, then approve.";

/**
 * Prisma's Json input type requires an index signature, which our precise
 * domain interfaces deliberately lack. Round-tripping guarantees the value
 * really is plain JSON before it is stored.
 */
type JsonInput = Parameters<typeof JSON.stringify>[0];
function toJson<T>(value: T): JsonInput {
  return JSON.parse(JSON.stringify(value));
}

const periodSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, "Choose a payroll month."),
});

function toPeriodDate(period: string): Date {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

/** The preview's lines as Calculate stores them. */
function freshLines(preview: PayrollPreview): LineFigures[] {
  return preview.lines.map((line) => lineFigures(line, preview.calendarDays));
}

/** One line's stored columns (everything but its keys). */
function lineData(line: LineFigures) {
  return {
    status: line.status,
    statusReason: line.statusReason,
    calendarDays: line.calendarDays,
    workingDays: line.workingDays,
    weeklyOffDays: line.weeklyOffDays,
    holidayDays: line.holidayDays,
    presentDays: line.presentDays,
    paidLeaveDays: line.paidLeaveDays,
    unpaidDays: line.unpaidDays,
    payableDays: line.payableDays,
    lateMinutes: line.lateMinutes,
    lateDeductionDays: line.lateDeductionDays,
    earnings: toJson(line.earnings),
    deductions: toJson(line.deductions),
    gross: line.gross,
    deductionTotal: line.deductionTotal,
    adjustmentTotal: line.adjustmentTotal,
    net: line.net,
  };
}

/** Two Calculates creating the same month at once: one wins, one retries. */
function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

/**
 * Calculate (or recalculate) a DRAFT run and persist its lines — in one
 * transaction, under the run's row lock. Lines of people no longer in the
 * preview are deleted (kept, zeroed and left out, only when adjustments
 * hang off them — src/lib/payroll/lines.ts). Never touches an approved run.
 */
export async function calculatePayrollAction(
  input: z.input<typeof periodSchema>,
): Promise<ActionResult> {
  const parsed = periodSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a payroll month." };

  const { session, decision } = await checkAccess({
    module: "PAYROLL",
    permission: "payroll.edit",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to Payroll." };
  }

  const db = getDb();
  const tenantId = session.tenant.id;
  const periodMonth = toPeriodDate(parsed.data.period);
  const label = periodLabel(periodMonth, session.tenant.timezone);
  const policyVersion = await getPolicyVersion(tenantId, "payroll");

  let outcome: ActionResult;
  try {
    outcome = await db.$transaction(async (tx): Promise<ActionResult> => {
      const existing = await tx.payrollRun.findUnique({
        where: { tenantId_periodMonth: { tenantId, periodMonth } },
        select: { id: true },
      });
      if (existing) {
        // Status read under the lock: an approval that committed a moment
        // ago is seen here, and one that starts now waits for us.
        const locked = await lockPayrollRun(tx, tenantId, existing.id);
        if (!locked) return { ok: false, error: "That payroll month changed. Try again." };
        if (locked.status === "APPROVED") {
          return {
            ok: false,
            error: `${label} payroll is approved and locked. Add later changes to next month's payroll as an adjustment.`,
          };
        }
      }

      const preview = await buildPayrollPreview(session, periodMonth, tx);
      if (preview.attendanceBlocker) {
        // Nothing written: a refused Calculate leaves no empty run behind.
        return {
          ok: false,
          error: `${label} payroll can't be calculated yet. ${preview.attendanceBlocker} Decide them on the Attendance page first.`,
        };
      }

      const runData = {
        calculatedAt: new Date(),
        grossTotal: preview.grossTotal,
        deductionTotal: preview.deductionTotal,
        netTotal: preview.netTotal,
        inputsSnapshot: toJson({
          latePolicy: preview.latePolicy,
          policyVersion,
          calendarDays: preview.calendarDays,
          unreviewedExceptions: preview.unreviewedExceptions,
        }),
      };
      // A brand-new run has no lines or adjustments to race with; if another
      // Calculate creates it first, the unique key refuses this one.
      const run = existing
        ? await tx.payrollRun.update({ where: { id: existing.id }, data: runData })
        : await tx.payrollRun.create({
            data: { tenantId, periodMonth, status: "DRAFT", ...runData },
          });

      const stored = existing
        ? await tx.payrollLine.findMany({
            where: { runId: run.id, tenantId },
            select: { id: true, membershipId: true, _count: { select: { adjustments: true } } },
          })
        : [];
      const plan = planLineWrites(
        freshLines(preview),
        stored.map((s) => ({
          id: s.id,
          membershipId: s.membershipId,
          adjustmentCount: s._count.adjustments,
        })),
        preview.calendarDays,
      );

      if (plan.remove.length > 0) {
        await tx.payrollLine.deleteMany({
          where: { id: { in: plan.remove }, runId: run.id, tenantId },
        });
      }
      // Upsert keeps each person's line id — adjustments and payslip links
      // hang off it. Adjustments live on their own table and are re-applied
      // by the engine, so they survive.
      for (const line of plan.write) {
        const data = lineData(line);
        await tx.payrollLine.upsert({
          where: { runId_membershipId: { runId: run.id, membershipId: line.membershipId } },
          update: data,
          create: { tenantId, runId: run.id, membershipId: line.membershipId, ...data },
        });
      }

      await recordAuditEvent(
        session,
        {
          action: "payroll.calculated",
          entityType: "payroll_run",
          entityId: run.id,
          after: {
            period: parsed.data.period,
            lines: preview.lines.length,
            removedLines: plan.remove.length,
            netTotal: preview.netTotal,
            policyVersion,
          },
        },
        tx,
      );

      return {
        ok: true,
        message: `${label} payroll calculated.`,
        detail: `${preview.lines.filter((l) => l.status === "READY").length} employees ready for review.`,
      };
    }, TX);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: `Someone else is calculating ${label} payroll right now. Try again in a moment.`,
      };
    }
    throw error;
  }

  if (outcome.ok) revalidatePath("/admin/payroll");
  return outcome;
}

const approveSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  reason: z.string().trim().min(1, "A reason is required."),
  accountantAcknowledged: z.boolean(),
});

/**
 * Approve and LOCK a period. One transaction under the run's row lock:
 * re-compute the preview, refuse on any blocker, then approve only when
 * the stored lines (what payslips show) match the fresh calculation
 * exactly (`compareRunLines`). Anything else — a changed input, someone
 * who joined or left — is "calculate again", never a silent overwrite.
 */
export async function approvePayrollAction(
  input: z.input<typeof approveSchema>,
): Promise<ActionResult> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the approval details.",
    };
  }

  const { session, decision } = await checkAccess({
    module: "PAYROLL",
    permission: "payroll.approve",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to Payroll." };
  }

  if (!parsed.data.accountantAcknowledged) {
    return {
      ok: false,
      error:
        "Confirm you have checked these figures with your accountant. FlowHRMS does not certify statutory compliance.",
    };
  }

  const db = getDb();
  const tenantId = session.tenant.id;
  const periodMonth = toPeriodDate(parsed.data.period);
  const label = periodLabel(periodMonth, session.tenant.timezone);
  const policyVersion = await getPolicyVersion(tenantId, "payroll");
  const notCalculated = { ok: false as const, error: `Calculate ${label} payroll before approving it.` };

  const outcome = await db.$transaction(async (tx): Promise<ActionResult> => {
    const existing = await tx.payrollRun.findUnique({
      where: { tenantId_periodMonth: { tenantId, periodMonth } },
      select: { id: true },
    });
    if (!existing) return notCalculated;
    const run = await lockPayrollRun(tx, tenantId, existing.id);
    if (!run) return notCalculated;
    // The second approver is told who got there first.
    if (run.status === "APPROVED") {
      return {
        ok: false,
        error: `${label} payroll is already approved. See the activity log.`,
      };
    }

    // Re-compute server-side; the client never submits the figures.
    const preview = await buildPayrollPreview(session, periodMonth, tx);
    if (preview.attendanceBlocker) {
      return {
        ok: false,
        error: `Payroll can't be approved. ${preview.attendanceBlocker} Decide them on the Attendance page first.`,
      };
    }

    const named = preview.lines.map((l) => ({
      name: l.name,
      status: l.status,
      net: l.result?.net ?? 0,
    }));
    const blockers = runBlockers(named);
    if (blockers.length > 0) {
      const first = blockers[0];
      return {
        ok: false,
        error: `Payroll can't be approved. ${first.membershipName}: ${first.reason}`,
      };
    }

    // Payslips read the stored lines, so those are what gets approved —
    // and only if recalculating now would change nothing about them.
    const stored = await tx.payrollLine.findMany({
      where: { runId: run.id, tenantId },
      include: { _count: { select: { adjustments: true } } },
    });
    const plan = planLineWrites(
      freshLines(preview),
      stored.map((s) => ({
        id: s.id,
        membershipId: s.membershipId,
        adjustmentCount: s._count.adjustments,
      })),
      preview.calendarDays,
    );
    const differences = compareRunLines(stored.map(storedLineFigures), plan.write);
    if (differences.length > 0) return { ok: false, error: FIGURES_CHANGED };

    const excluded = runExclusions(named);
    const payableLines = preview.lines.filter((l) => l.status === "READY");

    await tx.payrollRun.update({
      where: { id: run.id },
      data: {
        status: "APPROVED",
        approvedById: session.membership.id,
        approvedAt: new Date(),
        approvalReason: parsed.data.reason,
        accountantAcknowledged: true,
        grossTotal: preview.grossTotal,
        deductionTotal: preview.deductionTotal,
        netTotal: preview.netTotal,
        inputsSnapshot: toJson({
          latePolicy: preview.latePolicy,
          policyVersion,
          calendarDays: preview.calendarDays,
          unreviewedExceptions: preview.unreviewedExceptions,
          excluded,
        }),
      },
    });

    await recordAuditEvent(
      session,
      {
        action: "payroll.approved",
        entityType: "payroll_run",
        entityId: run.id,
        reason: parsed.data.reason,
        before: { status: "DRAFT" },
        after: {
          status: "APPROVED",
          period: parsed.data.period,
          employees: payableLines.length,
          netTotal: preview.netTotal,
          excluded,
          unreviewedExceptions: preview.unreviewedExceptions,
          policyVersion,
          accountantAcknowledged: true,
        },
      },
      tx,
    );

    return {
      ok: true,
      message: `${label} payroll approved and locked. ${payableLines.length} payslips ready.`,
      detail:
        excluded.length > 0
          ? `${excluded.length} employee(s) excluded: ${excluded.join(", ")}.`
          : undefined,
    };
  }, TX);

  if (outcome.ok) {
    revalidatePath("/admin/payroll");
    revalidatePath("/payslips");
  }
  return outcome;
}

const adjustmentSchema = z.object({
  lineId: z.string().uuid(),
  label: z.string().trim().min(1, "Name the adjustment.").max(120),
  amount: z.number().finite(),
  reason: z.string().trim().min(1, "A reason is required.").max(500),
});

/**
 * The only sanctioned way to change money on a DRAFT run. Never overwrites
 * a calculated figure, and refuses an approved run — a later change goes
 * into next month's payroll (src/lib/payroll/adjustments.ts).
 */
export async function addAdjustmentAction(
  input: z.input<typeof adjustmentSchema>,
): Promise<ActionResult> {
  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the adjustment.",
    };
  }

  const { session, decision } = await checkAccess({
    module: "PAYROLL",
    permission: "payroll.edit",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to Payroll." };
  }

  // One transaction: the run lock, the adjustment, the line, the run total
  // and the audit event land together or not at all.
  const result = await getDb().$transaction(
    (tx) => recordAdjustment(tx, session, parsed.data),
    TX,
  );
  if (!result.ok) return result;

  revalidatePath("/admin/payroll");

  return {
    ok: true,
    message: `Adjustment recorded for ${result.employeeName}.`,
  };
}
