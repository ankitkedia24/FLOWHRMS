import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CURRENT_DOCUMENTS, SUPPORT_SENTENCES, canonicalBody } from "@/lib/consent/documents";

/**
 * Version 3 of the company terms, Terms of Service and Privacy Policy: the
 * support-access wording prepared for legal review (docs/md/SUPPORT-ACCESS.md,
 * docs/md/LEGAL-REVIEW-SUPPORT-TERMS.md). Only the support sentences change.
 */

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("the support-access wording (v3)", () => {
  it("makes v3 current for the three documents, and nothing else", () => {
    expect(CURRENT_DOCUMENTS.customer_terms.version).toBe(3);
    expect(CURRENT_DOCUMENTS.terms.version).toBe(3);
    expect(CURRENT_DOCUMENTS.privacy.version).toBe(3);
    expect(CURRENT_DOCUMENTS.account_holder.version).toBe(1);
    expect(CURRENT_DOCUMENTS.employee.version).toBe(3);
  });

  it("says it once in each, in the section about how Flowacord handles the data", () => {
    const where = (key: "customer_terms" | "terms" | "privacy", sentence: string) =>
      CURRENT_DOCUMENTS[key].sections.filter((s) => (s.paragraphs ?? []).some((p) => p.includes(sentence))).map((s) => s.heading);
    expect(where("customer_terms", SUPPORT_SENTENCES.customerTerms)).toEqual(["Who is responsible for employees' data"]);
    expect(where("terms", SUPPORT_SENTENCES.terms)).toEqual(["5. Personal data"]);
    expect(where("privacy", SUPPORT_SENTENCES.privacy)).toEqual(["3. Why, and on what basis"]);
    expect(count(canonicalBody(CURRENT_DOCUMENTS.customer_terms), "Flowacord support")).toBe(1);
    expect(count(canonicalBody(CURRENT_DOCUMENTS.terms), "Flowacord support")).toBe(1);
    expect(count(canonicalBody(CURRENT_DOCUMENTS.privacy), "Flowacord support")).toBe(1);
  });

  it("names what support may do, that it is recorded, and how the company sees it", () => {
    for (const sentence of Object.values(SUPPORT_SENTENCES)) {
      expect(sentence).toMatch(/named Flowacord staff/i);
      expect(sentence).toMatch(/recorded/);
      expect(sentence).toContain('"Flowacord support"');
      expect(sentence).toMatch(/improve/);
    }
  });

  it("asks the owner to confirm it in the box they tick", () => {
    const box = CURRENT_DOCUMENTS.customer_terms.purposes.find((p) => p.key === "fiduciary_role");
    expect(box?.label).toBe(
      "I understand that my company is responsible (as Data Fiduciary) for its employees' personal data in FlowHRMS, and that Flowacord processes it on the company's instructions, including giving support as described above.",
    );
    expect(box?.required).toBe(true);
  });

  it("matches, word for word, what the lawyer is asked to review", () => {
    const review = readFileSync(path.join(__dirname, "../../../../docs/md/LEGAL-REVIEW-SUPPORT-TERMS.md"), "utf8");
    for (const sentence of Object.values(SUPPORT_SENTENCES)) expect(review).toContain(sentence);
    const box = CURRENT_DOCUMENTS.customer_terms.purposes.find((p) => p.key === "fiduciary_role");
    expect(review).toContain(box!.label);
  });

  it("keeps the earlier commitments word for word", () => {
    expect(CURRENT_DOCUMENTS.customer_terms.sections[0].paragraphs?.[0]).toContain(
      "Flowacord processes it only on your company's instructions, as its Data Processor, under the Terms of Service.",
    );
    expect(canonicalBody(CURRENT_DOCUMENTS.privacy)).toContain("least-privilege access for our staff");
    expect(canonicalBody(CURRENT_DOCUMENTS.terms)).toContain("field-visit taps");
  });
});
