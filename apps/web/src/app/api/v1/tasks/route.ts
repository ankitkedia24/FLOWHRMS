import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Tasks API (GET, POST, PATCH /api/v1/tasks)
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: [
      {
        id: "task-1",
        title: "Morning Inventory Count",
        description: "Verify stock pallets in Bay 4 and report batch differences",
        assignedTo: "Ramesh Kumar",
        priority: "HIGH",
        status: "ONGOING",
        dueDate: "Today, 11:00 AM",
      },
      {
        id: "task-2",
        title: "Client Route Inspection",
        description: "Deliver supplies to Mansarovar Hub and obtain customer sign-off",
        assignedTo: "Delivery Partner",
        priority: "MEDIUM",
        status: "PENDING",
        dueDate: "Today, 02:30 PM",
      },
      {
        id: "task-3",
        title: "Warehouse Safety Audit",
        description: "Check fire extinguisher inspections and emergency exit clearance",
        assignedTo: "Rishabh Kedia",
        priority: "LOW",
        status: "ONGOING",
        dueDate: "Today, 05:00 PM",
      },
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { title, description, assignedTo, priority, dueDate } = body;

    if (!title) {
      return NextResponse.json(
        { ok: false, error: "Task title is required." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Task "${title}" created and assigned.`,
      task: {
        id: `task-${Date.now()}`,
        title,
        description: description || "",
        assignedTo: assignedTo || "Field Specialist",
        priority: priority || "MEDIUM",
        status: "PENDING",
        dueDate: dueDate || "End of Shift",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create task";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { ok: false, error: "Task ID and updated status are required." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Task status updated to ${status}.`,
      updated: { id, status },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update task";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
