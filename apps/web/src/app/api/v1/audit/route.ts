import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Activity Logs & Audit Trail API (GET /api/v1/audit)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const events = [
    {
      id: "ev-01",
      category: "AUTH",
      action: "SESSION_LOGIN",
      actor: "CodeSchool Admin (ADM-001)",
      role: "Owner",
      target: "FlowHRMS Mobile App",
      ipAddress: "192.168.1.7",
      timestamp: "Today, 09:00 AM",
      details: "Face ID Biometric matched. Device: iPhone 15 Pro",
    },
    {
      id: "ev-02",
      category: "APPROVAL",
      action: "ATTENDANCE_VERIFICATION",
      actor: "System Geofence Engine",
      role: "SYSTEM",
      target: "Ramesh Kumar (EMP-0428)",
      ipAddress: "10.0.4.12",
      timestamp: "Today, 09:02 AM",
      details: "Check-in coordinates (26.9124, 75.7873) matched within 32m radius of Jaipur Central Warehouse.",
    },
    {
      id: "ev-03",
      category: "MODIFICATION",
      action: "PAYROLL_SIMULATION",
      actor: "CodeSchool Admin (ADM-001)",
      role: "Owner",
      target: "October 2026 Payroll Run",
      ipAddress: "192.168.1.7",
      timestamp: "Yesterday, 04:30 PM",
      details: "Calculated cycle with 1 payable employee (Net: ₹258).",
    },
    {
      id: "ev-04",
      category: "DATA_ACCESS",
      action: "EXPORT_DOWNLOAD",
      actor: "CodeSchool Admin (ADM-001)",
      role: "Owner",
      target: "Attendance_Register_September_2026.csv",
      ipAddress: "192.168.1.7",
      timestamp: "01 Oct 2026, 10:14 AM",
      details: "Downloaded 60 employee records for statutory verification.",
    },
  ];

  const filtered = category && category !== "ALL"
    ? events.filter((e) => e.category === category)
    : events;

  return NextResponse.json({
    ok: true,
    data: filtered,
  });
}
