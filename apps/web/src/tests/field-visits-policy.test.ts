import { describe, expect, it } from "vitest";
import {
  DEFAULT_FIELD_VISITS_POLICY,
  FAR_FLAG_MAX_M,
  FAR_FLAG_MIN_M,
  MAX_RATE_PER_KM,
  activePurposes,
  capitalise,
  claimableVehicles,
  mayRecordVisits,
  normalizeFieldVisitsPolicy,
  normalizeRate,
  policyProblem,
  withArticle,
} from "@/lib/field-visits/policy";

const SALES = "11111111-2222-4333-8444-555555555555";
const OPS = "66666666-7777-4888-9999-aaaaaaaaaaaa";

describe("field visit rules", () => {
  it("falls back to the defaults for nothing at all", () => {
    expect(normalizeFieldVisitsPolicy(null)).toEqual(DEFAULT_FIELD_VISITS_POLICY);
    expect(normalizeFieldVisitsPolicy({})).toEqual(DEFAULT_FIELD_VISITS_POLICY);
  });

  it("starts with a neutral word, optional photo, approvals and updates on, and no rates", () => {
    const p = DEFAULT_FIELD_VISITS_POLICY;
    expect(p.placeWord).toEqual({ singular: "place", plural: "places" });
    expect(p.photo).toBe("OPTIONAL");
    expect(p.goingOutApproval).toBe(true);
    expect(p.managerUpdates).toBe(true);
    expect(p.recorders).toEqual({ mode: "ALL", departmentIds: [] });
    expect(p.purposes.map((x) => x.name)).toContain("Event");
    expect(claimableVehicles(p)).toEqual([]);
  });

  it("keeps the company's own word, trimmed, and makes a plural when none is given", () => {
    expect(normalizeFieldVisitsPolicy({ placeWord: { singular: "  outlet ", plural: "" } }).placeWord).toEqual({
      singular: "outlet",
      plural: "outlets",
    });
    expect(normalizeFieldVisitsPolicy({ placeWord: { singular: "party", plural: "parties" } }).placeWord.plural).toBe(
      "parties",
    );
    expect(normalizeFieldVisitsPolicy({ placeWord: { singular: "x".repeat(60) } }).placeWord.singular).toHaveLength(24);
    expect(normalizeFieldVisitsPolicy({ placeWord: { singular: "   " } }).placeWord.singular).toBe("place");
  });

  it("drops nameless and repeated purposes, and keeps retired ones retired", () => {
    const p = normalizeFieldVisitsPolicy({
      purposes: [
        { name: "Sales", isActive: true, sortOrder: 20 },
        { name: "  ", isActive: true },
        { name: "sales", isActive: true },
        { name: "Site survey", isActive: false, sortOrder: 10 },
      ],
    });
    expect(p.purposes.map((x) => x.name)).toEqual(["Site survey", "Sales"]);
    expect(activePurposes(p).map((x) => x.key)).toEqual(["sales"]);
    // An empty list is the company's choice (picking is optional), not "missing".
    expect(normalizeFieldVisitsPolicy({ purposes: [] }).purposes).toEqual([]);
  });

  it("clamps the far-away distance and rejects junk choices", () => {
    expect(normalizeFieldVisitsPolicy({ farFlagMeters: 5 }).farFlagMeters).toBe(FAR_FLAG_MIN_M);
    expect(normalizeFieldVisitsPolicy({ farFlagMeters: 999999 }).farFlagMeters).toBe(FAR_FLAG_MAX_M);
    expect(normalizeFieldVisitsPolicy({ photo: "SOMETIMES" }).photo).toBe("OPTIONAL");
    expect(normalizeFieldVisitsPolicy({ goingOutApproval: "yes" }).goingOutApproval).toBe(true);
    expect(normalizeFieldVisitsPolicy({ managerUpdates: false }).managerUpdates).toBe(false);
  });

  it("keeps rates to two decimals and refuses nonsense", () => {
    expect(normalizeRate(3.456)).toBe(3.46);
    expect(normalizeRate(0)).toBeNull();
    expect(normalizeRate(-2)).toBeNull();
    expect(normalizeRate("4")).toBeNull();
    expect(normalizeRate(1000)).toBe(MAX_RATE_PER_KM);
    const p = normalizeFieldVisitsPolicy({
      vehicles: [
        { name: "Two-wheeler", ratePerKm: 3.5 },
        { name: "Four-wheeler", ratePerKm: null },
        { name: "Auto", ratePerKm: 6, isActive: false },
      ],
    });
    expect(claimableVehicles(p).map((v) => v.name)).toEqual(["Two-wheeler"]);
  });

  it("keeps only real department ids, and only when recording is limited to departments", () => {
    const limited = normalizeFieldVisitsPolicy({
      recorders: { mode: "DEPARTMENTS", departmentIds: [SALES, SALES, "not-an-id", 7] },
    });
    expect(limited.recorders).toEqual({ mode: "DEPARTMENTS", departmentIds: [SALES] });
    expect(normalizeFieldVisitsPolicy({ recorders: { mode: "ALL", departmentIds: [SALES] } }).recorders).toEqual({
      mode: "ALL",
      departmentIds: [],
    });
    expect(policyProblem(normalizeFieldVisitsPolicy({ recorders: { mode: "DEPARTMENTS", departmentIds: [] } }))).toMatch(
      /at least one department/,
    );
    expect(policyProblem(DEFAULT_FIELD_VISITS_POLICY)).toBeNull();
  });
});

describe("who records visits", () => {
  const everyone = DEFAULT_FIELD_VISITS_POLICY;
  const salesOnly = normalizeFieldVisitsPolicy({ recorders: { mode: "DEPARTMENTS", departmentIds: [SALES] } });

  it("never the owner — the visits are reported to them", () => {
    expect(mayRecordVisits({ roleKey: "OWNER", departmentId: SALES }, everyone)).toBe(false);
    expect(mayRecordVisits({ roleKey: "OWNER", departmentId: SALES }, salesOnly)).toBe(false);
  });

  it("department heads and everyone else, when the company says everyone", () => {
    expect(mayRecordVisits({ roleKey: "MANAGER", departmentId: OPS }, everyone)).toBe(true);
    expect(mayRecordVisits({ roleKey: "SUPER_ADMIN", departmentId: null }, everyone)).toBe(true);
    expect(mayRecordVisits({ roleKey: "EMPLOYEE", departmentId: null }, everyone)).toBe(true);
  });

  it("only the chosen departments, when limited", () => {
    expect(mayRecordVisits({ roleKey: "EMPLOYEE", departmentId: SALES }, salesOnly)).toBe(true);
    expect(mayRecordVisits({ roleKey: "EMPLOYEE", departmentId: OPS }, salesOnly)).toBe(false);
    expect(mayRecordVisits({ roleKey: "EMPLOYEE", departmentId: null }, salesOnly)).toBe(false);
  });
});

describe("the company's word in a sentence", () => {
  it("picks a or an", () => {
    expect(withArticle("place")).toBe("a place");
    expect(withArticle("outlet")).toBe("an outlet");
    expect(withArticle("Event venue")).toBe("an Event venue");
  });

  it("capitalises for headings", () => {
    expect(capitalise("parties")).toBe("Parties");
    expect(capitalise("")).toBe("");
  });
});
