import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { MODULES, type ModuleKey } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { sendMail } from "@/lib/email/send";
import { paymentReceiptEmail } from "@/lib/email/templates";
import { buildInvoice, type Buyer } from "./invoice";
import { applyPlanModules, type ModuleSettingState } from "./plan-modules";
import { addMonths, financialYear, formatPaise, invoiceNumber, periodStart } from "./pricing";
import { capturePayment, fetchPayment, RazorpayError, type RazorpayPayment } from "./razorpay";
import type { SellerSettings } from "./seller";
import { loadSeller } from "./store";

type Tx = Prisma.TransactionClient;

export function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://hrms.flowacord.com";
}

/**
 * Put a company's module settings in line with a plan (see
 * applyPlanModules for the rules). Returns what changed, for the audit.
 */
export async function applyPlanToTenant(
  tx: Tx,
  tenantId: string,
  planModules: string[],
  updatedById: string | null,
): Promise<ModuleSettingState[]> {
  const settings = await tx.tenantModuleSetting.findMany({
    where: { tenantId },
    include: { module: { select: { key: true } } },
  });
  const known = settings.filter((s) => s.module.key in MODULES);
  const moduleIdByKey = new Map(known.map((s) => [s.module.key, s.moduleId]));
  const changes = applyPlanModules(
    known.map((s) => ({
      key: s.module.key as ModuleKey,
      enabled: s.enabled,
      allowedByPlatform: s.allowedByPlatform,
    })),
    planModules,
  );
  for (const c of changes) {
    await tx.tenantModuleSetting.update({
      where: { tenantId_moduleId: { tenantId, moduleId: moduleIdByKey.get(c.key)! } },
      data: { enabled: c.enabled, allowedByPlatform: c.allowedByPlatform, updatedById },
    });
  }
  return changes;
}

/**
 * The part of settling that must be atomic: lock the payment row, take the
 * next invoice number, freeze the invoice, move the company onto its plan,
 * and audit. Runs inside the caller's transaction (tests roll it back, so
 * no real invoice number is ever used up by a test).
 */
export async function issueInvoiceTx(
  tx: Tx,
  input: {
    paymentRowId: string;
    razorpay: { id: string; method: string | null };
    seller: SellerSettings;
    /** The plan's modules now; null if the plan has gone. */
    planModules: string[] | null;
    actorUserId?: string;
    now: Date;
  },
) {
  const locked = await tx.$queryRaw<{ status: string }[]>`
    SELECT status::text AS status FROM billing_payments WHERE id = ${input.paymentRowId}::uuid FOR UPDATE`;
  const order = await tx.billingPayment.findUniqueOrThrow({ where: { id: input.paymentRowId } });
  if (locked[0]?.status === "PAID") return { row: order, already: true };
  const now = input.now;
  const tenant = await tx.tenant.findUnique({ where: { id: order.tenantId } });
  const start = tenant ? periodStart(tenant, now) : now;
  const end = addMonths(start, order.months);

  const fy = financialYear(now);
  const [counter] = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO invoice_counters ("financialYear", "last") VALUES (${fy}, 1)
    ON CONFLICT ("financialYear") DO UPDATE SET "last" = invoice_counters."last" + 1
    RETURNING "last"`;
  const number = invoiceNumber(fy, Number(counter.last));

  const invoice = buildInvoice({
    number,
    issuedAt: now,
    seller: input.seller,
    buyer: order.buyer as unknown as Buyer,
    planName: order.planName,
    cycle: order.cycle,
    months: order.months,
    employees: order.employees,
    rateRupees: order.rateRupees,
    subtotalPaise: order.subtotalPaise,
    cgstPaise: order.cgstPaise,
    sgstPaise: order.sgstPaise,
    igstPaise: order.igstPaise,
    totalPaise: order.totalPaise,
    periodStart: start,
    periodEnd: end,
    paymentId: input.razorpay.id,
    orderId: order.razorpayOrderId,
    method: input.razorpay.method,
  });

  const row = await tx.billingPayment.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      razorpayPaymentId: input.razorpay.id,
      paidAt: now,
      periodStart: start,
      periodEnd: end,
      invoiceNumber: number,
      invoice: invoice as unknown as object,
      failureReason: null,
    },
  });

  if (tenant) {
    await tx.tenant.update({
      where: { id: tenant.id },
      data: {
        plan: "PAID",
        billingPlanId: order.planId,
        billingCycle: order.cycle,
        paidUntil: end,
        trialEndsAt: null,
      },
    });
    const modules = input.planModules
      ? await applyPlanToTenant(tx, tenant.id, input.planModules, input.actorUserId ?? null)
      : [];
    await tx.auditEvent.create({
      data: {
        tenantId: tenant.id,
        actorType: input.actorUserId ? "USER" : "SYSTEM",
        actorUserId: input.actorUserId ?? null,
        action: "billing.payment_received",
        entityType: "billing_payment",
        entityId: order.id,
        before: {
          plan: tenant.plan,
          trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
          paidUntil: tenant.paidUntil?.toISOString() ?? null,
        },
        after: {
          plan: "PAID",
          billingPlan: order.planKey,
          cycle: order.cycle,
          paidUntil: end.toISOString(),
          invoiceNumber: number,
          totalPaise: order.totalPaise,
          modulesChanged: modules as unknown as object,
        },
      },
    });
  }
  return { row, already: false };
}

export type SettleResult =
  | { ok: true; id: string; invoiceNumber: string; paidUntil: Date; already: boolean }
  | { ok: false; error: string };

/** Razorpay's own word on a payment, captured if it was only authorised. */
async function confirmedWithRazorpay(
  razorpayPaymentId: string,
  orderId: string,
  totalPaise: number,
): Promise<{ ok: true; payment: RazorpayPayment } | { ok: false; error: string }> {
  try {
    let payment = await fetchPayment(razorpayPaymentId);
    if (payment.order_id !== orderId) return { ok: false, error: "This payment belongs to a different order." };
    if (payment.amount !== totalPaise || payment.currency !== "INR") {
      return { ok: false, error: "The amount paid doesn't match the order. Nothing was changed; contact help@flowacord.com." };
    }
    if (payment.status === "authorized") {
      try {
        payment = await capturePayment(payment.id, totalPaise);
      } catch {
        // Checkout and the webhook can both try; the other one may have won.
        payment = await fetchPayment(razorpayPaymentId);
      }
    }
    if (payment.status !== "captured") {
      return {
        ok: false,
        error: payment.error_description || `Razorpay says this payment is ${payment.status}, not complete.`,
      };
    }
    return { ok: true, payment };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof RazorpayError
          ? error.message
          : "We couldn't confirm the payment with Razorpay just now. If money left your account, it is matched automatically within a few minutes — you don't need to pay again.",
    };
  }
}

/**
 * Turn a successful Razorpay payment into a paid period and a tax invoice.
 *
 * Called from Checkout (the customer's browser) and from the webhook
 * (Razorpay's servers), in either order, possibly at the same moment. It is
 * idempotent: the payment row is locked, and a second caller finds it
 * already PAID and returns the same invoice. The payment is always
 * re-fetched from Razorpay — a signature proves who sent a message, not
 * that money moved.
 */
export async function settlePayment(input: {
  orderId: string;
  razorpayPaymentId: string;
  actorUserId?: string;
}): Promise<SettleResult> {
  const db = getDb();
  const order = await db.billingPayment.findUnique({ where: { razorpayOrderId: input.orderId } });
  if (!order) return { ok: false, error: "We couldn't find this order." };
  if (order.status === "PAID") {
    return { ok: true, id: order.id, invoiceNumber: order.invoiceNumber!, paidUntil: order.periodEnd!, already: true };
  }

  const confirmed = await confirmedWithRazorpay(input.razorpayPaymentId, input.orderId, order.totalPaise);
  if (!confirmed.ok) {
    await db.billingPayment
      .update({ where: { id: order.id }, data: { failureReason: confirmed.error.slice(0, 300) } })
      .catch(() => undefined);
    return confirmed;
  }
  const rp = confirmed.payment;

  const [seller, plan] = await Promise.all([
    loadSeller(),
    db.billingPlan.findUnique({ where: { id: order.planId } }),
  ]);

  const outcome = await db.$transaction(
    (tx) =>
      issueInvoiceTx(tx, {
        paymentRowId: order.id,
        razorpay: { id: rp.id, method: rp.method ?? null },
        seller,
        planModules: plan?.modules ?? null,
        actorUserId: input.actorUserId,
        now: new Date(),
      }),
    { timeout: 20_000, maxWait: 10_000 },
  );

  const { row } = outcome;
  if (!outcome.already) {
    const buyer = order.buyer as unknown as Buyer;
    const payer = order.createdById
      ? await db.user.findUnique({ where: { id: order.createdById }, select: { displayName: true, email: true } })
      : null;
    const to = payer?.email ?? buyer.email;
    if (to) {
      await sendMail({
        to,
        ...paymentReceiptEmail({
          name: payer?.displayName ?? buyer.name,
          companyName: order.tenantName,
          planName: order.planName,
          invoiceNumber: row.invoiceNumber!,
          total: formatPaise(order.totalPaise),
          paidUntil: row.periodEnd!,
          invoiceUrl: `${siteOrigin()}/subscription/invoice/${order.id}`,
        }),
      }).catch(() => undefined);
    }
  }

  return {
    ok: true,
    id: row.id,
    invoiceNumber: row.invoiceNumber!,
    paidUntil: row.periodEnd!,
    already: outcome.already,
  };
}
