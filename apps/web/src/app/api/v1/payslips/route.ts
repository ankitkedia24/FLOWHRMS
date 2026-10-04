import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Payslips API (GET /api/v1/payslips)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fy = searchParams.get("fy") || "FY 2026-27";

  return NextResponse.json({
    ok: true,
    financialYear: fy,
    data: [
      {
        id: "slip-sep-2026",
        month: "September 2026",
        period: "01 Sep 2026 - 30 Sep 2026",
        basicSalary: 18000,
        hra: 7200,
        specialAllowance: 3800,
        grossEarnings: 29000,
        epf: 2160,
        esic: 217,
        professionalTax: 200,
        totalDeductions: 2577,
        netPayable: 26423,
        disbursedOn: "01 Oct 2026",
        paymentMode: "Direct Bank Transfer (HDFC Bank)",
        status: "DISBURSED",
        pdfUrl: "/api/v1/payslips/download?id=slip-sep-2026",
      },
      {
        id: "slip-aug-2026",
        month: "August 2026",
        period: "01 Aug 2026 - 31 Aug 2026",
        basicSalary: 18000,
        hra: 7200,
        specialAllowance: 3800,
        grossEarnings: 29000,
        epf: 2160,
        esic: 217,
        professionalTax: 200,
        totalDeductions: 2577,
        netPayable: 26423,
        disbursedOn: "01 Sep 2026",
        paymentMode: "Direct Bank Transfer (HDFC Bank)",
        status: "DISBURSED",
        pdfUrl: "/api/v1/payslips/download?id=slip-aug-2026",
      },
    ],
  });
}
