import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobile Subscription & Billing API (GET & POST /api/v1/billing)
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      currentPlan: "Pro Trial",
      trialDaysLeft: 26,
      endDateStr: "27 Oct 2026",
      activeSeats: 2,
      maxSeats: 50,
      plans: [
        {
          key: "STARTER",
          name: "Starter",
          monthlyPrice: 999,
          annualPrice: 9990,
          seatLimit: 15,
          features: ["GPS Geofenced Punch", "Leave & Holidays", "Mobile ID Cards"],
        },
        {
          key: "GROWTH",
          name: "Growth",
          popular: true,
          monthlyPrice: 2499,
          annualPrice: 24990,
          seatLimit: 50,
          features: [
            "Everything in Starter",
            "Statutory Payroll Automation",
            "Field Task Proof Verification",
            "WhatsApp Pulse Notifications",
          ],
        },
        {
          key: "ENTERPRISE",
          name: "Enterprise",
          monthlyPrice: 5999,
          annualPrice: 59990,
          seatLimit: 250,
          features: [
            "Everything in Growth",
            "Custom Geofences & Clusters",
            "Dedicated Account Manager",
            "Priority Support SLA",
          ],
        },
      ],
      invoices: [
        {
          id: "INV-2026-001",
          date: "01 Oct 2026",
          planName: "Pro Trial Activation",
          amount: 0,
          gst: 0,
          total: 0,
          status: "PAID",
          downloadUrl: "/api/v1/billing/invoices/INV-2026-001.pdf",
        },
      ],
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { planKey, cadence, paymentMethod } = body;

    return NextResponse.json({
      ok: true,
      message: `Order for ${planKey || "Growth"} plan (${cadence || "Annual"}) initiated via ${paymentMethod || "UPI"}.`,
      orderId: `order_${Date.now()}`,
      amount: cadence === "yearly" ? 24990 : 2499,
      gstAmount: cadence === "yearly" ? 4498.2 : 449.82,
      currency: "INR",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
