import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import type { InvoiceDoc } from "@/lib/billing/invoice";
import { canManageBilling } from "@/lib/billing/policy";
import { GST_STATE_CODES, formatPaise } from "@/lib/billing/pricing";
import { FlowHRMSLockup } from "@/components/brand/FlowHRMSWordmark";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "Tax invoice", robots: { index: false } };

/**
 * A tax invoice, exactly as issued. Rendered from the snapshot frozen when
 * the payment succeeded (billing_payments.invoice) — never recomputed, so a
 * later change of plan price, address or seller details cannot alter it.
 * The company's owner and admins can open it; so can Flowacord.
 */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const session = await requireSession({ allowPaused: true });
  const payment = await getDb().billingPayment.findUnique({ where: { id } });
  if (!payment || payment.status !== "PAID" || !payment.invoice) notFound();

  const ownCompany = payment.tenantId === session.tenant.id && canManageBilling(session);
  if (!ownCompany && !session.user.isPlatformAdmin) redirect("/unauthorized");

  const inv = payment.invoice as unknown as InvoiceDoc;
  const date = (iso: string) =>
    new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(
      new Date(iso),
    );
  const sellerCode = GST_STATE_CODES[inv.seller.state] ?? "";
  const intra = inv.cgstPaise > 0 || inv.sgstPaise > 0;

  return (
    <main data-surface="admin" className="mx-auto w-full max-w-[860px] px-4 pb-12 pt-6 sm:px-6 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={ownCompany ? "/subscription" : `/platform/billing`}
          className="inline-flex items-center gap-1.5 text-secondary font-semibold text-brand-primary underline-offset-2 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> {ownCompany ? "Subscription" : "Billing"}
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-surface-card border border-border-default bg-white p-6 text-[14px] leading-relaxed text-[#1A1A1A] sm:p-8 print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E3E1EC] pb-5">
          <div>
            <FlowHRMSLockup height={24} />
            <p className="mt-3 font-semibold">{inv.seller.legalName}</p>
            {inv.seller.tradeName && inv.seller.tradeName !== inv.seller.legalName && (
              <p className="text-[#5A5A5A]">Trading as {inv.seller.tradeName}</p>
            )}
            <p className="text-[#5A5A5A]">
              {inv.seller.address}
              {inv.seller.city ? `, ${inv.seller.city}` : ""}
              <br />
              {inv.seller.state}
              {sellerCode ? ` (${sellerCode})` : ""}
              {inv.seller.pincode ? ` — ${inv.seller.pincode}` : ""}
            </p>
            <p className="mt-1">
              GSTIN <span className="font-mono font-semibold">{inv.seller.gstin}</span>
            </p>
            <p className="text-[#5A5A5A]">
              {inv.seller.email} · {inv.seller.phone}
            </p>
          </div>
          <div className="text-right">
            <h1 className="font-heading text-[22px] font-bold tracking-wide">TAX INVOICE</h1>
            <p className="text-[12px] text-[#5A5A5A]">Original for recipient</p>
            <dl className="mt-3 grid grid-cols-[auto_auto] justify-end gap-x-3 gap-y-0.5 text-left">
              <dt className="text-[#5A5A5A]">Invoice no.</dt>
              <dd className="font-mono font-semibold">{inv.number}</dd>
              <dt className="text-[#5A5A5A]">Date</dt>
              <dd className="font-mono">{date(inv.issuedAt)}</dd>
              <dt className="text-[#5A5A5A]">Place of supply</dt>
              <dd>
                {inv.placeOfSupply.state}
                {inv.placeOfSupply.code ? ` (${inv.placeOfSupply.code})` : ""}
              </dd>
              <dt className="text-[#5A5A5A]">Reverse charge</dt>
              <dd>No</dd>
            </dl>
          </div>
        </header>

        <section className="grid gap-4 border-b border-[#E3E1EC] py-5 sm:grid-cols-2">
          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[#5A5A5A]">Bill to</h2>
            <p className="mt-1 font-semibold">{inv.buyer.name}</p>
            <p className="text-[#5A5A5A]">
              {inv.buyer.address}, {inv.buyer.city}
              <br />
              {inv.buyer.state}
              {inv.placeOfSupply.code ? ` (${inv.placeOfSupply.code})` : ""} — {inv.buyer.pincode}
            </p>
            <p className="mt-1">
              {inv.buyer.gstin ? (
                <>
                  GSTIN <span className="font-mono font-semibold">{inv.buyer.gstin}</span>
                </>
              ) : (
                <span className="text-[#5A5A5A]">Unregistered (no GSTIN)</span>
              )}
            </p>
          </div>
          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[#5A5A5A]">Service period</h2>
            <p className="mt-1 font-mono">
              {date(inv.period.start)} – {date(inv.period.end)}
            </p>
            <h2 className="mt-3 text-[12px] font-semibold uppercase tracking-wider text-[#5A5A5A]">Payment</h2>
            <p>
              Paid in full by {inv.payment.gateway}
              {inv.payment.method ? ` (${inv.payment.method})` : ""}
            </p>
            <p className="break-all font-mono text-[12px] text-[#5A5A5A]">{inv.payment.paymentId}</p>
          </div>
        </section>

        <div className="overflow-x-auto">
          <table className="mt-5 w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="border-b border-[#1A1A1A] text-left text-[12px] uppercase tracking-wider text-[#5A5A5A]">
                <th className="py-2 pr-3 font-semibold">Description</th>
                <th className="py-2 pr-3 font-semibold">SAC</th>
                <th className="py-2 pr-3 text-right font-semibold">Quantity</th>
                <th className="py-2 pr-3 text-right font-semibold">Rate</th>
                <th className="py-2 text-right font-semibold">Taxable value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#E3E1EC] align-top">
                <td className="py-3 pr-3">{inv.line.description}</td>
                <td className="py-3 pr-3 font-mono">{inv.line.sac}</td>
                <td className="py-3 pr-3 text-right">
                  <span className="font-mono">{inv.line.employees * inv.line.months}</span>
                  <span className="block text-[12px] text-[#5A5A5A]">
                    {inv.line.employees} × {inv.line.months} {inv.line.months === 1 ? "month" : "months"}
                  </span>
                </td>
                <td className="py-3 pr-3 text-right">
                  <span className="font-mono">{formatPaise(inv.line.rateRupees * 100)}</span>
                  <span className="block text-[12px] text-[#5A5A5A]">per employee-month</span>
                </td>
                <td className="py-3 text-right font-mono">{formatPaise(inv.line.amountPaise)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <dl className="ml-auto mt-4 grid w-full max-w-[340px] grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          <dt className="text-[#5A5A5A]">Taxable value</dt>
          <dd className="text-right font-mono">{formatPaise(inv.subtotalPaise)}</dd>
          {intra ? (
            <>
              <dt className="text-[#5A5A5A]">CGST @ 9%</dt>
              <dd className="text-right font-mono">{formatPaise(inv.cgstPaise)}</dd>
              <dt className="text-[#5A5A5A]">SGST @ 9%</dt>
              <dd className="text-right font-mono">{formatPaise(inv.sgstPaise)}</dd>
            </>
          ) : (
            <>
              <dt className="text-[#5A5A5A]">IGST @ 18%</dt>
              <dd className="text-right font-mono">{formatPaise(inv.igstPaise)}</dd>
            </>
          )}
          <dt className="mt-1 border-t border-[#1A1A1A] pt-2 font-semibold">Total</dt>
          <dd className="mt-1 border-t border-[#1A1A1A] pt-2 text-right font-mono text-[16px] font-bold">
            {formatPaise(inv.totalPaise)}
          </dd>
        </dl>
        <p className="mt-3 text-right text-[13px] text-[#5A5A5A]">{inv.amountInWords}</p>

        <footer className="mt-8 border-t border-[#E3E1EC] pt-4 text-[12px] text-[#5A5A5A]">
          <p>This is a computer-generated invoice and does not require a signature.</p>
          <p>
            Questions about this invoice: {inv.seller.email} · {inv.seller.phone}
          </p>
        </footer>
      </article>
    </main>
  );
}
