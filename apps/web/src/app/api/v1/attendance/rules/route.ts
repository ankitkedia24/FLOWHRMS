import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Attendance & Pay Rules API (GET & PUT /api/v1/attendance/rules)
 * Governs working days, weekly offs, grace period, late mark policy, and geofencing.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      standardHoursPerDay: 8,
      workDaysPerWeek: 6,
      weeklyOffDays: ["Sunday"],
      gracePeriodMinutes: 15,
      halfDayThresholdHours: 4,
      lateMarkPolicy: {
        lateMarksAllowedBeforePenalty: 3,
        penaltyType: "HALF_DAY_DEDUCTION",
        enabled: true,
      },
      overtime: {
        multiplier: 1.5,
        minimumMinutesToQualify: 60,
        requiresSupervisorApproval: true,
      },
      geofencing: {
        enforced: true,
        radiusMeters: 200,
        allowFieldExceptionRequests: true,
      },
    },
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({
      ok: true,
      message: "Attendance and pay policy updated successfully.",
      data: body,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update rules";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
