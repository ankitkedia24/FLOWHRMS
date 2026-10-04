import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Company Settings API (GET & PUT /api/v1/settings)
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      legalName: "FX & Float Logistics Private Limited",
      tradeName: "FX & Float Logistics",
      gstin: "08AABCF1234F1Z5",
      pan: "AABCF1234F",
      registeredAddress: "Plot 42, Sitapura Industrial Area, Tonk Road, Jaipur, Rajasthan 302022",
      supportEmail: "help@flowacord.com",
      supportPhone: "+91 141 277 8899",
      splashAnimationEnabled: true,
      logoUrl: null,
      primaryColor: "#6366F1",
    },
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({
      ok: true,
      message: "Company legal details and brand settings saved.",
      settings: body,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update settings";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
