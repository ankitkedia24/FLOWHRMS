import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function isUuid(val?: string | null): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slipId = searchParams.get("id");

    if (!slipId || !isUuid(slipId)) {
      return new NextResponse("Invalid payslip ID", { status: 400 });
    }

    const db = getDb();
    const line = await db.payrollLine.findUnique({
      where: { id: slipId },
      include: {
        run: true,
        adjustments: true,
        membership: {
          include: {
            user: true,
            tenant: true,
          },
        },
      },
    });

    if (!line) {
      return new NextResponse("Payslip not found", { status: 404 });
    }

    const periodDate = new Date(line.run.periodMonth);
    const monthName = periodDate.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
    const empName = line.membership.user.displayName;
    const empCode = line.membership.employeeCode || "N/A";
    const company = line.membership.tenant.name;

    const earnings = (line.earnings as any[]) || [];
    const deductions = (line.deductions as any[]) || [];

    const textContent = `
================================================================================
                          ${company.toUpperCase()}
                           OFFICIAL SALARY STATEMENT
================================================================================
Month & Year     : ${monthName}
Employee Name    : ${empName}
Employee Code    : ${empCode}
Email            : ${line.membership.user.email ?? "N/A"}
Designation      : ${line.membership.designation ?? "Staff"}
Pay Period       : 01 ${monthName.slice(0, 3)} - ${line.calendarDays} ${monthName.slice(0, 3)} ${periodDate.getUTCFullYear()}
Disbursed On     : ${line.run.approvedAt ? new Date(line.run.approvedAt).toLocaleDateString("en-IN") : "Pending"}
Status           : ${line.run.status}
--------------------------------------------------------------------------------
ATTENDANCE & DAYS SUMMARY:
  Total Days in Month    : ${line.calendarDays}
  Working Days           : ${line.workingDays}
  Weekly Offs (Paid)     : ${line.weeklyOffDays}
  Paid Holidays          : ${line.holidayDays}
  Present Days           : ${Number(line.presentDays)}
  Paid Leave Days        : ${Number(line.paidLeaveDays)}
  Unpaid Leave Days      : ${Number(line.unpaidDays)}
  Payable Days           : ${Number(line.payableDays)}
  Late Minutes           : ${line.lateMinutes}
  Late Deduction Days    : ${Number(line.lateDeductionDays)}
--------------------------------------------------------------------------------
EARNINGS:
${earnings.map((e) => `  ${e.name.padEnd(28)} : ₹${Number(e.amount).toLocaleString("en-IN")}`).join("\n")}
  ------------------------------------------------------------------------------
  GROSS EARNINGS               : ₹${Number(line.gross).toLocaleString("en-IN")}

DEDUCTIONS:
${deductions.map((d) => `  ${d.name.padEnd(28)} : ₹${Number(d.amount).toLocaleString("en-IN")}`).join("\n")}
  ------------------------------------------------------------------------------
  TOTAL DEDUCTIONS             : ₹${Number(line.deductionTotal).toLocaleString("en-IN")}
${
  line.adjustments.length > 0
    ? `\nADJUSTMENTS:\n${line.adjustments.map((a) => `  ${a.label.padEnd(28)} : ₹${Number(a.amount).toLocaleString("en-IN")} (${a.reason})`).join("\n")}\n  NET ADJUSTMENTS              : ₹${Number(line.adjustmentTotal).toLocaleString("en-IN")}`
    : ""
}
--------------------------------------------------------------------------------
NET PAYABLE                    : ₹${Number(line.net).toLocaleString("en-IN")}
--------------------------------------------------------------------------------
NOTE:
This document is system-generated and verified with tenant attendance and
payroll records in accordance with FlowHRMS Constitution §6.
Amounts are rounded to whole rupees (half-up).
================================================================================
`.trim();

    return new NextResponse(textContent, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="Payslip_${monthName.replace(/\s+/g, "_")}_${empCode}.txt"`,
      },
    });
  } catch (err: any) {
    return new NextResponse(err?.message || "Internal error", { status: 500 });
  }
}
