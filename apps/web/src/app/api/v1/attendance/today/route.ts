import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function isUuid(val?: string | null): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
}

function formatClockTime(date?: Date | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateStr(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

async function resolveMembership(req: NextRequest) {
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

  // 3. Fallback to active shared tenant membership
  const fallback = await db.tenantMembership.findFirst({
    where: {
      tenantId: validTenantId || "19cc363d-f16f-4f4d-a6ea-102e336e24d9",
      status: "ACTIVE",
    },
    include: { tenant: true, role: true, user: true, branch: true, shift: true },
  }).catch(() => null);

  return fallback;
}

/**
 * Mobile Attendance Today (GET /api/v1/attendance/today)
 * Fetches real attendance data, today's punches, branch geofence, shift timings,
 * recent history, and live team roster directly from PostgreSQL.
 */
export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const membership = await resolveMembership(req);

    if (!membership) {
      return NextResponse.json(
        { ok: false, error: "Authenticated membership not found" },
        { status: 401 }
      );
    }

    const tenantId = membership.tenantId;
    const membershipId = membership.id;

    // Today's workDate at midnight UTC
    const todayIso = new Date().toISOString().split("T")[0];
    const workDate = new Date(`${todayIso}T00:00:00.000Z`);

    // Ensure or fetch active branch
    let branch = membership.branch;
    if (!branch) {
      branch = await db.branch.findFirst({
        where: { tenantId, isActive: true },
      }).catch(() => null);
    }
    if (branch && (branch.name.toLowerCase().includes("placeholder") || branch.address?.toLowerCase().includes("placeholder"))) {
      branch = await db.branch.update({
        where: { id: branch.id },
        data: {
          name: "Main Branch",
          address: "Headquarters Office",
          lat: branch.lat ?? 28.4960,
          lng: branch.lng ?? 77.4381,
          radiusM: 500,
        },
      }).catch(() => branch);
    }
    if (!branch) {
      // Seed default branch if none exists
      branch = await db.branch.create({
        data: {
          tenantId,
          name: "Main Branch",
          address: "Headquarters Office",
          lat: 28.4960,
          lng: 77.4381,
          radiusM: 500,
          isActive: true,
        },
      }).catch(() => null);
    }

    const cleanBranchName = (branch?.name || "Main Branch")
      .replace(/\(placeholder\)/gi, "")
      .replace(/placeholder/gi, "")
      .trim() || "Main Branch";

    // Ensure or fetch shift
    let shift = membership.shift;
    if (!shift) {
      shift = await db.shift.findFirst({
        where: { tenantId, isDefault: true },
      }).catch(() => null);
    }
    if (!shift) {
      shift = await db.shift.create({
        data: {
          tenantId,
          name: "General Shift",
          startMinutes: 540, // 09:00 AM
          endMinutes: 1080,  // 06:00 PM
          graceMinutes: 15,
          isDefault: true,
        },
      }).catch(() => null);
    }

    // Format shift start & end
    const shiftStartH = Math.floor((shift?.startMinutes ?? 540) / 60);
    const shiftStartM = (shift?.startMinutes ?? 540) % 60;
    const shiftEndH = Math.floor((shift?.endMinutes ?? 1080) / 60);
    const shiftEndM = (shift?.endMinutes ?? 1080) % 60;

    const shiftStartTimeStr = `${String(shiftStartH % 12 || 12).padStart(2, "0")}:${String(shiftStartM).padStart(2, "0")} ${shiftStartH >= 12 ? "PM" : "AM"}`;
    const shiftEndTimeStr = `${String(shiftEndH % 12 || 12).padStart(2, "0")}:${String(shiftEndM).padStart(2, "0")} ${shiftEndH >= 12 ? "PM" : "AM"}`;

    // Query today's attendance record for caller
    const record = await db.attendanceRecord.findFirst({
      where: {
        tenantId,
        membershipId,
        workDate,
      },
      include: {
        punches: {
          orderBy: { sequence: "asc" },
        },
        branch: true,
      },
    });

    const isCheckedIn = Boolean(record?.checkInAt && !record?.checkOutAt);
    const isCompleted = Boolean(record?.checkInAt && record?.checkOutAt);

    let attendanceStatus: "PRESENT" | "LATE" | "NOT_RECORDED" = "NOT_RECORDED";
    if (record?.checkInAt) {
      attendanceStatus = (record.lateMinutes > 0) ? "LATE" : "PRESENT";
    }

    // Calculate worked minutes
    let totalWorkedMinutes = 0;
    const punchesList = (record?.punches ?? []).map((p) => {
      const inTime = new Date(p.checkInAt);
      const outTime = p.checkOutAt ? new Date(p.checkOutAt) : null;
      const duration = outTime
        ? Math.max(0, Math.round((outTime.getTime() - inTime.getTime()) / 60000))
        : Math.max(0, Math.round((Date.now() - inTime.getTime()) / 60000));

      if (outTime) {
        totalWorkedMinutes += duration;
      } else {
        totalWorkedMinutes += duration;
      }

      return {
        id: p.id,
        sequence: p.sequence,
        checkInAt: p.checkInAt.toISOString(),
        checkInTime: formatClockTime(p.checkInAt),
        checkOutAt: p.checkOutAt?.toISOString() ?? null,
        checkOutTime: formatClockTime(p.checkOutAt),
        outcome: p.checkInOutcome,
        distanceM: p.checkInDistanceM,
        accuracyM: p.checkInAccuracyM,
        durationMinutes: duration,
      };
    });

    // Query last 7 days of attendance history for caller
    const recentRecords = await db.attendanceRecord.findMany({
      where: {
        tenantId,
        membershipId,
      },
      orderBy: { workDate: "desc" },
      take: 7,
      include: { branch: true },
    });

    const history = recentRecords.map((r) => {
      const recDate = new Date(r.workDate);
      let statusStr = "NOT_RECORDED";
      if (r.checkInAt) {
        statusStr = r.lateMinutes > 0 ? "LATE" : "PRESENT";
      }

      let durationHours = 0;
      if (r.checkInAt && r.checkOutAt) {
        const ms = new Date(r.checkOutAt).getTime() - new Date(r.checkInAt).getTime();
        durationHours = Number((ms / 3600000).toFixed(1));
      }

      return {
        id: r.id,
        workDate: r.workDate.toISOString().split("T")[0],
        dateFormatted: formatDateStr(recDate),
        checkInTime: formatClockTime(r.checkInAt),
        checkOutTime: formatClockTime(r.checkOutAt),
        status: statusStr,
        lateMinutes: r.lateMinutes,
        outcome: r.checkInOutcome,
        totalHours: durationHours,
        branchName: (r.branch?.name || "Main Branch")
          .replace(/\(placeholder\)/gi, "")
          .replace(/placeholder/gi, "")
          .trim() || "Main Branch",
      };
    });

    // Query team roster if caller is Admin / Owner
    const roleKey = membership.role?.key?.toLowerCase();
    const isAdmin = roleKey === "admin" || roleKey === "owner";

    let teamRoster: any[] = [];
    let teamMetrics = {
      total: 0,
      present: 0,
      checkedOut: 0,
      late: 0,
      notRecorded: 0,
      needsReview: 0,
    };

    if (isAdmin) {
      const allMembers = await db.tenantMembership.findMany({
        where: { tenantId, status: "ACTIVE" },
        include: {
          user: true,
          role: true,
          branch: true,
        },
      });

      const todayTeamRecords = await db.attendanceRecord.findMany({
        where: {
          tenantId,
          workDate,
        },
      });

      const recordByMemberId = new Map(
        todayTeamRecords.map((r) => [r.membershipId, r])
      );

      teamMetrics = {
        total: allMembers.length,
        present: 0,
        checkedOut: 0,
        late: 0,
        notRecorded: 0,
        needsReview: 0,
      };

      teamRoster = allMembers.map((m) => {
        const memberRecord = recordByMemberId.get(m.id);
        const name = m.user?.displayName || m.user?.email?.split("@")[0] || "Employee";
        const initials = name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        const isMemberCheckedIn = Boolean(memberRecord?.checkInAt && !memberRecord?.checkOutAt);
        const isMemberCheckedOut = Boolean(memberRecord?.checkInAt && memberRecord?.checkOutAt);
        const isMemberLate = Boolean(memberRecord?.lateMinutes && memberRecord.lateMinutes > 0);
        const isNeedsReview = memberRecord?.reviewStatus === "PENDING";

        // Accurate non-overlapping status counts
        if (isMemberCheckedIn) {
          teamMetrics.present++;
        } else if (isMemberCheckedOut) {
          teamMetrics.checkedOut++;
        } else {
          teamMetrics.notRecorded++;
        }

        if (isMemberLate) {
          teamMetrics.late++;
        }

        if (isNeedsReview) {
          teamMetrics.needsReview++;
        }

        let memberAttendanceStatus: "present" | "late" | "checked_out" | "not_recorded" | "needs_review" = "not_recorded";

        if (isMemberCheckedOut) {
          memberAttendanceStatus = "checked_out";
        } else if (isMemberCheckedIn) {
          memberAttendanceStatus = isMemberLate ? "late" : "present";
        } else {
          memberAttendanceStatus = "not_recorded";
        }

        const memberBranchName = (m.branch?.name || cleanBranchName)
          .replace(/\(placeholder\)/gi, "")
          .replace(/placeholder/gi, "")
          .trim() || "Main Branch";

        return {
          id: m.id,
          name,
          code: m.employeeCode || `EMP-${m.id.slice(0, 4)}`,
          role: m.role?.name || m.role?.key || "Employee",
          email: m.user?.email,
          phone: m.user?.phone,
          status: m.status.toLowerCase(),
          attendanceStatus: memberAttendanceStatus,
          isCheckedIn: isMemberCheckedIn,
          isCheckedOut: isMemberCheckedOut,
          isLate: isMemberLate,
          needsReview: isNeedsReview,
          reviewStatus: memberRecord?.reviewStatus || "NONE",
          location: memberBranchName,
          initials,
          checkInTime: formatClockTime(memberRecord?.checkInAt),
          checkOutTime: formatClockTime(memberRecord?.checkOutAt),
          lateMinutes: memberRecord?.lateMinutes ?? 0,
        };
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        date: todayIso,
        dateFormatted: formatDateStr(new Date()),
        isCheckedIn,
        isCompleted,
        status: attendanceStatus,
        checkInTime: formatClockTime(record?.checkInAt),
        checkOutTime: formatClockTime(record?.checkOutAt),
        checkInAt: record?.checkInAt?.toISOString() ?? null,
        checkOutAt: record?.checkOutAt?.toISOString() ?? null,
        lateMinutes: record?.lateMinutes ?? 0,
        outcome: record?.checkInOutcome ?? null,
        distanceM: record?.checkInDistanceM ?? null,
        accuracyM: record?.checkInAccuracyM ?? null,
        totalWorkedMinutes,
        punches: punchesList,
        branch: {
          id: branch?.id,
          name: cleanBranchName,
          address: branch?.address || "Headquarters Office",
          lat: branch?.lat ?? 28.4960,
          lng: branch?.lng ?? 77.4381,
          radiusM: branch?.radiusM ?? 500,
        },
        shift: {
          id: shift?.id,
          name: shift?.name ?? "General Shift",
          start: shiftStartTimeStr,
          end: shiftEndTimeStr,
          startMinutes: shift?.startMinutes ?? 540,
          endMinutes: shift?.endMinutes ?? 1080,
          graceMinutes: shift?.graceMinutes ?? 15,
        },
        history,
        isAdmin,
        teamMetrics: isAdmin ? teamMetrics : undefined,
        teamRoster: isAdmin ? teamRoster : undefined,
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/v1/attendance/today error:", err);
    const message = err instanceof Error ? err.message : "Failed to load attendance";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
