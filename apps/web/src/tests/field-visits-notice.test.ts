import { describe, expect, it } from "vitest";
import { CURRENT_DOCUMENTS, canonicalBody } from "@/lib/consent/documents";

// FIELD-VISITS-MODULE.md §9: every published text that describes location
// must say it is also taken at field-visit taps — and never in between.
describe("notices that mention field visits", () => {
  it("say location is taken at visit taps, as a choice of its own", () => {
    const e = canonicalBody(CURRENT_DOCUMENTS.employee);
    expect(e).toContain("when you tap Going out, Reached");
    expect(e).toContain("Field visits, if your company uses them");
    expect(e).toContain("recorded without location, so their travel distance");
    expect(CURRENT_DOCUMENTS.employee.purposes.map((p) => p.key)).toEqual(["work_records", "checkin_location", "visit_location"]);
    expect(canonicalBody(CURRENT_DOCUMENTS.customer_terms)).toContain("at each field-visit tap");
    expect(canonicalBody(CURRENT_DOCUMENTS.terms)).toContain("at field-visit taps where a company uses");
    const p = canonicalBody(CURRENT_DOCUMENTS.privacy);
    expect(p).toContain("field-visit taps where their company uses field visits), field visits,");
    expect(p).toContain("between taps, or in the background");
  });

  it("keep the visit location consent optional", () => {
    const visit = CURRENT_DOCUMENTS.employee.purposes.find((p) => p.key === "visit_location");
    expect(visit?.required).toBe(false);
    expect(CURRENT_DOCUMENTS.employee.version).toBe(3);
  });
});
