import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Designations API (GET & POST /api/v1/designations)
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: [
      {
        id: "des-01",
        title: "Managing Director",
        department: "Executive",
        accessLevel: "Owner",
        headcount: 1,
        active: true,
      },
      {
        id: "des-02",
        title: "Senior Field Agent",
        department: "Field Logistics",
        accessLevel: "Field Specialist",
        headcount: 1,
        active: true,
      },
      {
        id: "des-03",
        title: "Warehouse Associate",
        department: "Operations",
        accessLevel: "Employee",
        headcount: 0,
        active: true,
      },
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { title, department, accessLevel } = body;

    if (!title) {
      return NextResponse.json(
        { ok: false, error: "Designation title is required." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Designation "${title}" added.`,
      designation: {
        id: `des-${Date.now()}`,
        title,
        department: department || "Operations",
        accessLevel: accessLevel || "Employee",
        headcount: 0,
        active: true,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create designation";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
