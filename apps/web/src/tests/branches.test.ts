import { describe, expect, it } from "vitest";
import {
  MAX_ACCURACY_M,
  assessArea,
  assessLocation,
  candidateBranches,
  checkInConsequence,
  describeAttendanceRecord,
  effectiveRadiusM,
  nearestBranch,
  type BranchPolicy,
} from "@/lib/attendance/policy";

/**
 * Multi-location rules. The company operates from several places; these
 * tests pin who may check in where, which location an outcome is judged
 * against, and that a past record stays explicable after things change.
 */

const SHOP: BranchPolicy = {
  id: "b-shop",
  name: "Andheri Shop",
  lat: 19.1197,
  lng: 72.8468,
  radiusM: 100,
};

/** ~2.5 km north of the shop, with a much larger permitted area. */
const WAREHOUSE: BranchPolicy = {
  id: "b-warehouse",
  name: "Bhiwandi Warehouse",
  lat: 19.1422,
  lng: 72.8468,
  radiusM: 500,
};

const atShop = { lat: 19.1197, lng: 72.8468, accuracyM: 15 };
const atWarehouse = { lat: 19.1422, lng: 72.8468, accuracyM: 15 };
const farAway = { lat: 19.4, lng: 72.9, accuracyM: 15 };

describe("branch selection", () => {
  it("matches assessLocation exactly for a single location", () => {
    for (const coords of [atShop, atWarehouse, farAway]) {
      const single = assessLocation({
        locationRequired: true,
        branch: SHOP,
        coords,
      });
      const area = assessArea({
        locationRequired: true,
        branches: [SHOP],
        coords,
      });
      expect(area.outcome).toBe(single.outcome);
      expect(area.label).toBe(single.label);
      expect(area.distanceM).toBe(single.distanceM);
    }
  });

  it("picks the only location when the person has one", () => {
    const result = assessArea({
      locationRequired: true,
      branches: [SHOP],
      coords: atShop,
    });
    expect(result.branch?.id).toBe("b-shop");
    expect(result.outcome).toBe("INSIDE");
  });

  it("is INSIDE the location whose own radius contains the person, not the nearest", () => {
    // Standing at the warehouse: the shop is 2.5 km away (outside its 100 m),
    // the warehouse contains us. The contained one must win.
    const result = assessArea({
      locationRequired: true,
      branches: [SHOP, WAREHOUSE],
      coords: atWarehouse,
    });
    expect(result.outcome).toBe("INSIDE");
    expect(result.branch?.name).toBe("Bhiwandi Warehouse");
  });

  it("prefers the closer location when inside two overlapping areas", () => {
    const wide: BranchPolicy = { ...WAREHOUSE, id: "b-wide", radiusM: 50_000 };
    const result = assessArea({
      locationRequired: true,
      branches: [wide, SHOP],
      coords: atShop,
    });
    expect(result.branch?.id).toBe("b-shop");
  });

  it("is OUTSIDE against the nearest location and names it", () => {
    // ~870 m north of the warehouse: outside its 500 m area, and far
    // outside the shop's 100 m area. The nearer one must be named.
    const result = assessArea({
      locationRequired: true,
      branches: [SHOP, WAREHOUSE],
      coords: { lat: 19.15, lng: 72.8468, accuracyM: 15 },
    });
    expect(result.outcome).toBe("OUTSIDE");
    expect(result.branch?.name).toBe("Bhiwandi Warehouse");

    const consequence = checkInConsequence({
      location: result,
      lateBy: 0,
      branchName: result.branch?.name,
    });
    expect(consequence?.sentence).toContain("Bhiwandi Warehouse");
    expect(consequence?.requiresReason).toBe(true);
  });

  it("ignores locations without coordinates", () => {
    const noCoords: BranchPolicy = {
      id: "b-none",
      name: "Head office",
      lat: null,
      lng: null,
      radiusM: 300,
    };
    const result = assessArea({
      locationRequired: true,
      branches: [noCoords, SHOP],
      coords: atShop,
    });
    expect(result.branch?.id).toBe("b-shop");
  });

  it("is NOT_REQUIRED when no location has coordinates", () => {
    const result = assessArea({
      locationRequired: true,
      branches: [{ id: "x", name: "Head office", lat: null, lng: null, radiusM: 300 }],
      coords: atShop,
    });
    expect(result.outcome).toBe("NOT_REQUIRED");
    expect(result.branch).toBeNull();
  });

  it("is UNCONFIRMED for poor accuracy before any location is chosen", () => {
    const result = assessArea({
      locationRequired: true,
      branches: [SHOP, WAREHOUSE],
      coords: { ...atShop, accuracyM: MAX_ACCURACY_M + 1 },
    });
    expect(result.outcome).toBe("UNCONFIRMED");
    expect(result.branch).toBeNull();
  });

  it("is UNCONFIRMED when location is off", () => {
    const result = assessArea({
      locationRequired: true,
      branches: [SHOP, WAREHOUSE],
      coords: null,
    });
    expect(result.outcome).toBe("UNCONFIRMED");
  });

  it("is deterministic when two locations are exactly equidistant", () => {
    const a: BranchPolicy = { id: "aaa", name: "A", lat: 19.0, lng: 72.0, radiusM: 100 };
    const b: BranchPolicy = { id: "bbb", name: "B", lat: 19.0, lng: 72.0, radiusM: 100 };
    const first = nearestBranch([a, b], { lat: 19.0, lng: 72.0 });
    const second = nearestBranch([b, a], { lat: 19.0, lng: 72.0 });
    expect(first?.branch.id).toBe("aaa");
    expect(second?.branch.id).toBe("aaa");
  });
});

describe("who may check in where", () => {
  const base = {
    homeBranch: SHOP,
    activeBranches: [SHOP, WAREHOUSE],
    anyBranchFeatureOn: true,
  };

  it("a non-roaming employee has only their home location", () => {
    const result = candidateBranches({ ...base, canCheckInAtAnyBranch: false });
    expect(result).toEqual([SHOP]);
  });

  it("a non-roaming employee at another location is OUTSIDE and needs a reason", () => {
    const branches = candidateBranches({ ...base, canCheckInAtAnyBranch: false });
    const area = assessArea({
      locationRequired: true,
      branches,
      coords: atWarehouse,
    });
    expect(area.outcome).toBe("OUTSIDE");
    const consequence = checkInConsequence({
      location: area,
      lateBy: 0,
      branchName: area.branch?.name,
    });
    expect(consequence?.requiresReason).toBe(true);
  });

  it("a roaming employee at another location is INSIDE and raises no exception", () => {
    const branches = candidateBranches({ ...base, canCheckInAtAnyBranch: true });
    const area = assessArea({
      locationRequired: true,
      branches,
      coords: atWarehouse,
    });
    expect(area.outcome).toBe("INSIDE");
    expect(area.branch?.name).toBe("Bhiwandi Warehouse");
    expect(
      checkInConsequence({ location: area, lateBy: 0, branchName: area.branch?.name }),
    ).toBeNull();
  });

  it("a roaming employee outside every location still needs a reason", () => {
    const branches = candidateBranches({ ...base, canCheckInAtAnyBranch: true });
    const area = assessArea({ locationRequired: true, branches, coords: farAway });
    expect(area.outcome).toBe("OUTSIDE");
  });

  it("roaming is ignored when the feature is off — the flag is the control", () => {
    const result = candidateBranches({
      ...base,
      canCheckInAtAnyBranch: true,
      anyBranchFeatureOn: false,
    });
    expect(result).toEqual([SHOP]);
  });

  it("the home location is always a candidate, even if deactivated", () => {
    const result = candidateBranches({
      homeBranch: SHOP,
      activeBranches: [WAREHOUSE], // shop is no longer active
      canCheckInAtAnyBranch: true,
      anyBranchFeatureOn: true,
    });
    expect(result.map((b) => b.id)).toContain("b-shop");
  });

  it("does not list the home location twice", () => {
    const result = candidateBranches({
      homeBranch: SHOP,
      activeBranches: [SHOP, WAREHOUSE],
      canCheckInAtAnyBranch: true,
      anyBranchFeatureOn: true,
    });
    expect(result).toHaveLength(2);
  });

  it("has no candidates when the person has no home location", () => {
    expect(
      candidateBranches({
        homeBranch: null,
        activeBranches: [SHOP],
        canCheckInAtAnyBranch: false,
        anyBranchFeatureOn: true,
      }),
    ).toEqual([]);
  });
});

describe("effective radius", () => {
  it("uses the tenant default when the location sets none", () => {
    expect(effectiveRadiusM(null, 300)).toBe(300);
    expect(effectiveRadiusM(undefined, 300)).toBe(300);
  });

  it("uses the location's own radius when set", () => {
    expect(effectiveRadiusM(500, 300)).toBe(500);
  });

  it("honours a zero radius instead of treating it as unset", () => {
    expect(effectiveRadiusM(0, 300)).toBe(0);
  });
});

describe("what a past record says about itself", () => {
  const snapshot = {
    v: 2,
    policyVersion: 7,
    matchedBranch: {
      id: "b-warehouse",
      name: "Bhiwandi Warehouse",
      lat: 19.1422,
      lng: 72.8468,
      radiusM: 500,
    },
    radiusSource: "branch" as const,
    consequenceSentence: "You are 410 m outside the Bhiwandi Warehouse area.",
  };

  it("records the location by value, not just its id", () => {
    const described = describeAttendanceRecord({ snapshot });
    expect(described.branchName).toBe("Bhiwandi Warehouse");
    expect(described.branchNameIsCurrent).toBe(false);
  });

  it("says which radius applied and where it came from", () => {
    const described = describeAttendanceRecord({ snapshot });
    expect(described.radiusM).toBe(500);
    expect(described.radiusSource).toBe("branch");
  });

  it("still explains the record after the location is renamed", () => {
    const described = describeAttendanceRecord({
      snapshot,
      currentBranchName: "Bhiwandi Warehouse (North)",
    });
    // The recorded name wins — a rename must not rewrite the past.
    expect(described.branchName).toBe("Bhiwandi Warehouse");
    expect(described.consequenceSentence).toContain("410 m");
  });

  it("reads a Phase 3 snapshot that has no version marker", () => {
    const described = describeAttendanceRecord({
      snapshot: { radiusM: 300 },
      currentBranchName: "Main branch",
    });
    expect(described.branchName).toBe("Main branch");
    // Flagged as the CURRENT name, not the one recorded on the day.
    expect(described.branchNameIsCurrent).toBe(true);
    expect(described.radiusM).toBe(300);
  });

  it("copes with a record that has no snapshot at all", () => {
    const described = describeAttendanceRecord({ snapshot: null });
    expect(described.branchName).toBeNull();
    expect(described.policyVersion).toBeNull();
  });
});
