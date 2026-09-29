import { describe, expect, it } from "vitest";
import {
  HONEYPOT_FIELD,
  demoRequestStatus,
  normalisePhone,
  validateDemoRequest,
} from "@/lib/platform/demo-requests";
import { slugify } from "@/lib/platform/slug";
import { platformCrossLinks } from "@/lib/shell/nav";

/**
 * The enquiry form is the only thing in FlowHRMS that takes input from someone
 * with no account, no tenant and no session. Everything asserted here is
 * about that: refuse rubbish, keep a real customer's number, and never let
 * the honeypot explain itself to whatever tripped it.
 */

const good = {
  name: "Priya Shah",
  company: "Acme Hardware",
  phone: "98765 43210",
};

describe("enquiry validation", () => {
  it("accepts a plain, complete enquiry", () => {
    expect(validateDemoRequest(good)).toEqual([]);
  });

  it("needs a name, a company and a number", () => {
    const fields = validateDemoRequest({ name: "", company: "", phone: "" }).map(
      (p) => p.field,
    );
    expect(fields).toEqual(["name", "company", "phone"]);
  });

  it("refuses silently when the honeypot is filled", () => {
    const problems = validateDemoRequest({ ...good, [HONEYPOT_FIELD]: "x" });
    expect(problems).toHaveLength(1);
    // Not "you look like a bot": naming the check that caught it is free
    // help for whoever is writing the next one.
    expect(problems[0].field).toBe("form");
    expect(problems[0].message).not.toMatch(/bot|spam|honeypot/i);
  });

  it("stops at the honeypot rather than also reporting real problems", () => {
    expect(validateDemoRequest({ name: "", company: "", phone: "", website: "x" }))
      .toHaveLength(1);
  });

  it("caps the free-text fields", () => {
    expect(validateDemoRequest({ ...good, notes: "x".repeat(2001) })).toHaveLength(1);
    expect(validateDemoRequest({ ...good, notes: "x".repeat(2000) })).toEqual([]);
  });
});

describe("phone numbers, as people actually type them", () => {
  it("keeps a number typed with spaces, dashes or +91", () => {
    for (const written of [
      "9876543210",
      "98765 43210",
      "98765-43210",
      "+91 98765 43210",
      "+919876543210",
      "09876543210",
    ]) {
      expect(normalisePhone(written), written).toBe("9876543210");
    }
  });

  it("rejects what cannot be an Indian mobile", () => {
    // Losing a real customer over punctuation would be worse than letting
    // one bad number through, so this only has to catch nonsense.
    for (const bad of ["12345", "", "abcdefghij", "1234567890", "5876543210"]) {
      expect(normalisePhone(bad), bad).toBeNull();
    }
  });
});

describe("company short names", () => {
  it("builds one from the company name", () => {
    expect(slugify("Acme Hardware & Co.")).toBe("acme-hardware-co");
    expect(slugify("  RV  HARDWARE  WALLAH ")).toBe("rv-hardware-wallah");
  });

  it("never leaves a leading or trailing dash", () => {
    expect(slugify("!!! Acme !!!")).toBe("acme");
  });

  it("returns empty for a name with nothing to build from", () => {
    // The caller must then ask for one rather than create a company whose
    // address is "".
    expect(slugify("!!!")).toBe("");
  });

  it("bounds the length", () => {
    expect(slugify("a".repeat(80)).length).toBe(40);
  });
});

describe("who is offered the platform area", () => {
  it("offers it to a platform admin", () => {
    expect(platformCrossLinks({ isPlatformAdmin: true }).map((i) => i.href)).toEqual([
      "/platform",
    ]);
  });

  it("offers it to nobody else", () => {
    // A tenant Owner with every permission in the catalog is still not the
    // operator of the SaaS. Nothing in tenant configuration can grant this.
    expect(platformCrossLinks({ isPlatformAdmin: false })).toEqual([]);
  });
});

describe("enquiry status is text plus tone, never colour alone", () => {
  it("labels every state", () => {
    expect(demoRequestStatus("NEW").label).toBe("New");
    expect(demoRequestStatus("CONTACTED").label).toBe("Contacted");
    expect(demoRequestStatus("CONVERTED").label).toBe("Became a customer");
    expect(demoRequestStatus("CLOSED").label).toBe("Closed");
  });

  it("gives each a distinct key", () => {
    const keys = (["NEW", "CONTACTED", "CONVERTED", "CLOSED"] as const).map(
      (k) => demoRequestStatus(k).key,
    );
    expect(new Set(keys).size).toBe(4);
  });
});
