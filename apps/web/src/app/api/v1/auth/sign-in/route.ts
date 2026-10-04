import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDb, hasDatabaseConfig } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Mobile Sign-In Route (POST /api/v1/auth/sign-in)
 * Validates credentials via Supabase Auth or returns seeded demo accounts
 * for local development and physical device testing.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    // Try Supabase Auth if credentials configured
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data.user) {
        return NextResponse.json({
          ok: true,
          user: {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name ?? email.split("@")[0],
            role: email.includes("admin") ? "Owner" : "Employee",
          },
          session: {
            accessToken: data.session?.access_token,
            expiresAt: data.session?.expires_at,
          },
          tenant: {
            id: "tenant-jaipur-logistics",
            name: "FX & Float Logistics",
            code: "FXFL",
          },
        });
      }
    }

    // Development fallback for demo credentials
    if (
      (email === "admin@flowacord.com" && password === "FlowHRMS2026!") ||
      (email === "ramesh.kumar@flowacord.com" && password === "JaipurField2026#") ||
      process.env.NODE_ENV === "development"
    ) {
      const isOwner = email.includes("admin");
      return NextResponse.json({
        ok: true,
        user: {
          id: isOwner ? "usr-admin-001" : "usr-field-0428",
          email,
          name: isOwner ? "Rishabh Kedia" : "Ramesh Kumar",
          role: isOwner ? "Owner" : "Field Specialist",
          employeeCode: isOwner ? "EMP-0001" : "EMP-0428",
        },
        session: {
          accessToken: "mock-jwt-token-flowhrms",
          expiresAt: Date.now() + 86400000 * 30,
        },
        tenant: {
          id: "tenant-jaipur-logistics",
          name: "FX & Float Logistics",
          code: "FXFL",
          cluster: "Jaipur Central Cluster",
        },
      });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid work email or password." },
      { status: 401 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Authentication failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
