import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Documents Vault API (GET & POST /api/v1/documents)
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: [
      {
        id: "doc-01",
        title: "Aadhaar Card (Masked)",
        type: "GOVT_ID",
        size: "1.2 MB",
        uploadedOn: "01 Oct 2026",
        verified: true,
        encrypted: true,
      },
      {
        id: "doc-02",
        title: "Permanent Account Number (PAN)",
        type: "TAX_ID",
        size: "850 KB",
        uploadedOn: "01 Oct 2026",
        verified: true,
        encrypted: true,
      },
      {
        id: "doc-03",
        title: "Cancelled Cheque / Bank Proof",
        type: "BANK_PROOF",
        size: "2.1 MB",
        uploadedOn: "02 Oct 2026",
        verified: true,
        encrypted: true,
      },
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { title, type, issueDate } = body;

    if (!title || !type) {
      return NextResponse.json(
        { ok: false, error: "Document title and type are required." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Document "${title}" encrypted and safely uploaded to vault.`,
      document: {
        id: `doc-${Date.now()}`,
        title,
        type,
        issueDate: issueDate || new Date().toISOString().split("T")[0],
        uploadedOn: "Just now",
        verified: false,
        encrypted: true,
        size: "1.5 MB",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to upload document";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
