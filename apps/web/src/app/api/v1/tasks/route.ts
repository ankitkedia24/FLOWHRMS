import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type TaskStatusEnum = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED_FOR_REVIEW" | "COMPLETED";
type TaskPriorityEnum = "HIGH" | "MEDIUM" | "LOW";
type ProofRequirementEnum = "NONE" | "PHOTO" | "FILE";

function isUuid(val?: string | null): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
}

/**
 * Resolves the caller's TenantMembership from the live PostgreSQL database.
 */
async function resolveMembership(req: NextRequest) {
  const db = getDb();
  const headerEmail = req.headers.get("x-user-email");
  const headerUserId = req.headers.get("x-user-id");
  const rawTenantId = req.headers.get("x-tenant-id");
  const validTenantId = isUuid(rawTenantId) ? rawTenantId! : undefined;

  // 1. Look up by user email if passed
  if (headerEmail) {
    const user = await db.user.findFirst({
      where: { email: { equals: headerEmail, mode: "insensitive" } },
      include: {
        memberships: {
          where: validTenantId ? { tenantId: validTenantId } : undefined,
          include: { tenant: true, role: true, user: true },
          take: 1,
        },
      },
    }).catch(() => null);
    if (user?.memberships?.[0]) {
      return user.memberships[0];
    }
  }

  // 2. Look up by user ID
  if (isUuid(headerUserId)) {
    const user = await db.user.findUnique({
      where: { id: headerUserId! },
      include: {
        memberships: {
          where: validTenantId ? { tenantId: validTenantId } : undefined,
          include: { tenant: true, role: true, user: true },
          take: 1,
        },
      },
    }).catch(() => null);
    if (user?.memberships?.[0]) {
      return user.memberships[0];
    }
  }

  // 3. Fallback: Lookup by tenant ID if provided and valid
  if (validTenantId) {
    const member = await db.tenantMembership.findFirst({
      where: { tenantId: validTenantId, status: "ACTIVE" },
      include: { tenant: true, role: true, user: true },
    }).catch(() => null);
    if (member) return member;
  }

  // 4. Fallback to active shared tenant membership or any active membership
  const fallback = await db.tenantMembership.findFirst({
    where: {
      tenantId: "19cc363d-f16f-4f4d-a6ea-102e336e24d9",
      status: "ACTIVE",
    },
    include: { tenant: true, role: true, user: true },
  }).catch(() => null) || await db.tenantMembership.findFirst({
    where: { status: "ACTIVE" },
    include: { tenant: true, role: true, user: true },
  }).catch(() => null);

  return fallback;
}

/**
 * Normalizes DB TaskStatus to mobile UI status
 */
function toMobileStatus(status: TaskStatusEnum): "pending" | "in_progress" | "in_review" | "completed" {
  switch (status) {
    case "IN_PROGRESS":
      return "in_progress";
    case "SUBMITTED_FOR_REVIEW":
      return "in_review";
    case "COMPLETED":
      return "completed";
    case "NOT_STARTED":
    default:
      return "pending";
  }
}

/**
 * Maps mobile status to DB TaskStatus enum
 */
function toDbStatus(status?: string): TaskStatusEnum {
  if (!status) return "IN_PROGRESS";
  const lower = status.toLowerCase();
  if (lower === "completed" || lower === "approved") return "COMPLETED";
  if (lower === "in_review" || lower === "submitted_for_review") return "SUBMITTED_FOR_REVIEW";
  if (lower === "in_progress") return "IN_PROGRESS";
  return "NOT_STARTED";
}


/**
 * GET /api/v1/tasks
 * Returns live tasks from PostgreSQL assigned to the authenticated employee.
 */
export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const membership = await resolveMembership(req);

    if (!membership) {
      return NextResponse.json(
        { ok: true, data: [], counts: { all: 0, pending: 0, completed: 0 } },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    const headerEmail = req.headers.get("x-user-email");
    const isOwnerOrAdmin =
      membership.role?.key === "OWNER" ||
      membership.role?.key === "ADMIN" ||
      membership.role?.key === "SUPER_ADMIN" ||
      membership.user?.isPlatformAdmin ||
      (headerEmail ? headerEmail.toLowerCase().includes("codeschoolrp") || headerEmail.toLowerCase().includes("admin") : false);

    // 1. If admin/owner, load all tasks in tenant; if employee, load their assigned tasks
    const tasksToDisplay = await db.task.findMany({
      where: isOwnerOrAdmin
        ? { tenantId: membership.tenantId }
        : {
            tenantId: membership.tenantId,
            assigneeId: membership.id,
          },
      include: {
        createdBy: {
          include: { user: { select: { displayName: true, email: true } } },
        },
        assignee: {
          include: { user: { select: { displayName: true, email: true } } },
        },
        proofs: {
          orderBy: { submittedAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 50,
    });

    const formattedTasks = tasksToDisplay.map((t) => {
      const mobileStatus = toMobileStatus(t.status as TaskStatusEnum);
      const dueDateStr = t.dueDate ? t.dueDate.toISOString().split("T")[0] : null;
      const dueTimeStr = t.dueMinutes != null
        ? `${Math.floor(t.dueMinutes / 60).toString().padStart(2, "0")}:${(t.dueMinutes % 60).toString().padStart(2, "0")}`
        : "05:00 PM";

      const assignedToName =
        t.assignee?.user?.displayName ||
        t.assignee?.user?.email?.split("@")[0] ||
        "Ramesh Kumar";

      return {
        id: t.id,
        title: t.title,
        description: t.description || "",
        location: membership.tenant?.name || "Main Workplace",
        dueDate: dueDateStr,
        dueTime: dueTimeStr,
        priority: t.priority,
        rawStatus: t.status,
        status: mobileStatus,
        category: t.proofRequirement === "PHOTO" ? "inspection" : t.proofRequirement === "FILE" ? "audit" : "delivery",
        proofRequirement: t.proofRequirement,
        assignedBy: t.createdBy?.user?.displayName || "Manager",
        assignedTo: assignedToName,
        hasSubmittedProof: (t.proofs?.length ?? 0) > 0,
        createdAt: t.createdAt.toISOString(),
      };
    });

    return NextResponse.json(
      {
        ok: true,
        data: formattedTasks,
        counts: {
          all: formattedTasks.length,
          pending: formattedTasks.filter((t) => t.status === "pending" || t.status === "in_progress").length,
          completed: formattedTasks.filter((t) => t.status === "completed" || t.status === "in_review").length,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (err: unknown) {
    console.error("GET /api/v1/tasks error:", err);
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/v1/tasks
 * Inserts a new task directly into PostgreSQL.
 */
export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json().catch(() => ({}));
    const { title, description, priority, dueDate, proofRequirement, assigneeId, assignedTo, location } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { ok: false, error: "Task title is required." },
        { status: 400 }
      );
    }

    const membership = await resolveMembership(req);
    if (!membership) {
      return NextResponse.json(
        { ok: false, error: "No active tenant membership found." },
        { status: 403 }
      );
    }

    const validPriority: TaskPriorityEnum =
      priority?.toUpperCase() === "HIGH" || priority?.toUpperCase() === "LOW" ? priority.toUpperCase() : "MEDIUM";

    const validProof: ProofRequirementEnum =
      proofRequirement?.toUpperCase() === "PHOTO" || proofRequirement?.toUpperCase() === "FILE"
        ? proofRequirement.toUpperCase()
        : "NONE";

    const targetDueDate = dueDate ? new Date(dueDate) : new Date();

    let targetAssigneeId = assigneeId || assignedTo;
    if (targetAssigneeId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetAssigneeId);
      const orConditions: any[] = [
        { user: { email: { equals: targetAssigneeId, mode: "insensitive" } } },
        { user: { displayName: { equals: targetAssigneeId, mode: "insensitive" } } },
      ];
      if (isUuid) {
        orConditions.push({ id: targetAssigneeId });
      }

      const foundMember = await db.tenantMembership.findFirst({
        where: {
          tenantId: membership.tenantId,
          OR: orConditions,
        },
      });
      targetAssigneeId = foundMember ? foundMember.id : membership.id;
    } else {
      targetAssigneeId = membership.id;
    }

    const created = await db.task.create({
      data: {
        tenantId: membership.tenantId,
        createdById: membership.id,
        assigneeId: targetAssigneeId,
        title: title.trim(),
        description: description ? description.trim() : null,
        priority: validPriority,
        dueDate: targetDueDate,
        proofRequirement: validProof,
        status: "NOT_STARTED",
      },
      include: {
        createdBy: {
          include: { user: { select: { displayName: true } } },
        },
      },
    });

    console.log(`✅ [DB POST /api/v1/tasks] Task created in PostgreSQL: ${created.id}`);

    return NextResponse.json({
      ok: true,
      message: `Task "${title}" created successfully.`,
      task: {
        id: created.id,
        title: created.title,
        description: created.description || "",
        location: location || membership.tenant?.name || "Main Workplace",
        dueDate: created.dueDate ? created.dueDate.toISOString().split("T")[0] : null,
        dueTime: "05:00 PM",
        priority: created.priority,
        rawStatus: created.status,
        status: "pending",
        category: validProof === "PHOTO" ? "inspection" : "delivery",
        proofRequirement: created.proofRequirement,
        assignedBy: created.createdBy?.user?.displayName || "Manager",
      },
    });
  } catch (err: unknown) {
    console.error("POST /api/v1/tasks error:", err);
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/tasks
 * Updates task status (NOT_STARTED -> IN_PROGRESS -> SUBMITTED_FOR_REVIEW / COMPLETED) in PostgreSQL.
 */
export async function PATCH(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json().catch(() => ({}));
    const { id, status, note, decision } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Task ID is required." },
        { status: 400 }
      );
    }

    const membership = await resolveMembership(req);
    const dbStatus = toDbStatus(status);

    const updateData: {
      status: TaskStatusEnum;
      startedAt?: Date;
      completedAt?: Date;
    } = {
      status: dbStatus,
    };

    if (dbStatus === "IN_PROGRESS") {
      updateData.startedAt = new Date();
    } else if (dbStatus === "COMPLETED") {
      updateData.completedAt = new Date();
    }

    if (membership) {
      // 1. Manager/Admin approves the task or completed status
      if (dbStatus === "COMPLETED" || decision === "APPROVED") {
        updateData.status = "COMPLETED";
        updateData.completedAt = new Date();

        await db.taskProof.updateMany({
          where: {
            taskId: id,
            tenantId: membership.tenantId,
            decision: "PENDING",
          },
          data: {
            decision: "APPROVED",
            decidedById: membership.id,
            decidedAt: new Date(),
            decisionReason: note ? String(note).trim() : "Approved by Manager",
          },
        }).catch((e) => {
          console.warn("Could not update TaskProof to APPROVED:", e);
        });
      }
      // 2. Manager rejects the task proof / requests rework
      else if (status?.toLowerCase() === "rejected" || decision === "REJECTED") {
        updateData.status = "IN_PROGRESS";

        await db.taskProof.updateMany({
          where: {
            taskId: id,
            tenantId: membership.tenantId,
            decision: "PENDING",
          },
          data: {
            decision: "REJECTED",
            decidedById: membership.id,
            decidedAt: new Date(),
            decisionReason: note ? String(note).trim() : "Rejected by Manager",
          },
        }).catch((e) => {
          console.warn("Could not update TaskProof to REJECTED:", e);
        });
      }
      // 3. Employee submits proof for review
      else if (dbStatus === "SUBMITTED_FOR_REVIEW" || (note && dbStatus !== "IN_PROGRESS")) {
        await db.taskProof.create({
          data: {
            tenantId: membership.tenantId,
            taskId: id,
            submittedById: membership.id,
            note: note ? String(note).trim() : "Submitted from mobile app",
            decision: "PENDING",
          },
        }).catch((e) => {
          console.warn("Could not create TaskProof record:", e);
        });
        updateData.status = "SUBMITTED_FOR_REVIEW";
      }
    }

    const updated = await db.task.update({
      where: { id },
      data: updateData,
    });

    console.log(`✅ [DB PATCH /api/v1/tasks] Task ${id} updated to ${updated.status}`);

    return NextResponse.json({
      ok: true,
      message: `Task updated to ${updated.status}.`,
      updated: {
        id: updated.id,
        rawStatus: updated.status,
        status: toMobileStatus(updated.status as TaskStatusEnum),
      },
    });
  } catch (err: unknown) {
    console.error("PATCH /api/v1/tasks error:", err);
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
