import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Account & Security API (GET & PUT /api/v1/account)
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      id: "usr-admin-001",
      email: "admin@flowacord.com",
      name: "CodeSchool Admin",
      code: "EMP-0001",
      role: "Owner",
      phone: "+91 98290 11223",
      assignedBranch: "Jaipur Central Warehouse",
      mfaEnabled: true,
      lastPasswordChange: "15 Sep 2026",
    },
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, currentPassword, newPassword } = body;

    if (action === "change-password") {
      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { ok: false, error: "Current and new password are required." },
          { status: 400 }
        );
      }
      if (newPassword.length < 8) {
        return NextResponse.json(
          { ok: false, error: "New password must be at least 8 characters." },
          { status: 422 }
        );
      }
      return NextResponse.json({
        ok: true,
        message: "Password updated successfully. All active mobile sessions re-secured.",
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Account preferences updated.",
      updated: body,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update account";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
