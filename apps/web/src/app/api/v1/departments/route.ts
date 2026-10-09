import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Departments API (GET & POST /api/v1/departments)
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: [
      {
        id: "dept-01",
        name: "Operations & Fleet",
        code: "OPS",
        lead: "CodeSchool Admin",
        memberCount: 1,
        description: "Core warehouse dispatch, delivery route handling, and ground fleet.",
      },
      {
        id: "dept-02",
        name: "Field Logistics",
        code: "LOG",
        lead: "Ramesh Kumar",
        memberCount: 1,
        description: "Store visitation, client pickups, and stock receipt verification.",
      },
      {
        id: "dept-03",
        name: "Human Resources",
        code: "HR",
        lead: "CodeSchool Admin",
        memberCount: 1,
        description: "Staff onboarding, statutory EPF/ESIC filings, and shift attendance.",
      },
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, lead, code, description } = body;

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Department name is required." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Department "${name}" created successfully.`,
      department: {
        id: `dept-${Date.now()}`,
        name,
        code: code || name.slice(0, 3).toUpperCase(),
        lead: lead || "Unassigned",
        memberCount: 0,
        description: description || "",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create department";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
