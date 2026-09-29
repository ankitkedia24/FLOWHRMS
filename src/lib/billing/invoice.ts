import { GST_STATE_CODES, rupeesInWords, type Cycle } from "./pricing";
import type { SellerSettings } from "./seller";

/**
 * A tax invoice, frozen as data when the payment succeeds. The printable
 * page only renders this — it never recomputes — so what the customer
 * downloads next year is exactly what was issued (CGST Rules r.46).
 */

export interface Buyer {
  name: string;
  /** Empty for an unregistered buyer (a B2C invoice). */
  gstin: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  email: string;
}

export interface InvoiceLine {
  description: string;
  sac: string;
  quantity: number;
  /** What one of `quantity` is: "plan" (the base price), "employee". */
  unit: "plan" | "employee";
  rateRupees: number;
  amountPaise: number;
}

export interface InvoiceDoc {
  number: string;
  /** ISO timestamp of issue (= payment). */
  issuedAt: string;
  seller: SellerSettings;
  buyer: Buyer;
  placeOfSupply: { state: string; code: string };
  reverseCharge: false;
  /** The plan for the period, then (if any) the employees above what it includes. */
  lines: InvoiceLine[];
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  amountInWords: string;
  period: { start: string; end: string };
  payment: { gateway: "Razorpay"; paymentId: string; orderId: string; method: string | null };
}

export function buildInvoice(input: {
  number: string;
  issuedAt: Date;
  seller: SellerSettings;
  buyer: Buyer;
  planName: string;
  cycle: Cycle;
  months: number;
  /** The plan's base price for the period, and the employees it covered. */
  baseRupees: number;
  includedEmployees: number;
  /** Employees above that, and each one's price for the period. */
  extraEmployees: number;
  extraRateRupees: number;
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  periodStart: Date;
  periodEnd: Date;
  paymentId: string;
  orderId: string;
  method: string | null;
}): InvoiceDoc {
  const period = input.months === 12 ? "annual" : "monthly";
  const lines: InvoiceLine[] = [
    {
      description: `FlowHRMS ${input.planName} plan — ${period} subscription, includes ${input.includedEmployees} employees`,
      sac: input.seller.sac,
      quantity: 1,
      unit: "plan",
      rateRupees: input.baseRupees,
      amountPaise: input.baseRupees * 100,
    },
  ];
  if (input.extraEmployees > 0) {
    lines.push({
      description: `Additional employees above ${input.includedEmployees} — ${period}`,
      sac: input.seller.sac,
      quantity: input.extraEmployees,
      unit: "employee",
      rateRupees: input.extraRateRupees,
      amountPaise: input.extraEmployees * input.extraRateRupees * 100,
    });
  }
  return {
    number: input.number,
    issuedAt: input.issuedAt.toISOString(),
    seller: input.seller,
    buyer: input.buyer,
    placeOfSupply: { state: input.buyer.state, code: GST_STATE_CODES[input.buyer.state] ?? "" },
    reverseCharge: false,
    lines,
    subtotalPaise: input.subtotalPaise,
    cgstPaise: input.cgstPaise,
    sgstPaise: input.sgstPaise,
    igstPaise: input.igstPaise,
    totalPaise: input.totalPaise,
    amountInWords: rupeesInWords(input.totalPaise),
    period: { start: input.periodStart.toISOString(), end: input.periodEnd.toISOString() },
    payment: { gateway: "Razorpay", paymentId: input.paymentId, orderId: input.orderId, method: input.method },
  };
}
