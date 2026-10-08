import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type LeaveTypeEnum = "FULL_DAY" | "HALF_DAY" | "EMERGENCY";

function normalizeLeaveType(type?: string): LeaveTypeEnum {
  if (!type) return "FULL_DAY";
  const upper = type.toUpperCase();
  if (upper.includes("HALF")) return "HALF_DAY";
  if (upper.includes("EMERGENCY")) return "EMERGENCY";
  return "FULL_DAY";
}

function calculateDays(start: string, end: string, isHalfDay?: boolean): number {
  if (isHalfDay) return 0.5;
  try {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diff = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
    return isNaN(diff) ? 1 : diff;
  } catch {
    return 1;
  }
}

/**
 * Resolves the caller's TenantMembership from the live PostgreSQL database.
 */
async function resolveMembership(req: NextRequest) {
  const db = getDb();
  const headerEmail = req.headers.get("x-user-email");
  const headerUserId = req.headers.get("x-user-id");
  const headerTenantId = req.headers.get("x-tenant-id");

  // 1. Look up by user email if passed
  if (headerEmail) {
    const user = await db.user.findFirst({
      where: { email: { equals: headerEmail, mode: "insensitive" } },
      include: {
        memberships: {
          include: { tenant: true, user: true },
        },
      },
    });
    if (user && user.memberships.length > 0) {
      if (headerTenantId) {
        const matching = user.memberships.find((m) => m.tenantId === headerTenantId);
        if (matching) return matching;
      }
      return user.memberships[0];
    }
  }

  // 2. Look up by user ID
  if (headerUserId) {
    const user = await db.user.findUnique({
      where: { id: headerUserId },
      include: {
        memberships: {
          include: { tenant: true, user: true },
        },
      },
    }).catch(() => null);
    if (user && user.memberships.length > 0) {
      if (headerTenantId) {
        const matching = user.memberships.find((m) => m.tenantId === headerTenantId);
        if (matching) return matching;
      }
      return user.memberships[0];
    }
  }

  // 3. Look up by tenant ID if passed
  if (headerTenantId) {
    const membership = await db.tenantMembership.findFirst({
      where: { tenantId: headerTenantId, status: "ACTIVE" },
      include: { tenant: true, user: true },
    }).catch(() => null);
    if (membership) return membership;
  }

  // 4. Fallback to the first active tenant membership in the database (e.g. FX & Float or Sunrise Traders)
  const fallback = await db.tenantMembership.findFirst({
    where: { status: "ACTIVE" },
    include: { tenant: true, user: true },
  });

  return fallback;
}

function inferLeaveCategory(r: { type: string; reason?: string | null }): string {
  const reason = (r.reason || "").toLowerCase();
  if (
    r.type === "EMERGENCY" ||
    reason.startsWith("[sick") ||
    /sick|doctor|medical|hospital|fever|health|illness|clinic|surgery|treatment|injury/i.test(reason)
  ) {
    return "Sick Leave";
  }
  if (
    r.type === "HALF_DAY" ||
    reason.startsWith("[casual") ||
    /casual|personal|urgent|family|function|bank|errand|event|wedding|ceremony/i.test(reason)
  ) {
    return "Casual Leave";
  }
  return "Paid Leave";
}

function computeDynamicBalances(approvedRequests: Array<{
  type: string;
  startDate: Date | string;
  endDate: Date | string;
  unpaidDays?: number | null;
  reason?: string | null;
}>) {
  let usedSL = 0;
  let usedCL = 0;
  let usedPL = 0;

  for (const r of approvedRequests) {
    const startStr = r.startDate instanceof Date ? r.startDate.toISOString().split("T")[0] : String(r.startDate).split("T")[0];
    const endStr = r.endDate instanceof Date ? r.endDate.toISOString().split("T")[0] : String(r.endDate).split("T")[0];
    const days = (r.unpaidDays && r.unpaidDays > 0)
      ? Number(r.unpaidDays)
      : (r.type === "HALF_DAY" ? 0.5 : calculateDays(startStr, endStr));

    const category = inferLeaveCategory(r);
    if (category === "Sick Leave") {
      usedSL += days;
    } else if (category === "Casual Leave") {
      usedCL += days;
    } else {
      usedPL += days;
    }
  }

  // Sick Leave total: 8
  const actualUsedSL = Math.min(8, usedSL);
  const slOverflow = Math.max(0, usedSL - 8);

  // Casual Leave total: 12
  const actualUsedCL = Math.min(12, usedCL);
  const clOverflow = Math.max(0, usedCL - 12);

  // Paid Leave total: 18 (absorbs overflow if employee exceeded quota)
  const totalPL = usedPL + slOverflow + clOverflow;
  const actualUsedPL = Math.min(18, totalPL);

  return [
    {
      type: "Paid Leave",
      key: "PL",
      total: 18,
      used: actualUsedPL,
      available: Math.max(0, 18 - actualUsedPL),
    },
    {
      type: "Casual Leave",
      key: "CL",
      total: 12,
      used: actualUsedCL,
      available: Math.max(0, 12 - actualUsedCL),
    },
    {
      type: "Sick Leave",
      key: "SL",
      total: 8,
      used: actualUsedSL,
      available: Math.max(0, 8 - actualUsedSL),
    },
  ];
}

/**
 * GET /api/v1/leave
 * Returns live leave requests and computed balances directly from PostgreSQL.
 */
export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const membership = await resolveMembership(req);

    if (!membership) {
      return NextResponse.json({
        ok: true,
        data: {
          balances: [
            { type: "Paid Leave", key: "PL", total: 18, used: 0, available: 18 },
            { type: "Casual Leave", key: "CL", total: 12, used: 0, available: 12 },
            { type: "Sick Leave", key: "SL", total: 8, used: 0, available: 8 },
          ],
          requests: [],
        },
      });
    }

    const headerEmail = req.headers.get("x-user-email");
    const headerUserId = req.headers.get("x-user-id");
    const hasExplicitUser = Boolean(headerEmail || headerUserId);

    // Query real leave requests from PostgreSQL for this employee
    const userRequests = await db.leaveRequest.findMany({
      where: {
        membershipId: membership.id,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // If an explicit user is logged in, show their records (or empty if none yet).
    // If no explicit user header exists, fall back to tenant sample records.
    const requestsToDisplay = (hasExplicitUser || userRequests.length > 0)
      ? userRequests
      : await db.leaveRequest.findMany({
          where: { tenantId: membership.tenantId },
          orderBy: { createdAt: "desc" },
          take: 20,
        });

    // Calculate dynamic live balances from APPROVED requests in database
    const approvedRequests = (hasExplicitUser || userRequests.length > 0)
      ? userRequests.filter((r) => r.status === "APPROVED")
      : requestsToDisplay.filter((r) => r.status === "APPROVED");

    const dynamicBalances = computeDynamicBalances(approvedRequests);

    const formattedRequests = requestsToDisplay.map((r) => {
      const startStr = r.startDate instanceof Date ? r.startDate.toISOString().split("T")[0] : String(r.startDate).split("T")[0];
      const endStr = r.endDate instanceof Date ? r.endDate.toISOString().split("T")[0] : String(r.endDate).split("T")[0];
      const appliedStr = r.createdAt instanceof Date ? r.createdAt.toISOString().split("T")[0] : String(r.createdAt).split("T")[0];
      const category = inferLeaveCategory(r);

      const durationDays = (r.unpaidDays && r.unpaidDays > 0)
        ? r.unpaidDays
        : (r.type === "HALF_DAY" ? 0.5 : calculateDays(startStr, endStr));

      return {
        id: r.id,
        category,
        type: r.type === "FULL_DAY" ? "Full Day" : r.type === "HALF_DAY" ? "Half Day" : "Emergency",
        startDate: startStr,
        endDate: endStr,
        dateRange: `${startStr} – ${endStr}`,
        days: durationDays,
        reason: r.reason || "No reason provided",
        status: r.status,
        note: r.decisionReason || (r.status === "PENDING" ? "Sent · Waiting for manager approval" : r.status === "APPROVED" ? "Approved by Manager" : "Reviewed"),
        appliedOn: appliedStr,
      };
    });

    // Query team requests for manager/admin visibility
    const rawTeamRequests = await db.leaveRequest.findMany({
      where: {
        tenantId: membership.tenantId,
      },
      include: {
        membership: {
          include: {
            user: { select: { displayName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const formattedTeamRequests = rawTeamRequests.map((r) => {
      const startStr = r.startDate instanceof Date ? r.startDate.toISOString().split("T")[0] : String(r.startDate).split("T")[0];
      const endStr = r.endDate instanceof Date ? r.endDate.toISOString().split("T")[0] : String(r.endDate).split("T")[0];
      const appliedStr = r.createdAt instanceof Date ? r.createdAt.toISOString().split("T")[0] : String(r.createdAt).split("T")[0];
      const category = inferLeaveCategory(r);
      const durationDays = (r.unpaidDays && r.unpaidDays > 0)
        ? r.unpaidDays
        : (r.type === "HALF_DAY" ? 0.5 : calculateDays(startStr, endStr));

      return {
        id: r.id,
        employeeName: r.membership?.user?.displayName || "Employee",
        employeeEmail: r.membership?.user?.email || "",
        category,
        type: r.type === "FULL_DAY" ? "Full Day" : r.type === "HALF_DAY" ? "Half Day" : "Emergency",
        startDate: startStr,
        endDate: endStr,
        dateRange: `${startStr} – ${endStr}`,
        days: durationDays,
        reason: r.reason || "No reason provided",
        status: r.status,
        note: r.decisionReason || (r.status === "PENDING" ? "Pending Review" : r.status === "APPROVED" ? "Approved by Manager" : "Rejected"),
        appliedOn: appliedStr,
        isOwn: r.membershipId === membership.id,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          balances: dynamicBalances,
          requests: formattedRequests,
          teamRequests: formattedTeamRequests,
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
    console.error("GET /api/v1/leave error:", err);
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/v1/leave
 * Inserts the leave request directly into PostgreSQL via Prisma.
 */
export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json().catch(() => ({}));
    const { leaveType, leaveCategory, startDate, endDate, reason, isHalfDay } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { ok: false, error: "Start date and end date are required." },
        { status: 400 }
      );
    }

    const membership = await resolveMembership(req);
    if (!membership) {
      return NextResponse.json(
        { ok: false, error: "No active tenant membership found for user. Please check workspace sign-in." },
        { status: 403 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Normalize type and category
    let normalizedType: LeaveTypeEnum = normalizeLeaveType(leaveType);
    if (leaveCategory === "Sick Leave" || leaveType === "EMERGENCY") {
      normalizedType = "EMERGENCY";
    } else if (isHalfDay || leaveType === "HALF_DAY") {
      normalizedType = "HALF_DAY";
    }

    const daysCount = calculateDays(startDate, endDate, Boolean(isHalfDay || normalizedType === "HALF_DAY"));

    let finalReason = (reason || "").trim() || "Applied via FlowHRMS Mobile";
    if (leaveCategory && !finalReason.startsWith(`[${leaveCategory}]`)) {
      finalReason = `[${leaveCategory}] ${finalReason}`;
    }

    console.log(`\n💾 [DB POST /api/v1/leave] Inserting leave request for tenant ${membership.tenantId}, member ${membership.id}`);

    // Create the row directly in PostgreSQL
    const created = await db.leaveRequest.create({
      data: {
        tenantId: membership.tenantId,
        membershipId: membership.id,
        type: normalizedType,
        startDate: start,
        endDate: end,
        reason: finalReason,
        status: "PENDING",
        unpaidDays: daysCount,
        clientCapturedAt: new Date(),
      },
    });

    console.log(`✅ [DB POST /api/v1/leave] Successfully saved to PostgreSQL! ID: ${created.id}`);

    const appliedStr = created.createdAt.toISOString().split("T")[0];
    const category = inferLeaveCategory({ type: normalizedType, reason: finalReason });

    return NextResponse.json({
      ok: true,
      message: `Leave request for ${category} (${startDate} to ${endDate}) saved to database.`,
      request: {
        id: created.id,
        category,
        type: normalizedType === "FULL_DAY" ? "Full Day" : normalizedType === "HALF_DAY" ? "Half Day" : "Emergency",
        startDate,
        endDate,
        dateRange: `${startDate} – ${endDate}`,
        days: daysCount,
        reason: created.reason,
        status: created.status,
        note: "Sent · Waiting for manager approval",
        appliedOn: appliedStr,
      },
    });
  } catch (err: unknown) {
    console.error("POST /api/v1/leave error:", err);
    const message = err instanceof Error ? err.message : "Failed to save leave request to database";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/leave
 * Allows an admin or manager to approve or reject an employee's leave request.
 */
export async function PATCH(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json().catch(() => ({}));
    const { requestId, decision, paid, reason } = body;

    if (!requestId || !decision) {
      return NextResponse.json(
        { ok: false, error: "requestId and decision (APPROVED | REJECTED) are required." },
        { status: 400 }
      );
    }

    if (decision === "REJECTED" && !reason?.trim()) {
      return NextResponse.json(
        { ok: false, error: "A rejection reason is required." },
        { status: 400 }
      );
    }

    const membership = await resolveMembership(req);
    if (!membership) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 403 });
    }

    const leave = await db.leaveRequest.findUnique({
      where: { id: requestId },
      include: { membership: { include: { user: true } } },
    });

    if (!leave) {
      return NextResponse.json({ ok: false, error: "Leave request not found." }, { status: 404 });
    }

    const isPaid = decision === "APPROVED" ? (paid !== undefined ? Boolean(paid) : true) : null;

    const updated = await db.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        paid: isPaid,
        unpaidDays: isPaid ? 0 : leave.unpaidDays,
        decidedById: membership.id,
        decidedAt: new Date(),
        decisionReason: reason?.trim() || (decision === "APPROVED" ? "Approved by Manager" : null),
      },
    });

    console.log(`✅ [PATCH /api/v1/leave] Request ${requestId} marked as ${decision} by ${membership.user?.displayName || membership.id}`);

    return NextResponse.json({
      ok: true,
      message: `Leave request ${decision === "APPROVED" ? "approved" : "rejected"} successfully.`,
      request: updated,
    });
  } catch (err: unknown) {
    console.error("PATCH /api/v1/leave error:", err);
    const message = err instanceof Error ? err.message : "Failed to update leave request";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

