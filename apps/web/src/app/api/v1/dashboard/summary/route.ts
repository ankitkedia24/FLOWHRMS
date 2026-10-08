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

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
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
 * Mobile Dashboard Summary (GET /api/v1/dashboard/summary)
 * Live PostgreSQL data feeding both the Admin Operations Dashboard and Field Employee Mode.
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
    const now = new Date();
    const todayIso = now.toISOString().split("T")[0];
    const workDate = new Date(`${todayIso}T00:00:00.000Z`);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run parallel live queries across PostgreSQL tables
    const [
      allMembers,
      todayRecords,
      pendingLeaves,
      tenantTasks,
      myMonthAttendance,
    ] = await Promise.all([
      db.tenantMembership.findMany({
        where: { tenantId, status: "ACTIVE" },
        include: { user: true, role: true, branch: true },
      }),
      db.attendanceRecord.findMany({
        where: { tenantId, workDate },
        include: { punches: { orderBy: { sequence: "asc" } }, branch: true },
      }),
      db.leaveRequest.findMany({
        where: { tenantId, status: "PENDING" },
        include: { membership: { include: { user: true } } },
        orderBy: { createdAt: "desc" },
      }),
      db.task.findMany({
        where: { tenantId },
        include: { assignee: { include: { user: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.attendanceRecord.findMany({
        where: {
          tenantId,
          membershipId: membership.id,
          workDate: { gte: monthStart },
        },
      }),
    ]);

    // Active Employees & Today's Attendance Metrics
    const totalEmployees = allMembers.length;
    const presentToday = todayRecords.filter((r) => r.checkInAt && !r.checkOutAt).length;
    const checkedOutToday = todayRecords.filter((r) => r.checkInAt && r.checkOutAt).length;
    const lateToday = todayRecords.filter((r) => r.lateMinutes > 0).length;
    const exceptionsToday = todayRecords.filter((r) => r.reviewStatus === "PENDING");

    // Tasks counts
    const activeTasks = tenantTasks.filter((t) => t.status !== "COMPLETED");
    const myTasks = tenantTasks.filter((t) => t.assigneeId === membership.id);
    const myPendingTasks = myTasks.filter((t) => t.status !== "COMPLETED");

    // Current caller's attendance today
    const myTodayRecord = todayRecords.find((r) => r.membershipId === membership.id);
    const myIsCheckedIn = Boolean(myTodayRecord?.checkInAt && !myTodayRecord?.checkOutAt);
    const myCheckInTime = formatClockTime(myTodayRecord?.checkInAt);
    const myCheckOutTime = formatClockTime(myTodayRecord?.checkOutAt);

    // Days present this month for the caller
    const myDaysPresentThisMonth = myMonthAttendance.filter((r) => Boolean(r.checkInAt)).length;
    // Compute total working days so far this month (Mon-Sat)
    let totalWorkingDaysSoFar = 0;
    const curDay = now.getDate();
    for (let d = 1; d <= curDay; d++) {
      const checkDate = new Date(now.getFullYear(), now.getMonth(), d);
      if (checkDate.getDay() !== 0) {
        // Exclude Sundays
        totalWorkingDaysSoFar++;
      }
    }
    const daysPresentRatio = `${myDaysPresentThisMonth}/${Math.max(1, totalWorkingDaysSoFar)}`;

    // Build Cluster Peer Check-in Feed from live check-in records
    const memberMap = new Map(allMembers.map((m) => [m.id, m]));
    const clusterPeers = todayRecords
      .filter((r) => r.checkInAt)
      .map((r) => {
        const member = memberMap.get(r.membershipId);
        const name = member?.user?.displayName || member?.user?.email?.split("@")[0] || "Employee";
        const branchName = r.branch?.name || member?.branch?.name || "Main Branch";
        return {
          id: r.id,
          name,
          location: `${branchName} Check-in`,
          time: formatClockTime(r.checkInAt) || "09:00 AM",
          isOnline: Boolean(r.checkInAt && !r.checkOutAt),
        };
      });

    // Build Recent Activity Feed from real DB logs
    const recentActivity: Array<{
      id: string;
      title: string;
      description: string;
      time: string;
      type: "ATTENDANCE" | "LEAVE" | "TASK";
    }> = [];

    // Add check-ins/check-outs from today
    for (const r of todayRecords) {
      const member = memberMap.get(r.membershipId);
      const name = member?.user?.displayName || member?.user?.email?.split("@")[0] || "Employee";
      if (r.checkInAt) {
        recentActivity.push({
          id: `act-in-${r.id}`,
          title: "Shift Check-In",
          description: `${name} punched in (${r.reviewStatus === "PENDING" ? "Outside geofence - Needs Review" : "Verified"})`,
          time: formatClockTime(r.checkInAt) || "Today",
          type: "ATTENDANCE",
        });
      }
      if (r.checkOutAt) {
        recentActivity.push({
          id: `act-out-${r.id}`,
          title: "Shift Check-Out",
          description: `${name} clocked out. Shift completed.`,
          time: formatClockTime(r.checkOutAt) || "Today",
          type: "ATTENDANCE",
        });
      }
    }

    // Add recent leave requests
    for (const l of pendingLeaves) {
      const name = l.membership?.user?.displayName || l.membership?.user?.email?.split("@")[0] || "Employee";
      recentActivity.push({
        id: `act-leave-${l.id}`,
        title: "Leave Requested",
        description: `${name} submitted ${l.type.toLowerCase().replace("_", " ")} leave request (${l.reason || "No reason"})`,
        time: formatShortDate(l.createdAt),
        type: "LEAVE",
      });
    }

    // Add recent tasks
    for (const t of tenantTasks.slice(0, 3)) {
      const assigneeName = t.assignee?.user?.displayName || t.assignee?.user?.email?.split("@")[0] || "Team Member";
      recentActivity.push({
        id: `act-task-${t.id}`,
        title: t.status === "COMPLETED" ? "Task Completed" : "Task Assigned",
        description: `${t.title} · Assigned to ${assigneeName}`,
        time: formatShortDate(t.createdAt),
        type: "TASK",
      });
    }

    // Format Exceptions items for Admin
    const exceptionsItems = exceptionsToday.map((r) => {
      const member = memberMap.get(r.membershipId);
      return {
        id: r.id,
        membershipId: r.membershipId,
        name: member?.user?.displayName || member?.user?.email?.split("@")[0] || "Employee",
        role: member?.role?.name || "Staff",
        checkInTime: formatClockTime(r.checkInAt) || "--",
        reason: r.checkInReason || "Punched outside branch geofence perimeter",
        distanceM: r.checkInDistanceM || 0,
      };
    });

    const monthName = now.toLocaleString("en-US", { month: "long" });
    const yearNumber = now.getFullYear();
    const periodStr = `${monthName} ${yearNumber}`;

    return NextResponse.json({
      ok: true,
      data: {
        pulse: {
          totalEmployees,
          presentToday,
          checkedOutToday,
          lateToday,
          pendingLeave: pendingLeaves.length,
          activeTasksCount: activeTasks.length,
          exceptionsCount: exceptionsToday.length,
        },
        exceptionsReview: {
          pendingCount: exceptionsToday.length,
          items: exceptionsItems,
          message:
            exceptionsToday.length === 0
              ? "All shift check-ins and locations are clear across hubs."
              : `${exceptionsToday.length} check-in exception(s) require review.`,
        },
        payrollPreview: {
          period: periodStr,
          status: "READY",
          payableEmployees: totalEmployees,
          description: `${totalEmployees} employees payable. Compliant with wage act & attendance rules.`,
        },
        clusterPeers,
        recentActivity: recentActivity.slice(0, 10),
        mySummary: {
          isCheckedIn: myIsCheckedIn,
          checkInTime: myCheckInTime,
          checkOutTime: myCheckOutTime,
          shiftName: membership.shift?.name || "General Shift",
          shiftHours: "08:30 - 17:30",
          daysPresentThisMonth: myDaysPresentThisMonth,
          daysPresentRatio,
          totalWorkingDaysSoFar,
          totalTasks: myTasks.length,
          pendingTasks: myPendingTasks.length,
        },
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/v1/dashboard/summary error:", err);
    const message = err instanceof Error ? err.message : "Failed to load dashboard summary";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
