"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { settlePayment } from "./activate";
import type { Buyer } from "./invoice";
import { buyerSchema, canManageBilling, type BuyerInput } from "./policy";
import { MAX_ORDER_PAISE, quote, type Cycle } from "./pricing";
import { createOrder, RazorpayError, razorpayKeys } from "./razorpay";
import { sellerGaps } from "./seller";
import { checkoutSignatureValid } from "./signature";
import { activeEmployeeCount, loadSeller } from "./store";

/**
 * Paying for FlowHRMS from inside the app (/subscription). The server
 * decides every number: the browser says which plan and cycle, never the
 * price, the employee count or the tax.
 */

export interface CheckoutOptions {
  key: string;
  orderId: string;
  amount: number;
  currency: "INR";
  name: string;
  description: string;
  prefill: { name: string; email: string };
}

export type StartCheckoutResult =
  | { ok: true; checkout: CheckoutOptions }
  | { ok: false; error: string; field?: string };

/** Enough orders in an hour for any honest retry; not enough to spam Razorpay. */
const MAX_ORDERS_PER_HOUR = 10;

const startSchema = z.object({
  planKey: z.string().min(1).max(60),
  cycle: z.enum(["MONTHLY", "ANNUAL"]),
});

export async function startCheckoutAction(input: {
  planKey: string;
  cycle: Cycle;
  buyer: BuyerInput;
}): Promise<StartCheckoutResult> {
  const session = await requireSession({ allowPaused: true });
  if (!canManageBilling(session)) {
    return { ok: false, error: "Only the company's owner or an admin can pay." };
  }
  const choice = startSchema.safeParse(input);
  if (!choice.success) return { ok: false, error: "Choose a plan and how often to pay." };
  const parsedBuyer = buyerSchema.safeParse(input.buyer);
  if (!parsedBuyer.success) {
    const issue = parsedBuyer.error.issues[0];
    return { ok: false, error: issue?.message ?? "Check the billing details.", field: String(issue?.path[0] ?? "") };
  }

  const keys = razorpayKeys();
  const seller = await loadSeller();
  if (!keys || sellerGaps(seller).length > 0) {
    return {
      ok: false,
      error: "Online payment opens shortly. To pay today, write to help@flowacord.com or call +91 89088 88880.",
    };
  }

  const db = getDb();
  const plan = await db.billingPlan.findUnique({ where: { key: choice.data.planKey } });
  if (!plan || !plan.active) return { ok: false, error: "That plan isn't offered any more. Choose another." };

  const recent = await db.billingPayment.count({
    where: { tenantId: session.tenant.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_ORDERS_PER_HOUR) {
    return { ok: false, error: "Too many payment attempts in the last hour. Try again later, or write to help@flowacord.com." };
  }

  const employees = await activeEmployeeCount(session.tenant.id);
  const b = parsedBuyer.data;
  const q = quote({ plan, cycle: choice.data.cycle, employees, sellerState: seller.state, buyerState: b.state });
  if (q.totalPaise > MAX_ORDER_PAISE) {
    return { ok: false, error: "This is above what we take online. Write to help@flowacord.com and we'll invoice you directly." };
  }

  const buyer: Buyer = {
    name: b.name,
    gstin: b.gstin,
    address: b.address,
    city: b.city,
    state: b.state,
    pincode: b.pincode,
    email: session.user.email ?? "",
  };
  // Remember the invoice details for next time.
  await db.tenant.update({
    where: { id: session.tenant.id },
    data: {
      billingName: b.name,
      billingGstin: b.gstin || null,
      billingAddress: b.address,
      billingCity: b.city,
      billingState: b.state,
      billingPincode: b.pincode,
    },
  });

  let orderId: string;
  try {
    const order = await createOrder({
      amountPaise: q.totalPaise,
      receipt: `fh_${session.tenant.slug}_${Date.now()}`,
      notes: { tenantId: session.tenant.id, plan: plan.key, cycle: q.cycle, employees: String(q.employees) },
    });
    orderId = order.id;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof RazorpayError ? error.message : "We couldn't reach Razorpay. Try again in a minute.",
    };
  }

  await db.billingPayment.create({
    data: {
      tenantId: session.tenant.id,
      tenantName: session.tenant.name,
      planId: plan.id,
      planKey: plan.key,
      planName: plan.name,
      cycle: q.cycle,
      months: q.months,
      employees: q.employees,
      baseRupees: q.baseRupees,
      includedEmployees: q.includedEmployees,
      extraEmployees: q.extraEmployees,
      extraRateRupees: q.extraRateRupees,
      subtotalPaise: q.subtotalPaise,
      cgstPaise: q.cgstPaise,
      sgstPaise: q.sgstPaise,
      igstPaise: q.igstPaise,
      totalPaise: q.totalPaise,
      razorpayOrderId: orderId,
      buyer: buyer as unknown as object,
      createdById: session.user.id,
    },
  });
  await db.auditEvent.create({
    data: {
      tenantId: session.tenant.id,
      actorUserId: session.user.id,
      action: "billing.checkout_started",
      entityType: "billing_payment",
      entityId: orderId,
      after: {
        plan: plan.key,
        cycle: q.cycle,
        employees: q.employees,
        extraEmployees: q.extraEmployees,
        totalPaise: q.totalPaise,
      },
    },
  });

  return {
    ok: true,
    checkout: {
      key: keys.keyId,
      orderId,
      amount: q.totalPaise,
      currency: "INR",
      name: seller.tradeName || "Flowacord",
      description: `FlowHRMS ${plan.name} · ${q.cycle === "ANNUAL" ? "1 year" : "1 month"} · ${q.employees} ${q.employees === 1 ? "employee" : "employees"}`,
      prefill: { name: session.user.displayName, email: session.user.email ?? "" },
    },
  };
}

export type ConfirmResult =
  | { ok: true; message: string; paymentId: string }
  | { ok: false; error: string };

const confirmSchema = z.object({
  orderId: z.string().min(1).max(60),
  paymentId: z.string().min(1).max(60),
  signature: z.string().min(1).max(200),
});

/** Checkout's success handler lands here with Razorpay's signed receipt. */
export async function confirmCheckoutAction(input: z.input<typeof confirmSchema>): Promise<ConfirmResult> {
  const session = await requireSession({ allowPaused: true });
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "The payment reply was incomplete." };
  const keys = razorpayKeys();
  const valid =
    keys &&
    checkoutSignatureValid({
      orderId: parsed.data.orderId,
      paymentId: parsed.data.paymentId,
      signature: parsed.data.signature,
      keySecret: keys.keySecret,
    });
  if (!valid) return { ok: false, error: "We couldn't verify this payment. If money left your account, write to help@flowacord.com." };

  const order = await getDb().billingPayment.findUnique({ where: { razorpayOrderId: parsed.data.orderId } });
  if (!order || order.tenantId !== session.tenant.id) return { ok: false, error: "We couldn't find this order." };

  const result = await settlePayment({
    orderId: parsed.data.orderId,
    razorpayPaymentId: parsed.data.paymentId,
    actorUserId: session.user.id,
  });
  if (!result.ok) return result;
  revalidatePath("/subscription");
  revalidatePath("/admin", "layout");
  const until = result.paidUntil.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: session.tenant.timezone,
  });
  return {
    ok: true,
    paymentId: result.id,
    message: `Payment received — thank you. Your plan runs until ${until}. Invoice ${result.invoiceNumber} is ready.`,
  };
}

/** Checkout reported a failed attempt. Recorded for support; nothing else changes. */
export async function reportCheckoutFailureAction(input: { orderId: string; reason: string }): Promise<void> {
  const session = await requireSession({ allowPaused: true });
  const db = getDb();
  const order = await db.billingPayment.findUnique({ where: { razorpayOrderId: String(input.orderId).slice(0, 60) } });
  if (!order || order.tenantId !== session.tenant.id || order.status !== "CREATED") return;
  await db.billingPayment.update({
    where: { id: order.id },
    data: { failureReason: String(input.reason ?? "").slice(0, 300) || "Payment failed at checkout." },
  });
}

