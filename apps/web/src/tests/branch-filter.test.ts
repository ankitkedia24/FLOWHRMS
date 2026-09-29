import { describe, expect, it } from "vitest";
import { branchName, resolveBranchFilter } from "@/lib/branches/filter";

/**
 * The branch filter travels in the URL, so its value is client input.
 * These tests pin that it can never widen what a query returns or reach
 * across a tenant boundary.
 */
const OURS = "11111111-1111-4111-8111-111111111111";
const ALSO_OURS = "22222222-2222-4222-8222-222222222222";
const THEIRS = "99999999-9999-4999-8999-999999999999";

const allowed = new Set([OURS, ALSO_OURS]);

describe("resolveBranchFilter", () => {
  it("treats a missing value as no filter", () => {
    expect(resolveBranchFilter(undefined, allowed)).toBeNull();
    expect(resolveBranchFilter("", allowed)).toBeNull();
  });

  it("treats 'all' as no filter", () => {
    expect(resolveBranchFilter("all", allowed)).toBeNull();
  });

  it("accepts one of this tenant's locations", () => {
    expect(resolveBranchFilter(OURS, allowed)).toBe(OURS);
  });

  it("ignores a location belonging to another tenant", () => {
    expect(resolveBranchFilter(THEIRS, allowed)).toBeNull();
  });

  it("ignores a malformed value", () => {
    expect(resolveBranchFilter("../../etc/passwd", allowed)).toBeNull();
    expect(resolveBranchFilter("' OR 1=1 --", allowed)).toBeNull();
  });

  it("filters nothing when the tenant has no locations", () => {
    expect(resolveBranchFilter(OURS, new Set())).toBeNull();
  });
});

describe("branchName", () => {
  const options = [
    { id: OURS, name: "Andheri Shop" },
    { id: ALSO_OURS, name: "Bhiwandi Warehouse" },
  ];

  it("names the selected location for filter-aware empty states", () => {
    expect(branchName(OURS, options)).toBe("Andheri Shop");
  });

  it("has no name when nothing is selected", () => {
    expect(branchName(null, options)).toBeNull();
  });

  it("has no name for an unknown id", () => {
    expect(branchName(THEIRS, options)).toBeNull();
  });
});
