import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { settlePayment } from "@/lib/billing/activate";
import { razorpayKeys } from "@/lib/billing/razorpay";
import { webhookSignatureValid } from "@/lib/billing/signature";

/**
 * Razorpay → FlowHRMS. The safety net for a customer who paid and then
 * closed the tab before Checkout could report back: Razorpay tells us
 * directly, and the company is marked paid all the same.
 *
 * Set up in the Razorpay dashboard (DEPLOY.md §7c): URL
 * https://hrms.flowacord.com/api/razorpay/webhook, events payment.captured,
 * order.paid and payment.failed, secret = RAZORPAY_WEBHOOK_SECRET.
 */

interface PaymentEntity {
  id: string;
  order_id: string | null;
  error_description?: string | null;
}

interface WebhookBody {
  event?: string;
  payload?: { payment?: { entity?: PaymentEntity } };
}

export async function POST(request: Request) {
  const keys = razorpayKeys();
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!keys?.webhookSecret || !webhookSignatureValid({ rawBody, signature, webhookSecret: keys.webhookSecret })) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const payment = body.payload?.payment?.entity;
  if (!payment?.order_id) return NextResponse.json({ ignored: true });

  if (body.event === "payment.captured" || body.event === "order.paid") {
    const result = await settlePayment({ orderId: payment.order_id, razorpayPaymentId: payment.id });
    // An order that isn't ours (another app on the same Razorpay account)
    // is acknowledged, or Razorpay retries it for a day.
    if (!result.ok && result.error === "We couldn't find this order.") return NextResponse.json({ ignored: true });
    // Anything else failing is worth a retry: answer 500 so Razorpay sends it again.
    return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "retry" }, { status: 500 });
  }

  if (body.event === "payment.failed") {
    await getDb()
      .billingPayment.updateMany({
        where: { razorpayOrderId: payment.order_id, status: "CREATED" },
        data: { failureReason: (payment.error_description ?? "Payment failed.").slice(0, 300) },
      })
      .catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}
