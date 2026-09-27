import "server-only";

/**
 * Razorpay over its REST API — orders, payments, capture. No SDK: three
 * calls do not justify a dependency, and fetch keeps the secret handling in
 * plain sight.
 *
 * Keys come only from the environment (RAZORPAY_KEY_ID,
 * RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET — DEPLOY.md §7c). Only the
 * key id ever reaches a browser; it is public by design.
 */

const API = "https://api.razorpay.com/v1";

export interface RazorpayKeys {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export function razorpayKeys(): RazorpayKeys | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret, webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "" };
}

/** "test" keys take no real money. Shown in the app so nobody is confused. */
export function razorpayMode(): "test" | "live" | null {
  const keys = razorpayKeys();
  if (!keys) return null;
  return keys.keyId.startsWith("rzp_live_") ? "live" : "test";
}

export class RazorpayError extends Error {}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const keys = razorpayKeys();
  if (!keys) throw new RazorpayError("Online payment isn't set up yet.");
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keys.keyId}:${keys.keySecret}`).toString("base64")}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: { description?: string } };
  if (!res.ok) {
    // Razorpay's description is written for people ("The amount must be
    // at least INR 1.00"); it never contains the key.
    throw new RazorpayError(data.error?.description ?? `Razorpay answered ${res.status}.`);
  }
  return data as T;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export function createOrder(input: {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  return call<RazorpayOrder>("/orders", {
    method: "POST",
    body: {
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
    },
  });
}

export interface RazorpayPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  /** created | authorized | captured | refunded | failed */
  status: string;
  method?: string;
  email?: string;
  contact?: string;
  error_description?: string | null;
}

export function fetchPayment(paymentId: string): Promise<RazorpayPayment> {
  return call<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

export function capturePayment(paymentId: string, amountPaise: number): Promise<RazorpayPayment> {
  return call<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}/capture`, {
    method: "POST",
    body: { amount: amountPaise, currency: "INR" },
  });
}
