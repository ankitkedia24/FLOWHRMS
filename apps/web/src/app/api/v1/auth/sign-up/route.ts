import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Sign-Up & Trial Creation Route (POST /api/v1/auth/sign-up)
 * Creates a new company tenant and assigns 30-day Pro trial.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      companyName,
      fullName,
      email,
      mobileNumber,
      password,
      teamSize,
      industry,
      dpdpConsent,
    } = body;

    if (!companyName || !fullName || !email || !password) {
      return NextResponse.json(
        { ok: false, error: "Company name, full name, email and password are required." },
        { status: 400 }
      );
    }

    if (!dpdpConsent) {
      return NextResponse.json(
        { ok: false, error: "DPDP Act 2023 consent agreement is required." },
        { status: 400 }
      );
    }

    const tenantId = `tenant-${companyName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 24)}`;

    return NextResponse.json({
      ok: true,
      message: `Welcome to FlowHRMS! 30-day Pro Trial activated for ${companyName}.`,
      tenant: {
        id: tenantId,
        name: companyName,
        industry: industry || "Logistics",
        teamSize: teamSize || "11-50",
        trialDaysLeft: 30,
        plan: "Pro Trial",
      },
      user: {
        id: "usr-owner-new",
        email,
        name: fullName,
        role: "Owner",
        mobile: mobileNumber,
      },
      session: {
        accessToken: "mock-jwt-token-new-trial",
        expiresAt: Date.now() + 86400000 * 30,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
