import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Attendance Today (GET /api/v1/attendance/today)
 * Returns the current shift attendance status for the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({
      ok: true,
      data: {
        date: new Date().toISOString().split("T")[0],
        isCheckedIn: true,
        checkInTime: "09:02 AM",
        checkOutTime: null,
        status: "PRESENT",
        matchedBranch: {
          id: "br-jaipur-central",
          name: "Jaipur Central Warehouse",
          lat: 26.9124,
          lng: 75.7873,
          radiusM: 200,
        },
        locationVerified: true,
        distanceM: 32,
        overtimeMinutes: 0,
        shift: {
          name: "General Shift",
          start: "09:00 AM",
          end: "06:00 PM",
          graceMinutes: 15,
        },
        timeline: [
          { time: "09:02 AM", event: "Shift Check-In", location: "Jaipur Central Warehouse (32m)" },
          { time: "11:30 AM", event: "Delivery Partner Gate Pass", location: "Gate #2 Verified" },
          { time: "02:15 PM", event: "Stock Proof Camera Upload", location: "Bay 4 Inventory" },
        ],
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load attendance";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
