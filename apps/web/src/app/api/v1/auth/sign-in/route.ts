import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDb, hasDatabaseConfig } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Mobile Sign-In Route (POST /api/v1/auth/sign-in)
 * Validates credentials via Supabase Auth or returns seeded demo accounts
 * for local development and physical device testing.
 *
 * WHY THIS EXISTS (and why the web works differently):
 * The web app signs in CLIENT-SIDE — the browser calls Supabase Auth
 * directly (see SignInForm.tsx → supabase.auth.signInWithPassword).
 * That works because the browser has cookies and can store a session.
 *
 * The mobile app (Expo Go) cannot use Supabase's cookie-based browser
 * flow. Instead it calls THIS server route, which tries Supabase Auth
 * server-side, then returns the session token for the app to store
 * in SecureStore. If Supabase Auth is unavailable (paused project,
 * placeholder keys, timeout), it falls through to demo credentials.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-email, x-user-id, x-tenant-id",
    },
  });
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📱 POST /api/v1/auth/sign-in");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = body;

    console.log(`📧 Email: ${email || "(missing)"}`);
    console.log(`🔑 Password: ${password ? "••••••••" : "(missing)"}`);
    console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV}`);

    if (!email || !password) {
      console.log("❌ Missing email or password — returning 400");
      return NextResponse.json(
        { ok: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    // Try Supabase Auth if credentials configured (with timeout to avoid 408s)
    console.log("\n🔌 Step 1: Attempting Supabase Auth...");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    console.log(`   SUPABASE_URL: ${supabaseUrl ? supabaseUrl.substring(0, 30) + "..." : "❌ NOT SET"}`);
    console.log(`   SUPABASE_KEY: ${supabaseKey ? supabaseKey.substring(0, 20) + "..." : "❌ NOT SET"}`);

    const supabase = await createSupabaseServerClient();
    console.log(`   Supabase client created: ${supabase ? "✅ yes" : "⚠️  null (keys missing)"}`);

    if (supabase) {
      try {
        console.log("   ⏳ Calling supabase.auth.signInWithPassword (5s timeout)...");
        const authPromise = supabase.auth.signInWithPassword({
          email,
          password,
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Supabase auth timeout")), 5000)
        );
        const { data, error } = await Promise.race([authPromise, timeoutPromise]) as Awaited<typeof authPromise>;

        const elapsed = Date.now() - startTime;
        console.log(`   ⏱️  Supabase responded in ${elapsed}ms`);

        if (error) {
          console.log(`   ⚠️  Supabase auth error: ${error.message}`);
          console.log("   ➡️  Falling through to dev fallback...");
        } else if (data.user) {
          console.log(`   ✅ Supabase auth SUCCESS — user: ${data.user.email} (${data.user.id})`);
          console.log(`   🎫 Session token: ${data.session?.access_token ? "present" : "missing"}`);
          
          // Check database for real tenant & role
          let assignedRole = data.user.user_metadata?.role;
          let tenantInfo = {
            id: "19cc363d-f16f-4f4d-a6ea-102e336e24d9",
            name: "Demo Trading Co.",
            code: "DEMO",
          };

          try {
            const db = getDb();
            const dbUser = await db.user.findFirst({
              where: {
                OR: [
                  { email: { equals: email, mode: "insensitive" } },
                  { authUserId: data.user.id },
                ],
              },
              include: {
                memberships: {
                  include: { tenant: true, role: true },
                  orderBy: { updatedAt: "desc" },
                },
              },
            });

            // Find relevant membership (prioritize shared tenant or latest updated)
            const activeMembership =
              dbUser?.memberships?.find(
                (m) => m.tenantId === "19cc363d-f16f-4f4d-a6ea-102e336e24d9"
              ) || dbUser?.memberships?.[0];

            if (activeMembership) {
              tenantInfo = {
                id: activeMembership.tenant.id,
                name: activeMembership.tenant.name,
                code: activeMembership.tenant.slug?.toUpperCase() || "FLUX",
              };
              if (
                activeMembership.role?.key === "OWNER" ||
                activeMembership.role?.key === "ADMIN" ||
                activeMembership.role?.key === "SUPER_ADMIN"
              ) {
                assignedRole = "Owner";
              } else {
                assignedRole = "Employee";
              }
            }
          } catch (e) {
            console.warn("Could not query DB tenant on sign in:", e);
          }

          if (!assignedRole) {
            assignedRole = email.toLowerCase().includes("admin") ? "Owner" : "Employee";
          }

          return NextResponse.json({
            ok: true,
            user: {
              id: data.user.id,
              email: data.user.email,
              name: data.user.user_metadata?.name ?? email.split("@")[0],
              role: assignedRole,
            },
            session: {
              accessToken: data.session?.access_token,
              expiresAt: data.session?.expires_at,
            },
            tenant: tenantInfo,
          });
        } else {
          console.log("   ⚠️  No error but no user returned — falling through");
        }
      } catch (err) {
        const elapsed = Date.now() - startTime;
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`   ⏱️  Supabase failed after ${elapsed}ms: ${msg}`);
        console.log("   ➡️  Falling through to dev fallback...");
      }
    }

    // Development fallback for demo credentials
    console.log("\n🔧 Step 2: Checking dev fallback...");
    const isDemoOwner = email === "admin@flowacord.com" && password === "FlowHRMS2026!";
    const isDemoField = email === "ramesh.kumar@flowacord.com" && password === "JaipurField2026#";
    const isDev = process.env.NODE_ENV === "development";
    console.log(`   Demo owner match: ${isDemoOwner}`);
    console.log(`   Demo field match: ${isDemoField}`);
    console.log(`   Dev environment:  ${isDev}`);

    if (isDemoOwner || isDemoField || isDev) {
      const isOwner = email.toLowerCase().includes("admin") || email.toLowerCase().includes("codeschoolrp");
      const elapsed = Date.now() - startTime;
      console.log(`   ✅ Dev fallback SUCCESS (${isOwner ? "Owner" : "Employee"}) in ${elapsed}ms`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
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
          id: "19cc363d-f16f-4f4d-a6ea-102e336e24d9",
          name: "Demo Trading Co.",
          code: "DEMO",
          cluster: "Jaipur Central Cluster",
        },
      });
    }

    const elapsed = Date.now() - startTime;
    console.log(`   ❌ No match — returning 401 (${elapsed}ms)`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return NextResponse.json(
      { ok: false, error: "Invalid work email or password." },
      { status: 401 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Authentication failed";
    const elapsed = Date.now() - startTime;
    console.log(`   💥 UNCAUGHT ERROR (${elapsed}ms): ${message}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
