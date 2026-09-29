import { describe, expect, it } from "vitest";
import { INDUSTRIES, STATES_AND_UTS, isPincode, stateForPincode } from "@/lib/signup/catalog";
import {
  addressStep,
  companyStep,
  detailsStep,
  signupSchema,
  stepErrors,
  trialDaysLeft,
  trialEndsAt,
  trialExpired,
} from "@/lib/signup/validate";
import { normaliseTrialSettings } from "@/lib/platform/trial-defaults";

describe("pincode", () => {
  it("accepts 6 digits not starting with 0", () => {
    expect(isPincode("751001")).toBe(true);
    expect(isPincode("051001")).toBe(false);
    expect(isPincode("75100")).toBe(false);
    expect(isPincode("7510011")).toBe(false);
  });

  it("suggests the state from the postal region", () => {
    const cases: Array<[string, string | null]> = [
      ["110001", "Delhi"],
      ["751001", "Odisha"],
      ["403001", "Goa"],
      ["400001", "Maharashtra"],
      ["560001", "Karnataka"],
      ["500001", "Telangana"],
      ["248001", "Uttarakhand"],
      ["226001", "Uttar Pradesh"],
      ["834001", "Jharkhand"],
      ["800001", "Bihar"],
      ["160017", "Chandigarh"],
      ["737101", "Sikkim"],
      ["799001", "Tripura"],
      ["605001", "Puducherry"],
      ["000000", null],
    ];
    for (const [pin, state] of cases) expect(stateForPincode(pin)).toBe(state);
  });

  it("only ever suggests a state from the list", () => {
    for (let prefix = 11; prefix <= 85; prefix += 1) {
      const suggested = stateForPincode(`${prefix}0001`);
      if (suggested) expect(STATES_AND_UTS).toContain(suggested);
    }
  });
});

describe("sign-up steps", () => {
  it("names each missing company field", () => {
    expect(stepErrors(companyStep, { companyName: "", staffCount: "", industry: "" })).toMatchObject({
      companyName: expect.any(String),
      staffCount: expect.any(String),
      industry: expect.any(String),
    });
    expect(
      stepErrors(companyStep, { companyName: "Amit Book Depot", staffCount: "15", industry: INDUSTRIES[0] }),
    ).toEqual({});
  });

  it("checks the address", () => {
    expect(stepErrors(addressStep, { pincode: "12", state: "Atlantis", city: "" })).toMatchObject({
      pincode: expect.any(String),
      state: expect.any(String),
      city: expect.any(String),
    });
  });

  it("normalises email and mobile the way people type them", () => {
    const parsed = detailsStep.parse({
      name: "Amit Kedia",
      email: "  Amit@BookDepot.IN ",
      mobile: "+91 98765-43210",
      role: "Owner / Proprietor",
      heardFrom: "",
    });
    expect(parsed.email).toBe("amit@bookdepot.in");
    expect(parsed.mobile).toBe("9876543210");
    expect(parsed.heardFrom).toBeUndefined();
  });

  it("refuses a mobile number that is not Indian", () => {
    expect(stepErrors(detailsStep, { name: "A B", email: "a@b.in", mobile: "12345", role: "Manager" }).mobile).toMatch(/10-digit/);
  });

  it("carries the consent choices through to the server", () => {
    const parsed = signupSchema.parse({
      companyName: "Amit Book Depot",
      staffCount: 15,
      industry: INDUSTRIES[0],
      pincode: "751001",
      state: "Odisha",
      city: "Bhubaneswar",
      name: "Amit Kedia",
      email: "amit@bookdepot.in",
      mobile: "9876543210",
      role: "Owner / Proprietor",
      consents: { account_holder: ["account_service"], customer_terms: [] },
    });
    expect(parsed.consents.account_holder).toEqual(["account_service"]);
  });
});

describe("trial dates", () => {
  const start = new Date("2026-09-27T10:00:00.000Z");
  const ends = trialEndsAt(start, 30);

  it("runs 30 days from sign-up", () => {
    expect(ends.toISOString()).toBe("2026-10-27T10:00:00.000Z");
    expect(trialDaysLeft(ends, start)).toBe(30);
  });

  it("pauses only a TRIAL company, and only once the end has passed", () => {
    expect(trialExpired({ plan: "TRIAL", trialEndsAt: ends }, start)).toBe(false);
    expect(trialExpired({ plan: "TRIAL", trialEndsAt: ends }, new Date("2026-10-27T10:00:00.000Z"))).toBe(true);
    expect(trialExpired({ plan: "PAID", trialEndsAt: ends }, new Date("2027-01-01"))).toBe(false);
    expect(trialExpired({ plan: "INTERNAL", trialEndsAt: null }, new Date("2030-01-01"))).toBe(false);
  });
});

describe("trial settings", () => {
  it("falls back to 30 days and the default modules", () => {
    const s = normaliseTrialSettings(null);
    expect(s.days).toBe(30);
    expect(s.modules).toContain("ATTENDANCE");
  });

  it("drops unknown modules, bounds the length, and always keeps notifications", () => {
    const s = normaliseTrialSettings({ days: 900, modules: ["ATTENDANCE", "NOT_A_MODULE"] });
    expect(s.days).toBe(30);
    expect(s.modules).toEqual(["ATTENDANCE", "NOTIFICATIONS"]);
  });
});

describe("staff count message", () => {
  it("says what is missing when the box is empty", () => {
    expect(stepErrors(companyStep, { companyName: "A B", staffCount: "", industry: INDUSTRIES[0] }).staffCount).toBe(
      "Enter how many people work there.",
    );
  });
});
