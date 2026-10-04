import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Dashboard Summary (GET /api/v1/dashboard/summary)
 * Feeds both the Admin Operations Dashboard and Field Employee Mode.
 */
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({
      ok: true,
      data: {
        pulse: {
          presentToday: 0,
          totalEmployees: 2,
          exceptionsCount: 0,
          activeTasksCount: 3,
        },
        exceptionsReview: {
          pendingCount: 0,
          items: [],
          message: "No exceptions to review. All shift check-ins and locations are clear.",
        },
        payrollPreview: {
          period: "October 2026",
          status: "NOT_READY",
          payableEmployees: 1,
          description: "1 employee payable. Ready to compute based on approved attendance.",
        },
        openTasks: [
          {
            id: "task-01",
            title: "Morning Inventory Count",
            assignee: "Ramesh Kumar",
            dueTime: "11:00 AM",
            status: "ONGOING",
          },
          {
            id: "task-02",
            title: "Client Route Inspection",
            assignee: "Delivery Partner",
            dueTime: "02:30 PM",
            status: "PENDING",
          },
          {
            id: "task-03",
            title: "Warehouse Safety Audit",
            assignee: "Rishabh Kedia",
            dueTime: "05:00 PM",
            status: "ONGOING",
          },
        ],
        recentActivity: [
          {
            id: "act-01",
            title: "Shift Check-In",
            description: "Ramesh Kumar punched in at Jaipur Central Warehouse (GPS match)",
            time: "09:02 AM",
            type: "ATTENDANCE",
          },
          {
            id: "act-02",
            title: "Leave Approved",
            description: "Casual leave request approved by Admin for 08 Oct",
            time: "Yesterday",
            type: "LEAVE",
          },
        ],
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load dashboard summary";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
