"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { clearActionRequest, raiseTaskProof, SUBJECT } from "@/lib/actions/raise";
import { checkAccess } from "@/lib/authz/guard";
import { awardForTaskCompletion } from "@/lib/performance/award";

/**
 * Task server actions.
 *
 * Enforced here (user-flows.md §5, edge-cases.md):
 * - A task with a proof requirement can NEVER reach Completed without
 *   proof on file — checked server-side, not in the UI.
 * - Reject proof always requires a reason.
 * - First decision wins; the second reviewer is told who decided.
 * - Proof types respect their feature flags at creation time.
 */

export type ActionResult =
  | { ok: true; message: string; detail?: string }
  | { ok: false; error: string };

const createSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title.").max(200),
  description: z.string().trim().max(2000).optional(),
  assigneeId: z.string().uuid("Choose who this is for."),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  proofRequirement: z.enum(["NONE", "PHOTO", "FILE"]),
});

export async function createTaskAction(
  input: z.input<typeof createSchema>,
): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the task details.",
    };
  }

  const { session, decision } = await checkAccess({
    module: "TASKS",
    permission: "tasks.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  // Proof type must be an enabled feature (flags are enforced server-side).
  if (parsed.data.proofRequirement !== "NONE") {
    const feature =
      parsed.data.proofRequirement === "PHOTO" ? "proof_photo" : "proof_file";
    const proofAccess = await checkAccess({ module: "TASKS", feature });
    if (!proofAccess.decision.allowed) {
      return {
        ok: false,
        error: "That proof type is turned off for your company.",
      };
    }
  }

  const db = getDb();
  // The assignee must belong to this tenant (isolation, Constitution §2).
  const assignee = await db.tenantMembership.findFirst({
    where: {
      id: parsed.data.assigneeId,
      tenantId: session.tenant.id,
      status: "ACTIVE",
    },
    include: { user: true },
  });
  if (!assignee) {
    return { ok: false, error: "That employee is no longer available." };
  }

  const task = await db.task.create({
    data: {
      tenantId: session.tenant.id,
      createdById: session.membership.id,
      assigneeId: assignee.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      dueDate: parsed.data.dueDate
        ? new Date(`${parsed.data.dueDate}T00:00:00.000Z`)
        : null,
      proofRequirement: parsed.data.proofRequirement,
    },
  });

  await recordAuditEvent(session, {
    action: "task.created",
    entityType: "task",
    entityId: task.id,
    after: {
      title: task.title,
      assignee: assignee.user.displayName,
      priority: task.priority,
      proofRequirement: task.proofRequirement,
    },
  });

  await notify.taskAssigned(session, assignee.userId, task.title, task.id);

  revalidatePath("/admin/tasks");
  revalidatePath("/tasks");

  return {
    ok: true,
    message: `Task assigned to ${assignee.user.displayName}.`,
  };
}

const startSchema = z.object({ taskId: z.string().uuid() });

export async function startTaskAction(
  input: z.input<typeof startSchema>,
): Promise<ActionResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That task could not be read." };

  const { session, decision } = await checkAccess({ module: "TASKS" });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const task = await db.task.findFirst({
    where: {
      id: parsed.data.taskId,
      tenantId: session.tenant.id,
      assigneeId: session.membership.id, // own tasks only
    },
  });
  if (!task) return { ok: false, error: "That task is no longer available." };
  if (task.status !== "NOT_STARTED") {
    return { ok: true, message: "This task is already started." };
  }

  await db.task.update({
    where: { id: task.id },
    data: { status: "IN_PROGRESS", startedAt: new Date() },
  });

  await recordAuditEvent(session, {
    action: "task.started",
    entityType: "task",
    entityId: task.id,
    before: { status: task.status },
    after: { status: "IN_PROGRESS" },
  });

  revalidatePath("/tasks");
  revalidatePath("/home");

  return { ok: true, message: "Task started." };
}

const submitSchema = z.object({
  taskId: z.string().uuid(),
  note: z.string().trim().max(1000).optional(),
  /** Idempotency key + original time for proof queued offline. */
  clientRequestId: z.string().uuid().optional(),
  clientCapturedAt: z.string().datetime().optional(),
  files: z
    .array(
      z.object({
        path: z.string().min(1),
        name: z.string().min(1),
        mime: z.string().min(1),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .max(5)
    .optional(),
});

export async function submitProofAction(
  input: z.input<typeof submitSchema>,
): Promise<ActionResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That submission could not be read." };

  const { session, decision } = await checkAccess({ module: "TASKS" });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();

  // Proof queued offline may be retried; returning the existing record
  // makes a duplicate submission impossible.
  if (parsed.data.clientRequestId) {
    const already = await db.taskProof.findUnique({
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
        message: "Proof sent for review.",
        detail: "This was already sent.",
      };
    }
  }

  const task = await db.task.findFirst({
    where: {
      id: parsed.data.taskId,
      tenantId: session.tenant.id,
      assigneeId: session.membership.id,
    },
    include: { createdBy: true },
  });
  if (!task) return { ok: false, error: "That task is no longer available." };

  const files = parsed.data.files ?? [];

  // A task requiring proof cannot be completed without proof on file.
  if (task.proofRequirement !== "NONE" && files.length === 0) {
    return {
      ok: false,
      error:
        task.proofRequirement === "PHOTO"
          ? "Add a photo before sending this for review."
          : "Add a file before sending this for review.",
    };
  }

  const proof = await db.taskProof.create({
    data: {
      tenantId: session.tenant.id,
      taskId: task.id,
      submittedById: session.membership.id,
      note: parsed.data.note || null,
      clientRequestId: parsed.data.clientRequestId,
      clientCapturedAt: parsed.data.clientCapturedAt
        ? new Date(parsed.data.clientCapturedAt)
        : null,
      files: files.length
        ? {
            create: files.map((file) => ({
              tenantId: session.tenant.id,
              path: file.path,
              name: file.name,
              mime: file.mime,
              sizeBytes: file.sizeBytes,
            })),
          }
        : undefined,
    },
  });

  // No proof requirement and no files: completing directly is allowed.
  const nextStatus =
    task.proofRequirement === "NONE" && files.length === 0
      ? "COMPLETED"
      : "SUBMITTED_FOR_REVIEW";

  await db.task.update({
    where: { id: task.id },
    data: {
      status: nextStatus,
      completedAt: nextStatus === "COMPLETED" ? new Date() : null,
    },
  });

  await recordAuditEvent(session, {
    action: "task.proof_submitted",
    entityType: "task",
    entityId: task.id,
    after: { proofId: proof.id, files: files.length, status: nextStatus },
  });

  await notify.proofSubmitted(
    session,
    task.createdBy.userId,
    task.title,
    task.id,
  );
  if (nextStatus === "SUBMITTED_FOR_REVIEW") {
    await raiseTaskProof(
      session,
      task.id,
      session.membership.id,
      session.user.displayName,
      task.title,
    );
  } else {
    // Completed directly (no proof requirement) — final now, so it scores
    // now. Proof-gated tasks score when the review approves them.
    await awardForTaskCompletion({
      session,
      assigneeMembershipId: session.membership.id,
      taskId: task.id,
      completedAt: new Date(),
      dueDate: task.dueDate,
      dueMinutes: task.dueMinutes,
      priority: task.priority,
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/home");
  revalidatePath("/admin/tasks");

  return nextStatus === "COMPLETED"
    ? { ok: true, message: "Task marked complete." }
    : {
        ok: true,
        message: "Proof sent for review.",
        detail: "You'll get a note when it's reviewed.",
      };
}

const reviewSchema = z.object({
  taskId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED", "DETAILS_REQUESTED"]),
  reason: z.string().trim().max(500).optional(),
});

export async function reviewProofAction(
  input: z.input<typeof reviewSchema>,
): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That decision could not be read." };

  const { session, decision: access } = await checkAccess({
    module: "TASKS",
    permission: "tasks.manage",
  });
  if (!access.allowed) {
    return { ok: false, error: access.message ?? "You don't have access to this." };
  }

  const reason = parsed.data.reason?.trim();
  if (parsed.data.decision === "REJECTED" && !reason) {
    return { ok: false, error: "Rejecting proof needs a reason." };
  }

  const db = getDb();
  const task = await db.task.findFirst({
    where: { id: parsed.data.taskId, tenantId: session.tenant.id },
    include: {
      assignee: { include: { user: true } },
      proofs: { orderBy: { submittedAt: "desc" }, take: 1 },
    },
  });
  if (!task) return { ok: false, error: "That task is no longer available." };

  const proof = task.proofs[0];
  if (!proof) return { ok: false, error: "There is no proof to review yet." };

  // First decision wins (edge-cases.md).
  if (proof.decision !== "PENDING") {
    return {
      ok: false,
      error: "This proof has already been reviewed. See the activity log.",
    };
  }

  await db.taskProof.update({
    where: { id: proof.id },
    data: {
      decision: parsed.data.decision,
      decidedById: session.membership.id,
      decidedAt: new Date(),
      decisionReason: reason,
    },
  });

  const nextStatus =
    parsed.data.decision === "APPROVED" ? "COMPLETED" : "IN_PROGRESS";

  await db.task.update({
    where: { id: task.id },
    data: {
      status: nextStatus,
      completedAt: nextStatus === "COMPLETED" ? new Date() : null,
    },
  });

  await recordAuditEvent(session, {
    action: `task.proof_${parsed.data.decision.toLowerCase()}`,
    entityType: "task",
    entityId: task.id,
    reason,
    before: { status: task.status },
    after: { status: nextStatus, decision: parsed.data.decision },
  });

  await clearActionRequest(
    session,
    SUBJECT.taskProof,
    task.id,
    parsed.data.decision,
  );

  // Approved proof makes the completion final — points go to the ASSIGNEE
  // (the session here belongs to the reviewer). First-time-right means no
  // earlier "details requested" round on this task.
  if (parsed.data.decision === "APPROVED") {
    const detailRounds = await db.taskProof.count({
      where: { taskId: task.id, decision: "DETAILS_REQUESTED" },
    });
    await awardForTaskCompletion({
      session,
      assigneeMembershipId: task.assigneeId,
      taskId: task.id,
      completedAt: new Date(),
      dueDate: task.dueDate,
      dueMinutes: task.dueMinutes,
      priority: task.priority,
      proof: { firstTimeRight: detailRounds === 0 },
    });
  }

  await notify.proofDecision(
    session,
    task.assignee.userId,
    task.title,
    task.id,
    parsed.data.decision,
    reason,
  );

  revalidatePath("/admin/tasks");
  revalidatePath("/tasks");

  const name = task.assignee.user.displayName;
  if (parsed.data.decision === "APPROVED") {
    return { ok: true, message: `Approved. The task is marked Completed.` };
  }
  if (parsed.data.decision === "REJECTED") {
    return { ok: true, message: `Rejected. ${name} has been told why.` };
  }
  return { ok: true, message: `Details requested from ${name}.` };
}
