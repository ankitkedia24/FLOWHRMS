import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { financialYear, formatPaise } from "@/lib/billing/pricing";
import { razorpayKeys, razorpayMode } from "@/lib/billing/razorpay";
import { sellerGaps } from "@/lib/billing/seller";
import { loadSeller } from "@/lib/billing/store";
import { STATES_AND_UTS } from "@/lib/signup/catalog";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader } from "@/components/ui/Card";
import { SellerForm } from "./SellerForm";

export const metadata: Metadata = { title: "Billing" };

function fmt(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

/**
 * Money in: whether online payment is switched on, Flowacord's details on
 * every invoice, and every payment across companies.
 */
export default async function PlatformBillingPage() {
  await requirePlatformAdmin();
  const db = getDb();
  const fy = financialYear(new Date());
  const [seller, payments, fyTotal] = await Promise.all([
    loadSeller(),
    db.billingPayment.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    db.billingPayment.aggregate({
      where: { status: "PAID", invoiceNumber: { startsWith: `FH/${fy}/` } },
      _sum: { totalPaise: true, subtotalPaise: true },
      _count: true,
    }),
  ]);
  const keys = razorpayKeys();
  const mode = razorpayMode();
  const gaps = sellerGaps(seller);

  return (
    <>
      <h1 className="font-heading text-h1 text-text-primary">Billing</h1>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Online payment" />
          {!keys ? (
            <Alert variant="warning" title="Razorpay isn't connected">
              Add RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET to the server&apos;s environment
              (DEPLOY.md §7c), then redeploy. Companies see prices but can&apos;t pay until then.
            </Alert>
          ) : (
            <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-body">
              <dt className="text-text-secondary">Keys</dt>
              <dd className="text-text-primary">
                {mode === "live" ? "Live — real money" : "Test — no real money is taken"}
              </dd>
              <dt className="text-text-secondary">Webhook secret</dt>
              <dd className="text-text-primary">{keys.webhookSecret ? "Set" : "Missing — payments still work, but a closed tab isn't caught"}</dd>
              <dt className="text-text-secondary">Webhook URL</dt>
              <dd className="break-all font-mono text-secondary text-text-primary">
                https://hrms.flowacord.com/api/razorpay/webhook
              </dd>
              <dt className="text-text-secondary">Events</dt>
              <dd className="text-text-primary">payment.captured, order.paid, payment.failed</dd>
              <dt className="text-text-secondary">Invoice details</dt>
              <dd className="text-text-primary">{gaps.length ? `Missing: ${gaps.join(", ")}` : "Complete"}</dd>
            </dl>
          )}
          <p className="mt-4 text-secondary text-text-secondary">
            FY {fy.slice(0, 2)}–{fy.slice(2)}: {fyTotal._count} {fyTotal._count === 1 ? "invoice" : "invoices"},{" "}
            <span className="font-mono">{formatPaise(fyTotal._sum.totalPaise ?? 0)}</span> collected (
            <span className="font-mono">{formatPaise(fyTotal._sum.subtotalPaise ?? 0)}</span> before GST).
          </p>
        </Card>

        <Card>
          <CardHeader
            title="Flowacord on the invoice"
            meta="Printed at the top of every tax invoice. Changing it does not alter invoices already issued."
          />
          <SellerForm seller={seller} states={[...STATES_AND_UTS]} />
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Payments" meta="The latest 50, across every company." />
        {payments.length === 0 ? (
          <p className="text-secondary text-text-secondary">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-body">
              <thead>
                <tr className="border-b border-border-default text-caption text-text-secondary">
                  <th className="py-2 pr-3 font-semibold">When</th>
                  <th className="py-2 pr-3 font-semibold">Company</th>
                  <th className="py-2 pr-3 font-semibold">Plan</th>
                  <th className="py-2 pr-3 text-right font-semibold">Total</th>
                  <th className="py-2 font-semibold">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border-subtle last:border-0">
                    <td className="py-2 pr-3 font-mono text-secondary">{fmt(p.paidAt ?? p.createdAt)}</td>
                    <td className="py-2 pr-3">
                      <Link href={`/platform/companies/${p.tenantId}`} className="text-brand-primary underline-offset-2 hover:underline">
                        {p.tenantName}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      {p.planName} · {p.cycle === "ANNUAL" ? "yearly" : "monthly"} · {p.employees}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">{formatPaise(p.totalPaise)}</td>
                    <td className="py-2">
                      {p.status === "PAID" ? (
                        <Link href={`/subscription/invoice/${p.id}`} className="font-mono text-brand-primary underline-offset-2 hover:underline">
                          {p.invoiceNumber}
                        </Link>
                      ) : (
                        <span className="text-secondary text-text-secondary">
                          Not completed{p.failureReason ? ` — ${p.failureReason}` : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
