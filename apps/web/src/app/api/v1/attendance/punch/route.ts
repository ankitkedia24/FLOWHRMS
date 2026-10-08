import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function isUuid(val?: string | null): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
}

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

async function resolveCallerMembership(req: NextRequest) {
  const db = getDb();
  const headerEmail = req.headers.get("x-user-email");
  const headerUserId = req.headers.get("x-user-id");
  const rawTenantId = req.headers.get("x-tenant-id");
  const validTenantId = isUuid(rawTenantId) ? rawTenantId! : undefined;

  // 1. Look up by user email
  if (headerEmail) {
    const user = await db.user.findFirst({
      where: { email: { equals: headerEmail, mode: "insensitive" } },
      include: {
        memberships: {
          where: validTenantId ? { tenantId: validTenantId } : undefined,
          include: { tenant: true, role: true, user: true, branch: true, shift: true },
          take: 1,
        },
      },
    }).catch(() => null);
    if (user?.memberships?.[0]) return user.memberships[0];
  }

  // 2. Look up by user ID
  if (isUuid(headerUserId)) {
    const user = await db.user.findUnique({
      where: { id: headerUserId! },
      include: {
        memberships: {
          where: validTenantId ? { tenantId: validTenantId } : undefined,
          include: { tenant: true, role: true, user: true, branch: true, shift: true },
          take: 1,
        },
      },
    }).catch(() => null);
    if (user?.memberships?.[0]) return user.memberships[0];
  }

  // 3. Fallback
  return db.tenantMembership.findFirst({
    where: {
      tenantId: validTenantId || "19cc363d-f16f-4f4d-a6ea-102e336e24d9",
      status: "ACTIVE",
    },
    include: { tenant: true, role: true, user: true, branch: true, shift: true },
  }).catch(() => null);
}

/**
 * Mobile Attendance Punch In / Out (POST /api/v1/attendance/punch)
 * Records real GPS coordinates, evaluates geofence against branch in PostgreSQL,
 * calculates shift lateness, and writes AttendanceRecord & AttendancePunch to PostgreSQL.
 */
export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const caller = await resolveCallerMembership(req);

    if (!caller) {
      return NextResponse.json(
        { ok: false, error: "Authenticated membership not found." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawAction = String(body.action || body.type || "").trim().toLowerCase();
    let action: "check-in" | "check-out" | null = null;
    if (rawAction.includes("in")) {
      action = "check-in";
    } else if (rawAction.includes("out")) {
      action = "check-out";
    }

    if (!action) {
      return NextResponse.json(
        { ok: false, error: "Action must be 'check-in' or 'check-out'." },
        { status: 400 }
      );
    }

    const { latitude, longitude, accuracy, address, note, targetMembershipId } = body;

    // Check if admin is checking in another employee
    let effectiveMembership = caller;
    const roleKey = caller.role?.key?.toLowerCase();
    const isAdmin = roleKey === "admin" || roleKey === "owner";

    if (targetMembershipId && isUuid(targetMembershipId) && isAdmin) {
      const target = await db.tenantMembership.findUnique({
        where: { id: targetMembershipId },
        include: { tenant: true, role: true, user: true, branch: true, shift: true },
      });
      if (target && target.tenantId === caller.tenantId) {
        effectiveMembership = target;
      }
    }

    const tenantId = effectiveMembership.tenantId;
    const membershipId = effectiveMembership.id;

    // Reject poor GPS accuracy (> 200m)
    if (typeof accuracy === "number" && accuracy > 200) {
      return NextResponse.json(
        {
          ok: false,
          error: "GPS Accuracy is too low (>200m). Please move closer to an open window or turn on Wi-Fi.",
        },
        { status: 422 }
      );
    }

    const now = new Date();
    const todayIso = now.toISOString().split("T")[0];
    const workDate = new Date(`${todayIso}T00:00:00.000Z`);

    // Resolve branch
    let branch = effectiveMembership.branch;
    if (!branch) {
      branch = await db.branch.findFirst({
        where: { tenantId, isActive: true },
      });
    }

    // Geofence calculation
    let distanceM: number | null = null;
    let locationOutcome: "INSIDE" | "OUTSIDE" | "UNCONFIRMED" = "UNCONFIRMED";

    if (
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      branch?.lat != null &&
      branch?.lng != null
    ) {
      distanceM = getDistanceInMeters(latitude, longitude, branch.lat, branch.lng);
      const radiusM = branch.radiusM || 300;
      locationOutcome = distanceM <= radiusM ? "INSIDE" : "OUTSIDE";
    } else if (typeof latitude === "number" && typeof longitude === "number") {
      // Branch has no lat/lng; mark inside by default
      locationOutcome = "INSIDE";
    }

    // Resolve shift & lateness
    let shift = effectiveMembership.shift;
    if (!shift) {
      shift = await db.shift.findFirst({
        where: { tenantId, isDefault: true },
      });
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const shiftStart = shift?.startMinutes ?? 540;
    const shiftGrace = shift?.graceMinutes ?? 15;
    let lateMinutes = 0;
    if (action === "check-in" && currentMinutes > shiftStart + shiftGrace) {
      lateMinutes = Math.max(0, currentMinutes - shiftStart);
    }

    // Find existing record for today
    let record = await db.attendanceRecord.findFirst({
      where: {
        tenantId,
        membershipId,
        workDate,
      },
      include: {
        punches: { orderBy: { sequence: "asc" } },
      },
    });

    const isCheckIn = action === "check-in";
    const timeFormatted = formatClockTime(now);

    if (isCheckIn) {
      if (record && record.checkInAt && !record.checkOutAt) {
        return NextResponse.json({
          ok: true,
          message: `Already checked in at ${formatClockTime(record.checkInAt)}.`,
          punch: {
            action: "check-in",
            timestamp: record.checkInAt.toISOString(),
            formattedTime: formatClockTime(record.checkInAt),
            latitude: record.checkInLat,
            longitude: record.checkInLng,
            branch: branch?.name ?? "HQ",
            geofenceMatched: record.checkInOutcome === "INSIDE",
          },
        });
      }

      if (!record) {
        // Create new AttendanceRecord
        record = await db.attendanceRecord.create({
          data: {
            tenantId,
            membershipId,
            workDate,
            checkInAt: now,
            checkInLat: typeof latitude === "number" ? latitude : null,
            checkInLng: typeof longitude === "number" ? longitude : null,
            checkInAccuracyM: typeof accuracy === "number" ? accuracy : null,
            checkInDistanceM: distanceM,
            checkInOutcome: locationOutcome,
            checkInReason: note || null,
            lateMinutes,
            branchId: branch?.id ?? null,
            reviewStatus: locationOutcome === "OUTSIDE" ? "PENDING" : "NONE",
          },
          include: { punches: true },
        });

        // Create first punch pair
        await db.attendancePunch.create({
          data: {
            tenantId,
            recordId: record.id,
            sequence: 1,
            checkInAt: now,
            checkInLat: typeof latitude === "number" ? latitude : null,
            checkInLng: typeof longitude === "number" ? longitude : null,
            checkInAccuracyM: typeof accuracy === "number" ? accuracy : null,
            checkInDistanceM: distanceM,
            checkInOutcome: locationOutcome,
            checkInReason: note || null,
            branchId: branch?.id ?? null,
          },
        });
      } else {
        // Re-opening visit or multi-punch
        const nextSeq = (record.punches?.length ?? 0) + 1;
        record = await db.attendanceRecord.update({
          where: { id: record.id },
          data: {
            checkOutAt: null,
            checkOutLat: null,
            checkOutLng: null,
            checkOutOutcome: null,
          },
          include: { punches: true },
        });

        await db.attendancePunch.create({
          data: {
            tenantId,
            recordId: record.id,
            sequence: nextSeq,
            checkInAt: now,
            checkInLat: typeof latitude === "number" ? latitude : null,
            checkInLng: typeof longitude === "number" ? longitude : null,
            checkInAccuracyM: typeof accuracy === "number" ? accuracy : null,
            checkInDistanceM: distanceM,
            checkInOutcome: locationOutcome,
            branchId: branch?.id ?? null,
          },
        });
      }

      const matchMsg =
        locationOutcome === "INSIDE"
          ? distanceM != null
            ? `Location verified within ${distanceM}m of ${branch?.name ?? "branch"}.`
            : "Location verified with GPS stamp."
          : `Note: Recorded outside geofence (${distanceM ? `${distanceM}m` : "outside area"}). Sent for supervisor review.`;

      return NextResponse.json({
        ok: true,
        message: `Checked In successfully at ${timeFormatted}. ${matchMsg}`,
        punch: {
          action: "check-in",
          timestamp: now.toISOString(),
          formattedTime: timeFormatted,
          latitude,
          longitude,
          distanceM,
          branch: branch?.name ?? "HQ",
          geofenceMatched: locationOutcome === "INSIDE",
        },
      });
    } else {
      // Check-out
      if (!record || !record.checkInAt) {
        return NextResponse.json(
          { ok: false, error: "Cannot check out without checking in first." },
          { status: 400 }
        );
      }

      // Update AttendanceRecord
      await db.attendanceRecord.update({
        where: { id: record.id },
        data: {
          checkOutAt: now,
          checkOutLat: typeof latitude === "number" ? latitude : null,
          checkOutLng: typeof longitude === "number" ? longitude : null,
          checkOutOutcome: locationOutcome,
        },
      });

      // Close the open punch sequence
      const openPunch = await db.attendancePunch.findFirst({
        where: {
          recordId: record.id,
          checkOutAt: null,
        },
        orderBy: { sequence: "desc" },
      });

      if (openPunch) {
        await db.attendancePunch.update({
          where: { id: openPunch.id },
          data: {
            checkOutAt: now,
            checkOutLat: typeof latitude === "number" ? latitude : null,
            checkOutLng: typeof longitude === "number" ? longitude : null,
            checkOutOutcome: locationOutcome,
          },
        });
      }

      const workedMs = now.getTime() - new Date(record.checkInAt).getTime();
      const workedHours = (workedMs / 3600000).toFixed(1);

      return NextResponse.json({
        ok: true,
        message: `Checked Out successfully at ${timeFormatted}. Shift duration: ${workedHours} hrs.`,
        punch: {
          action: "check-out",
          timestamp: now.toISOString(),
          formattedTime: timeFormatted,
          latitude,
          longitude,
          workedHours,
          branch: branch?.name ?? "HQ",
        },
      });
    }
  } catch (err: unknown) {
    console.error("POST /api/v1/attendance/punch error:", err);
    const message = err instanceof Error ? err.message : "Punch recording failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
