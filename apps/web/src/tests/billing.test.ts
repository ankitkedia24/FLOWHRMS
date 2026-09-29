import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GRACE_DAYS,
  GST_STATE_CODES,
  accessState,
  addMonths,
  cyclePrices,
  monthsFree,
  financialYear,
  formatPaise,
  invoiceNumber,
  isGstin,
  isPaused,
  periodStart,
  quote,
  rupeesInWords,
  stateForGstin,
} from "@/lib/billing/pricing";
import { checkoutSignatureValid, webhookSignatureValid } from "@/lib/billing/signature";
import { normaliseSeller, sellerGaps } from "@/lib/billing/seller";
import { STATES_AND_UTS } from "@/lib/signup/catalog";
import { MODULES, type ModuleKey } from "@/lib/catalog";
import { applyPlanModules, planModuleProblems } from "@/lib/billing/plan-modules";

const DAY = 24 * 60 * 60 * 1000;
// The published plans (pricing brief, 29 Sept 2026). Annual = 10 months.
const CORE = { priceMonthly: 1499, priceAnnual: 14990, includedEmployees: 25, extraEmployeeMonthly: 49, extraEmployeeAnnual: 490 };
const PRO = { priceMonthly: 2999, priceAnnual: 29990, includedEmployees: 50, extraEmployeeMonthly: 59, extraEmployeeAnnual: 590 };
const BUSINESS = { priceMonthly: 6999, priceAnnual: 69990, includedEmployees: 100, extraEmployeeMonthly: 49, extraEmployeeAnnual: 490 };

describe("quote", () => {
  it("charges only the base price while within the included employees, then 18% GST", () => {
    const q = quote({ plan: CORE, cycle: "MONTHLY", employees: 12, sellerState: "Odisha", buyerState: "Delhi" });
    expect(q.months).toBe(1);
    expect(q.extraEmployees).toBe(0);
    expect(q.baseRupees).toBe(1499);
    expect(q.subtotalPaise).toBe(1499 * 100);
    expect(q.igstPaise).toBe(1499 * 18);
    expect(q.cgstPaise + q.sgstPaise).toBe(0);
    expect(q.totalPaise).toBe(q.subtotalPaise + q.igstPaise);
  });

  it("covers exactly the included number at the base price", () => {
    const q = quote({ plan: CORE, cycle: "MONTHLY", employees: 25, sellerState: "Odisha", buyerState: "Delhi" });
    expect(q.extraEmployees).toBe(0);
    expect(q.subtotalPaise).toBe(1499 * 100);
  });

  it("adds each employee above the included number at the extra rate", () => {
    const q = quote({ plan: CORE, cycle: "MONTHLY", employees: 30, sellerState: "Odisha", buyerState: "Delhi" });
    expect(q.extraEmployees).toBe(5);
    expect(q.extraRateRupees).toBe(49);
    expect(q.extraPaise).toBe(5 * 49 * 100);
    expect(q.subtotalPaise).toBe((1499 + 5 * 49) * 100);
  });

  it("charges a year at the yearly base and yearly extra rate", () => {
    const q = quote({ plan: PRO, cycle: "ANNUAL", employees: 60, sellerState: "Odisha", buyerState: "Delhi" });
    expect(q.months).toBe(12);
    expect(q.baseRupees).toBe(29990);
    expect(q.extraEmployees).toBe(10);
    expect(q.extraRateRupees).toBe(590);
    expect(q.subtotalPaise).toBe((29990 + 10 * 590) * 100);
  });

  it("matches the brief's larger-organisation list prices on BUSINESS", () => {
    const monthly = (employees: number) =>
      quote({ plan: BUSINESS, cycle: "MONTHLY", employees, sellerState: "Odisha", buyerState: "Delhi" }).subtotalPaise / 100;
    expect(monthly(100)).toBe(6999);
    expect(monthly(150)).toBe(9449);
    expect(monthly(250)).toBe(14349);
    expect(monthly(500)).toBe(26599);
    expect(monthly(1000)).toBe(51099);
    expect(monthly(2000)).toBe(100099);
  });

  it("splits into CGST + SGST inside the seller's state", () => {
    const q = quote({ plan: CORE, cycle: "MONTHLY", employees: 5, sellerState: "Odisha", buyerState: " odisha " });
    expect(q.intraState).toBe(true);
    expect(q.cgstPaise).toBe(1499 * 9);
    expect(q.sgstPaise).toBe(q.cgstPaise);
    expect(q.igstPaise).toBe(0);
    expect(q.totalPaise).toBe(Math.round(1499 * 100 * 1.18));
  });

  it("never counts fewer than one employee", () => {
    const q = quote({ plan: CORE, cycle: "MONTHLY", employees: 0, sellerState: "Odisha", buyerState: "Odisha" });
    expect(q.employees).toBe(1);
    expect(q.subtotalPaise).toBe(149900);
  });

  it("treats an unknown seller state as inter-state (IGST)", () => {
    const q = quote({ plan: CORE, cycle: "MONTHLY", employees: 1, sellerState: "", buyerState: "" });
    expect(q.intraState).toBe(false);
    expect(q.igstPaise).toBe(26982);
  });

  it("says a year paid at once saves two months on every published plan", () => {
    expect(monthsFree(CORE)).toBe(2);
    expect(monthsFree(PRO)).toBe(2);
    expect(monthsFree(BUSINESS)).toBe(2);
    expect(monthsFree({ priceMonthly: CORE.extraEmployeeMonthly, priceAnnual: CORE.extraEmployeeAnnual })).toBe(2);
    expect(monthsFree({ priceMonthly: 100, priceAnnual: 1200 })).toBe(0);
    expect(monthsFree({ priceMonthly: 0, priceAnnual: 0 })).toBe(0);
  });

  it("picks the base and extra price for the cycle", () => {
    expect(cyclePrices(PRO, "MONTHLY")).toEqual({ base: 2999, extra: 59 });
    expect(cyclePrices(PRO, "ANNUAL")).toEqual({ base: 29990, extra: 590 });
  });

  it("formats paise as rupees", () => {
    expect(formatPaise(1_18_000_00)).toBe("₹1,18,000");
    expect(formatPaise(93_222)).toBe("₹932.22");
  });
});

describe("period", () => {
  it("adds calendar months, clamping to the month's end", () => {
    expect(addMonths(new Date("2026-01-31T10:00:00Z"), 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addMonths(new Date("2027-01-31T10:00:00Z"), 13).toISOString()).toBe("2028-02-29T10:00:00.000Z");
    expect(addMonths(new Date("2026-09-27T06:00:00Z"), 12).toISOString()).toBe("2027-09-27T06:00:00.000Z");
  });

  it("keeps unused trial days and unexpired paid time", () => {
    const now = new Date("2026-09-27T06:00:00Z");
    const later = new Date(now.getTime() + 10 * DAY);
    expect(periodStart({ plan: "TRIAL", trialEndsAt: later, paidUntil: null }, now)).toEqual(later);
    expect(periodStart({ plan: "PAID", trialEndsAt: null, paidUntil: later }, now)).toEqual(later);
    const past = new Date(now.getTime() - 3 * DAY);
    expect(periodStart({ plan: "PAID", trialEndsAt: null, paidUntil: past }, now)).toEqual(now);
    expect(periodStart({ plan: "TRIAL", trialEndsAt: past, paidUntil: null }, now)).toEqual(now);
  });
});

describe("invoice numbering", () => {
  it("changes financial year on 1 April, India time", () => {
    expect(financialYear(new Date("2026-03-31T18:29:00Z"))).toBe("2526"); // 23:59 IST
    expect(financialYear(new Date("2026-03-31T18:31:00Z"))).toBe("2627"); // 00:01 IST
    expect(financialYear(new Date("2027-03-15T00:00:00Z"))).toBe("2627");
    expect(financialYear(new Date("2099-06-01T00:00:00Z"))).toBe("9900");
  });

  it("is at most 16 characters of the allowed set", () => {
    const n = invoiceNumber("2627", 1);
    expect(n).toBe("FH/2627/00001");
    expect(invoiceNumber("2627", 123456)).toBe("FH/2627/123456");
    for (const v of [n, invoiceNumber("2627", 999999)]) {
      expect(v.length).toBeLessThanOrEqual(16);
      expect(v).toMatch(/^[A-Za-z0-9/-]+$/);
    }
  });

  it("writes the amount in words, Indian style", () => {
    expect(rupeesInWords(100)).toBe("Rupees One Only");
    expect(rupeesInWords(1_20_000_50)).toBe("Rupees One Lakh Twenty Thousand and Fifty Paise Only");
    expect(rupeesInWords(1234_56789_50)).toBe(
      "Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine and Fifty Paise Only",
    );
    expect(rupeesInWords(0)).toBe("Rupees Zero Only");
  });
});

describe("GSTIN", () => {
  it("accepts a well-formed GSTIN with the right check character", () => {
    expect(isGstin("27AAPFU0939F1ZV")).toBe(true);
    expect(isGstin("27aapfu0939f1zv")).toBe(true);
  });

  it("rejects a wrong check character, shape or state code", () => {
    expect(isGstin("27AAPFU0939F1ZW")).toBe(false);
    expect(isGstin("27AAPFU0939F1Z")).toBe(false);
    expect(isGstin("99AAPFU0939F1ZV")).toBe(false);
    expect(isGstin("")).toBe(false);
  });

  it("knows the state from the first two digits", () => {
    expect(stateForGstin("27AAPFU0939F1ZV")).toBe("Maharashtra");
    expect(stateForGstin("21AAAAA0000A1Z5")).toBe("Odisha");
  });

  it("has a code for every state and UT on the sign-up list", () => {
    for (const s of STATES_AND_UTS) expect(GST_STATE_CODES[s], s).toMatch(/^\d{2}$/);
  });
});

describe("access", () => {
  const now = new Date("2026-09-27T06:00:00Z");
  const at = (days: number) => new Date(now.getTime() + days * DAY);

  it("runs a trial to its end, then pauses", () => {
    expect(accessState({ plan: "TRIAL", trialEndsAt: at(3), paidUntil: null }, now)).toMatchObject({
      kind: "trial",
      daysLeft: 3,
    });
    const ended = accessState({ plan: "TRIAL", trialEndsAt: at(0), paidUntil: null }, now);
    expect(ended.kind).toBe("trial_ended");
    expect(isPaused(ended)).toBe(true);
  });

  it("gives a paid company seven days' grace, then pauses", () => {
    expect(accessState({ plan: "PAID", trialEndsAt: null, paidUntil: at(5) }, now).kind).toBe("paid");
    const grace = accessState({ plan: "PAID", trialEndsAt: null, paidUntil: at(-2) }, now);
    expect(grace).toMatchObject({ kind: "grace", daysLeft: GRACE_DAYS - 2 });
    expect(isPaused(grace)).toBe(false);
    const lapsed = accessState({ plan: "PAID", trialEndsAt: null, paidUntil: at(-GRACE_DAYS) }, now);
    expect(lapsed.kind).toBe("lapsed");
    expect(isPaused(lapsed)).toBe(true);
  });

  it("never pauses internal companies, or paid ones without an end date", () => {
    expect(accessState({ plan: "INTERNAL", trialEndsAt: at(-100), paidUntil: at(-100) }, now).kind).toBe(
      "internal",
    );
    expect(accessState({ plan: "PAID", trialEndsAt: null, paidUntil: null }, now).kind).toBe("paid");
    expect(accessState({ plan: "TRIAL", trialEndsAt: null, paidUntil: null }, now).kind).toBe("trial");
  });
});

describe("Razorpay signatures", () => {
  const keySecret = "test_key_secret";
  const sign = (secret: string, msg: string) => createHmac("sha256", secret).update(msg).digest("hex");

  it("accepts the checkout signature for order|payment", () => {
    const signature = sign(keySecret, "order_ABC|pay_XYZ");
    expect(checkoutSignatureValid({ orderId: "order_ABC", paymentId: "pay_XYZ", signature, keySecret })).toBe(true);
  });

  it("rejects a signature for another payment, a wrong secret or junk", () => {
    const signature = sign(keySecret, "order_ABC|pay_XYZ");
    expect(checkoutSignatureValid({ orderId: "order_ABC", paymentId: "pay_OTHER", signature, keySecret })).toBe(
      false,
    );
    expect(
      checkoutSignatureValid({ orderId: "order_ABC", paymentId: "pay_XYZ", signature, keySecret: "other" }),
    ).toBe(false);
    expect(
      checkoutSignatureValid({ orderId: "order_ABC", paymentId: "pay_XYZ", signature: "zz", keySecret }),
    ).toBe(false);
    expect(checkoutSignatureValid({ orderId: "order_ABC", paymentId: "pay_XYZ", signature, keySecret: "" })).toBe(
      false,
    );
  });

  it("checks a webhook against the exact raw body", () => {
    const rawBody = JSON.stringify({ event: "payment.captured", payload: {} });
    const signature = sign("whsec", rawBody);
    expect(webhookSignatureValid({ rawBody, signature, webhookSecret: "whsec" })).toBe(true);
    expect(webhookSignatureValid({ rawBody: `${rawBody} `, signature, webhookSecret: "whsec" })).toBe(false);
  });
});

describe("seller details", () => {
  it("is not ready until legal name, a valid GSTIN, address and state are in", () => {
    expect(sellerGaps(normaliseSeller({}))).toEqual(["legal name", "GSTIN", "address", "state"]);
    const ready = normaliseSeller({
      legalName: "Flowacord Pvt Ltd",
      gstin: "27aapfu0939f1zv",
      address: "1 Main Road",
      state: "Maharashtra",
    });
    expect(ready.gstin).toBe("27AAPFU0939F1ZV");
    expect(sellerGaps(ready)).toEqual([]);
  });

  it("flags a state that does not match the GSTIN", () => {
    const s = normaliseSeller({ legalName: "X", gstin: "27AAPFU0939F1ZV", address: "Y", state: "Odisha" });
    expect(sellerGaps(s)).toEqual(["state matching the GSTIN"]);
  });

  it("drops unknown states and malformed codes, keeping safe defaults", () => {
    const s = normaliseSeller({ state: "Atlantis", pincode: "12", sac: "abc" });
    expect(s.state).toBe("");
    expect(s.pincode).toBe("");
    expect(s.sac).toBe("997331");
    expect(s.email).toBe("help@flowacord.com");
  });
});

describe("plan modules", () => {
  const all = (on: string[], allowed: string[] = on) =>
    (Object.keys(MODULES) as ModuleKey[]).map((key) => ({
      key,
      enabled: on.includes(key),
      allowedByPlatform: allowed.includes(key),
    }));

  it("flags modules whose requirements are missing, and unknown keys", () => {
    expect(planModuleProblems(["EMPLOYEES", "ATTENDANCE", "PAYROLL"])).toEqual([]);
    expect(planModuleProblems(["EMPLOYEES", "PAYROLL"])).toEqual(["Payroll needs Attendance"]);
    expect(planModuleProblems(["WIDGETS"])).toEqual(["Unknown module: WIDGETS"]);
  });

  it("never switches off or locks a module the company already has (pricing brief §13)", () => {
    // Group G's case: Flowacord added Expenses and Payroll; the plan has neither.
    const changes = applyPlanModules(
      all(["EMPLOYEES", "ATTENDANCE", "LEAVE", "PAYROLL", "EXPENSES"]),
      ["EMPLOYEES", "ATTENDANCE", "LEAVE", "DAILY_REPORTING", "NOTIFICATIONS"],
    );
    expect(changes.find((c) => c.key === "EXPENSES")).toBeUndefined();
    expect(changes.find((c) => c.key === "PAYROLL")).toBeUndefined();
  });

  it("leaves a module outside the plan that the company doesn't have exactly as it was", () => {
    const changes = applyPlanModules(all(["EMPLOYEES", "ATTENDANCE"]), ["EMPLOYEES", "ATTENDANCE"]);
    expect(changes.find((c) => c.key === "FIELD_VISITS")).toBeUndefined();
  });

  it("keeps the company's own choices for modules it already had", () => {
    // Tasks was theirs to manage and they switched it off: it stays off.
    const current = all(["EMPLOYEES", "ATTENDANCE"], ["EMPLOYEES", "ATTENDANCE", "TASKS"]);
    const changes = applyPlanModules(current, ["EMPLOYEES", "ATTENDANCE", "TASKS"]);
    expect(changes.find((c) => c.key === "TASKS")).toBeUndefined();
  });

  it("switches on a newly included module and what it needs", () => {
    // Attendance allowed but switched off by the company; Payroll newly included.
    const current = all(["EMPLOYEES"], ["EMPLOYEES", "ATTENDANCE"]);
    const changes = applyPlanModules(current, ["EMPLOYEES", "ATTENDANCE", "PAYROLL"]);
    expect(changes).toContainEqual({ key: "PAYROLL", enabled: true, allowedByPlatform: true });
    expect(changes).toContainEqual({ key: "ATTENDANCE", enabled: true, allowedByPlatform: true });
  });

  it("never turns a core module off", () => {
    const changes = applyPlanModules(all(["NOTIFICATIONS"]), []);
    expect(changes.find((c) => c.key === "NOTIFICATIONS")).toBeUndefined();
  });
});
