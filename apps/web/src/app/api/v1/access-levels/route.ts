import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Access Levels API (GET & PATCH /api/v1/access-levels)
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      roles: [
        {
          key: "OWNER",
          name: "Owner",
          tagline: "Total control over tenant data, banking, legal compliance, and users.",
          assignedCount: 1,
        },
        {
          key: "HR_ADMIN",
          name: "HR Admin",
          tagline: "Manages employee profiles, leave requests, attendance disputes, and ID cards.",
          assignedCount: 0,
        },
        {
          key: "OPERATIONS_MANAGER",
          name: "Operations Manager",
          tagline: "Oversees shifts, task dispatching, branch locations, and daily reports.",
          assignedCount: 0,
        },
        {
          key: "FIELD_SUPERVISOR",
          name: "Field Supervisor",
          tagline: "Approves field check-ins, store visits, and team task completions.",
          assignedCount: 0,
        },
        {
          key: "EMPLOYEE",
          name: "Employee",
          tagline: "Self-service mobile punch in/out, task reporting, and payslip viewing.",
          assignedCount: 1,
        },
      ],
      permissions: [
        {
          category: "ATTENDANCE_PUNCH",
          label: "Geo-Fenced Punch In & Out",
          roles: ["OWNER", "HR_ADMIN", "OPERATIONS_MANAGER", "FIELD_SUPERVISOR", "EMPLOYEE"],
        },
        {
          category: "ATTENDANCE_OVERRIDE",
          label: "Manual Attendance Overrides",
          roles: ["OWNER", "HR_ADMIN", "OPERATIONS_MANAGER"],
        },
        {
          category: "LEAVE_APPROVAL",
          label: "Approve / Reject Leave",
          roles: ["OWNER", "HR_ADMIN", "OPERATIONS_MANAGER", "FIELD_SUPERVISOR"],
        },
        {
          category: "PAYROLL_RUN",
          label: "Execute Monthly Payroll Run",
          roles: ["OWNER"],
        },
        {
          category: "AUDIT_EXPORT",
          label: "Download Full Audit Logs & CSVs",
          roles: ["OWNER", "HR_ADMIN"],
        },
      ],
    },
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({
      ok: true,
      message: "Access level permission matrix updated.",
      updated: body,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update permissions";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
