import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Module Management API (GET & PATCH /api/v1/modules)
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: [
      {
        key: "ATTENDANCE",
        name: "Attendance & Time Tracking",
        description: "GPS geofencing, face matching, shift schedules, overtime policies.",
        enabled: true,
        locked: true, // Core immutability
      },
      {
        key: "LEAVE",
        name: "Leave & Holiday Calendar",
        description: "Statutory leave balances, manager approval workflows, public holidays.",
        enabled: true,
        locked: false,
      },
      {
        key: "TASKS",
        name: "Field Task Management",
        description: "Daily task dispatch, proof of delivery, store visitation checklist.",
        enabled: true,
        locked: false,
      },
      {
        key: "PAYROLL",
        name: "Statutory Payroll Automation",
        description: "Automatic EPF, ESIC, Professional Tax, TDS and direct salary calculations.",
        enabled: true,
        locked: false,
      },
      {
        key: "EXPENSES",
        name: "Field Expense Claims",
        description: "Travel allowance, fuel receipts, reimbursement approval chains.",
        enabled: false,
        locked: false,
      },
      {
        key: "IDCARD",
        name: "Digital ID Card Studio",
        description: "Physical card canvas, QR code verification, barcode generation.",
        enabled: true,
        locked: false,
      },
    ],
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { key, enabled } = body;

    if (!key) {
      return NextResponse.json(
        { ok: false, error: "Module key is required." },
        { status: 400 }
      );
    }

    if (key === "ATTENDANCE") {
      return NextResponse.json(
        { ok: false, error: "Core Attendance module cannot be disabled. Required for statutory record retention." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Module "${key}" ${enabled ? "enabled" : "disabled"}. Changes reflected immediately.`,
      module: { key, enabled },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to toggle module";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
