import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay's two proofs that a payment is real. Both are HMAC-SHA256 in
 * hex; both are compared in constant time.
 *
 * - After Checkout: `order_id|payment_id`, keyed with the API key secret.
 * - Webhooks: the raw request body, keyed with the webhook secret.
 *
 * Neither is ever trusted alone — the payment is also fetched from
 * Razorpay's API before a company is marked paid (src/lib/billing/activate.ts).
 */

function hmacHex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

function equalHex(expected: string, given: string): boolean {
  if (!/^[0-9a-f]+$/i.test(given) || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(given.toLowerCase(), "hex"));
}

export function checkoutSignatureValid(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  if (!input.keySecret) return false;
  return equalHex(hmacHex(input.keySecret, `${input.orderId}|${input.paymentId}`), input.signature);
}

export function webhookSignatureValid(input: {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}): boolean {
  if (!input.webhookSecret) return false;
  return equalHex(hmacHex(input.webhookSecret, input.rawBody), input.signature);
}
