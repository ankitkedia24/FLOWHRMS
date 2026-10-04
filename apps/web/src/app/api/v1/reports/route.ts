import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Reports & Exports API (GET & POST /api/v1/reports)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "daily") {
    return NextResponse.json({
      ok: true,
      data: {
        date: new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        presentRate: "0%",
        presentCount: 0,
        unloggedCount: 2,
        exceptionsCount: 0,
        leaveCount: 0,
        automatedChannels: "WhatsApp dispatch enabled at 09:30 AM & 06:30 PM",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    data: {
      recentExports: [
        {
          id: "exp-01",
          name: "Attendance_Register_September_2026.csv",
          generatedAt: "01 Oct 2026, 10:14 AM",
          size: "48 KB",
          recordsCount: 60,
          format: "CSV",
        },
        {
          id: "exp-02",
          name: "Payroll_Disbursements_September_2026.csv",
          generatedAt: "01 Oct 2026, 11:30 AM",
          size: "18 KB",
          recordsCount: 2,
          format: "CSV",
        },
        {
          id: "exp-03",
          name: "Audit_Trail_Q3_2026.csv",
          generatedAt: "28 Sep 2026, 04:45 PM",
          size: "142 KB",
          recordsCount: 310,
          format: "CSV",
        },
      ],
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, reportType, dateRange } = body;

    if (action === "share-daily") {
      return NextResponse.json({
        ok: true,
        message: "Daily Pulse summary shared via WhatsApp to registered managers.",
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Export "${reportType || "Attendance"}" generated for ${dateRange || "current month"}. Download link ready.`,
      exportItem: {
        id: `exp-${Date.now()}`,
        name: `${reportType || "Report"}_${Date.now()}.csv`,
        generatedAt: "Just now",
        size: "24 KB",
        format: "CSV",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
