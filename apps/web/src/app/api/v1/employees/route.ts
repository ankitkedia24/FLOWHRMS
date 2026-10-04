import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Employees API (GET & POST /api/v1/employees)
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: [
      {
        id: "emp-001",
        code: "EMP-0001",
        name: "Rishabh Kedia",
        email: "admin@flowacord.com",
        phone: "+91 98290 11223",
        role: "Owner",
        department: "Executive",
        designation: "Managing Director",
        status: "ACTIVE",
        shiftStatus: "Present (HQ)",
      },
      {
        id: "emp-428",
        code: "EMP-0428",
        name: "Ramesh Kumar",
        email: "ramesh.kumar@flowacord.com",
        phone: "+91 94140 88776",
        role: "Field Specialist",
        department: "Field Logistics",
        designation: "Senior Field Agent",
        status: "ACTIVE",
        shiftStatus: "Present (Jaipur Warehouse)",
      },
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, email, mobile, department, designation, role } = body;

    if (!name || !email) {
      return NextResponse.json(
        { ok: false, error: "Employee name and email are required." },
        { status: 400 }
      );
    }

    const code = `EMP-0${Math.floor(100 + Math.random() * 900)}`;

    return NextResponse.json({
      ok: true,
      message: `Invitation generated for ${name} (${code}). Onboarding instructions dispatched via SMS/WhatsApp.`,
      employee: {
        id: `emp-${Date.now()}`,
        code,
        name,
        email,
        phone: mobile || "+91 98000 00000",
        department: department || "Operations",
        designation: designation || "Field Specialist",
        role: role || "Employee",
        status: "INVITED",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to invite employee";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
