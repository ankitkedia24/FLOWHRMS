import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile ID Card Studio API (GET & PUT /api/v1/idcard)
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      template: "STANDARD_PORTRAIT",
      cardWidthMm: 54,
      cardHeightMm: 86,
      printedFields: {
        photo: true,
        qrCode: true,
        bloodGroup: true,
        emergencyContact: true,
        joinDate: true,
        barcode: false,
      },
      styling: {
        headerColor: "#1E1B4B",
        accentColor: "#6366F1",
        qrPosition: "BOTTOM_CENTER",
        borderRadius: 16,
      },
      previewMember: {
        name: "Ramesh Kumar",
        code: "EMP-0428",
        role: "Field Specialist",
        department: "Field Logistics",
        bloodGroup: "O+ Pos",
        emergencyContact: "+91 94140 88776",
        validThru: "10/2028",
      },
    },
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({
      ok: true,
      message: "ID Card layout and element styling saved.",
      config: body,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update ID card settings";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
