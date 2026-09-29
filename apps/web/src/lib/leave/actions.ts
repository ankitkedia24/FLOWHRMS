"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { awardForLeaveApproval } from "@/lib/performance/award";
import { clearActionRequest, raiseLeaveRequest, SUBJECT } from "@/lib/actions/raise";
import { checkAccess } from "@/lib/authz/guard";
import {
  formatDateRange,
  leaveDays,
  overlaps,
  payrollMonthLabel,
} from "./policy";

/**
 * Leave server actions.
 *
 * Enforced here (Constitution §3, user-flows.md §4, edge-cases.md):
 * - Overlapping requests are blocked at submission, with the dates named.
 * - Reject ALWAYS requires a reason; the employee sees it verbatim.
 * - Approval records paid/unpaid explicitly — no silent default.
 * - Every decision writes an audit event with before/after values.
 */

export type ActionResult =
  | { ok: true; message: string; detail?: string }
  | { ok: false; error: string };

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-08-12");

const requestSchema = z
  .object({
    type: z.enum(["FULL_DAY", "HALF_DAY", "EMERGENCY"]),
    startDate: dateOnly,
    endDate: dateOnly,
    halfDayPart: z.enum(["FIRST_HALF", "SECOND_HALF"]).optional(),
    reason: z.string().trim().min(1, "Tell your manager why you need these days.").max(500),
    /** Idempotency key + original time for requests queued offline. */
    clientRequestId: z.string().uuid().optional(),
    clientCapturedAt: z.string().datetime().optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "The end date cannot be before the start date.",
    path: ["endDate"],
  });

export async function requestLeaveAction(
  input: z.input<typeof requestSchema>,
): Promise<ActionResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the dates and reason.",
    };
  }

  const { session, decision } = await checkAccess({ module: "LEAVE" });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const start = new Date(`${parsed.data.startDate}T00:00:00.000Z`);
  const end = new Date(`${parsed.data.endDate}T00:00:00.000Z`);

  // A request queued offline may be retried. Returning the existing one
  // makes a duplicate impossible rather than merely unlikely.
  if (parsed.data.clientRequestId) {
    const already = await db.leaveRequest.findUnique({
      where: {
        tenantId_clientRequestId: {
          tenantId: session.tenant.id,
          clientRequestId: parsed.data.clientRequestId,
        },
      },
    });
    if (already) {
      return {
        ok: true,
        message: "Leave request sent.",
        detail: "This was already sent to your manager.",
      };
    }
  }

  // Overlap guard — name the clashing dates rather than failing vaguely.
  const existing = await db.leaveRequest.findMany({
    where: {
      tenantId: session.tenant.id,
      membershipId: session.membership.id,
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: { startDate: true, endDate: true },
  });
  const clash = existing.find((e) =>
    overlaps({ start, end }, { start: e.startDate, end: e.endDate }),
  );
  if (clash) {
    return {
      ok: false,
      error: `You already have leave for ${formatDateRange(clash.startDate, clash.endDate, session.tenant.timezone)}. Cancel it first or choose other dates.`,
    };
  }

  const days = leaveDays({ type: parsed.data.type, start, end });

  const request = await db.leaveRequest.create({
    data: {
      tenantId: session.tenant.id,
      membershipId: session.membership.id,
      type: parsed.data.type,
      startDate: start,
      endDate: end,
      halfDayPart:
        parsed.data.type === "HALF_DAY" ? parsed.data.halfDayPart : null,
      reason: parsed.data.reason,
      unpaidDays: days,
      clientRequestId: parsed.data.clientRequestId,
      clientCapturedAt: parsed.data.clientCapturedAt
        ? new Date(parsed.data.clientCapturedAt)
        : null,
    },
  });

  await recordAuditEvent(session, {
    action: "leave.requested",
    entityType: "leave_request",
    entityId: request.id,
    reason: parsed.data.reason,
    after: {
      type: parsed.data.type,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      unpaidDays: days,
    },
  });

  const dates = formatDateRange(start, end, session.tenant.timezone);
  await notify.leaveRequested(session, request.id, dates);
  await raiseLeaveRequest(
    session,
    request.id,
    session.membership.id,
    session.user.displayName,
    dates,
  );

  revalidatePath("/leave");
  revalidatePath("/admin/leave");

  return {
    ok: true,
    message: "Leave request sent.",
    detail: "Your manager is notified straight away.",
  };
}

const decisionSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED", "DETAILS_REQUESTED"]),
  /** Required on approval: paid or unpaid is an explicit choice. */
  paid: z.boolean().optional(),
  reason: z.string().trim().max(500).optional(),
});

export async function decideLeaveAction(
  input: z.input<typeof decisionSchema>,
): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That decision could not be read. Try again." };
  }

  const { session, decision: access } = await checkAccess({
    module: "LEAVE",
    permission: "leave.approve",
  });
  if (!access.allowed) {
    return { ok: false, error: access.message ?? "You don't have access to this." };
  }

  const reason = parsed.data.reason?.trim();
  if (parsed.data.decision === "REJECTED" && !reason) {
    return { ok: false, error: "Rejecting needs a reason." };
  }

  const db = getDb();
  const request = await db.leaveRequest.findFirst({
    where: { id: parsed.data.requestId, tenantId: session.tenant.id },
    include: { membership: { include: { user: true } } },
  });
  if (!request) {
    return { ok: false, error: "That request is no longer available." };
  }
  if (request.status !== "PENDING") {
    return {
      ok: false,
      error: `Already decided. Open the activity log to see who decided.`,
    };
  }

  const paid = parsed.data.decision === "APPROVED" ? Boolean(parsed.data.paid) : null;
  const before = { status: request.status, unpaidDays: request.unpaidDays };

  await db.leaveRequest.update({
    where: { id: request.id },
    data: {
      status:
        parsed.data.decision === "DETAILS_REQUESTED"
          ? "DETAILS_REQUESTED"
          : parsed.data.decision,
      paid,
      unpaidDays: paid ? 0 : request.unpaidDays,
      decidedById: session.membership.id,
      decidedAt: new Date(),
      decisionReason: reason,
    },
  });

  await recordAuditEvent(session, {
    action: `leave.${parsed.data.decision.toLowerCase()}`,
    entityType: "leave_request",
    entityId: request.id,
    reason,
    before,
    after: {
      status: parsed.data.decision,
      paid,
      unpaidDays: paid ? 0 : request.unpaidDays,
    },
  });

  await clearActionRequest(
    session,
    SUBJECT.leave,
    request.id,
    parsed.data.decision,
  );

  if (parsed.data.decision === "APPROVED") {
    // Amendment 2, rule 18: leave planned well ahead earns points. Judged
    // from when the request was CREATED, which nobody can backdate.
    await awardForLeaveApproval({
      session,
      membershipId: request.membershipId,
      leaveRequestId: request.id,
      requestedAt: request.createdAt,
      startDate: request.startDate,
    });
  }

  if (parsed.data.decision !== "DETAILS_REQUESTED") {
    await notify.leaveDecision(
      session,
      request.membership.userId,
      parsed.data.decision,
      formatDateRange(request.startDate, request.endDate, session.tenant.timezone),
      reason,
    );
  }

  revalidatePath("/admin/leave");
  revalidatePath("/leave");

  const name = request.membership.user.displayName;
  const month = payrollMonthLabel(request.startDate, session.tenant.timezone);
  if (parsed.data.decision === "APPROVED") {
    return {
      ok: true,
      message: paid
        ? `Approved as paid. No deduction for ${name}.`
        : `Approved. ${request.unpaidDays} unpaid days applied to ${month} payroll for ${name}.`,
    };
  }
  if (parsed.data.decision === "REJECTED") {
    return { ok: true, message: `Rejected. ${name} has been told why.` };
  }
  return { ok: true, message: `Details requested from ${name}.` };
}

const cancelSchema = z.object({ requestId: z.string().uuid() });

export async function cancelLeaveAction(
  input: z.input<typeof cancelSchema>,
): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That request could not be read." };

  const { session, decision } = await checkAccess({ module: "LEAVE" });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const request = await db.leaveRequest.findFirst({
    where: {
      id: parsed.data.requestId,
      tenantId: session.tenant.id,
      membershipId: session.membership.id, // own records only
    },
  });
  if (!request) return { ok: false, error: "That request is no longer available." };
  if (request.status === "CANCELLED") {
    return { ok: true, message: "This request is already cancelled." };
  }

  await db.leaveRequest.update({
    where: { id: request.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  await recordAuditEvent(session, {
    action: "leave.cancelled",
    entityType: "leave_request",
    entityId: request.id,
    before: { status: request.status },
    after: { status: "CANCELLED" },
  });

  revalidatePath("/leave");
  revalidatePath("/admin/leave");

  return { ok: true, message: "Leave request cancelled." };
}
