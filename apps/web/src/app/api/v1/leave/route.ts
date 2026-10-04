import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Leave Management API (GET & POST /api/v1/leave)
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      balances: [
        { type: "Paid Leave", key: "PL", total: 18, used: 6, available: 12 },
        { type: "Casual Leave", key: "CL", total: 12, used: 6, available: 6 },
        { type: "Sick Leave", key: "SL", total: 8, used: 4, available: 4 },
      ],
      requests: [
        {
          id: "req-01",
          type: "Casual Leave",
          startDate: "2026-10-12",
          endDate: "2026-10-13",
          daysCount: 2,
          reason: "Family function in Ajmer",
          status: "PENDING",
          appliedOn: "2026-10-04",
        },
        {
          id: "req-02",
          type: "Paid Leave",
          startDate: "2026-09-18",
          endDate: "2026-09-20",
          daysCount: 3,
          reason: "Personal travel",
          status: "APPROVED",
          appliedOn: "2026-09-10",
        },
      ],
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { leaveType, startDate, endDate, reason, isHalfDay } = body;

    if (!leaveType || !startDate || !endDate) {
      return NextResponse.json(
        { ok: false, error: "Leave type, start date, and end date are required." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Leave request for ${leaveType} (${startDate} to ${endDate}) submitted to manager for approval.`,
      request: {
        id: `req-${Date.now()}`,
        type: leaveType,
        startDate,
        endDate,
        reason: reason || "No reason provided",
        isHalfDay: Boolean(isHalfDay),
        status: "PENDING",
        appliedOn: new Date().toISOString().split("T")[0],
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to submit leave";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
