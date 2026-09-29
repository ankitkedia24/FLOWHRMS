import { STATES_AND_UTS } from "@/lib/signup/catalog";
import { isGstin, stateForGstin } from "./pricing";

/**
 * Flowacord as it appears at the top of every tax invoice. Entered by
 * Flowacord in /platform/billing — never hard-coded, never guessed. Until
 * the GSTIN, legal name, address and state are in, companies can see
 * prices but cannot pay (an invoice without them would not be valid).
 */
export interface SellerSettings {
  legalName: string;
  /** Shown under the legal name when different, e.g. "Flowacord". */
  tradeName: string;
  gstin: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  /** Service Accounting Code for the subscription. Confirm with the CA. */
  sac: string;
  email: string;
  phone: string;
}

export const DEFAULT_SELLER: SellerSettings = {
  legalName: "",
  tradeName: "Flowacord",
  gstin: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  sac: "997331",
  email: "help@flowacord.com",
  phone: "+91 89088 88880",
};

function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normaliseSeller(raw: unknown): SellerSettings {
  const v = (raw ?? {}) as Record<string, unknown>;
  const gstin = text(v.gstin, 15).toUpperCase();
  const state = text(v.state, 60);
  return {
    legalName: text(v.legalName),
    tradeName: text(v.tradeName) || DEFAULT_SELLER.tradeName,
    gstin,
    address: text(v.address, 300),
    city: text(v.city, 80),
    state: (STATES_AND_UTS as readonly string[]).includes(state) ? state : "",
    pincode: /^[1-9][0-9]{5}$/.test(text(v.pincode, 6)) ? text(v.pincode, 6) : "",
    sac: /^[0-9]{4,8}$/.test(text(v.sac, 8)) ? text(v.sac, 8) : DEFAULT_SELLER.sac,
    email: text(v.email, 120) || DEFAULT_SELLER.email,
    phone: text(v.phone, 30) || DEFAULT_SELLER.phone,
  };
}

/** What is still missing before a company may pay. Empty = ready. */
export function sellerGaps(s: SellerSettings): string[] {
  const gaps: string[] = [];
  if (!s.legalName) gaps.push("legal name");
  if (!isGstin(s.gstin)) gaps.push("GSTIN");
  else if (s.state && stateForGstin(s.gstin) !== s.state) gaps.push("state matching the GSTIN");
  if (!s.address) gaps.push("address");
  if (!s.state) gaps.push("state");
  return gaps;
}
