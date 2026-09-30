import { describe, expect, it } from "vitest";
import { SUPPORT_OPEN_SLUGS, SUPPORT_TERMS_VERSION, supportRefusal } from "@/lib/platform/support-policy";
import { withoutSupportMember } from "@/lib/db";

/**
 * Flowacord support login: which companies it may open, and the one rule
 * that keeps the hidden support member out of every company list. The
 * database half is support-login-integration.test.ts.
 */

describe("which companies support may open (supportRefusal)", () => {
  const sample = { slug: "sunrise-traders-sample", status: "ACTIVE" };
  const real = { slug: "group-g", status: "ACTIVE" };

  it("opens only the placeholder and sample companies until the Terms allow support", () => {
    expect(SUPPORT_TERMS_VERSION).toBeNull();
    expect(SUPPORT_OPEN_SLUGS).toEqual(["demo-co", "sunrise-traders-sample"]);
    expect(supportRefusal(sample, null)).toBeNull();
    expect(supportRefusal({ ...sample, slug: "demo-co" }, null)).toBeNull();
    expect(supportRefusal(real, null)).toBe(
      "Not yet: the Terms don't cover support access. Until the reviewed wording is published, support opens only the placeholder and sample companies.",
    );
  });

  it("once the wording is published, opens a real company whose owner accepted it", () => {
    expect(supportRefusal(real, null, 2)).toBe(
      "Not yet: the owner hasn't accepted the updated Terms. They'll be asked at their next sign-in.",
    );
    expect(supportRefusal(real, 1, 2)).not.toBeNull();
    expect(supportRefusal(real, 2, 2)).toBeNull();
    expect(supportRefusal(real, 3, 2)).toBeNull();
  });

  it("never opens a suspended company", () => {
    expect(supportRefusal({ ...sample, status: "SUSPENDED" }, null)).toBe(
      "This company is suspended. Restore it before opening it as support.",
    );
  });
});

describe("keeping the support member out of company lists (withoutSupportMember)", () => {
  const NOT_SUPPORT = { status: { not: "SUPPORT" } };

  it("adds the rule to any read that doesn't mention SUPPORT", () => {
    expect(withoutSupportMember(undefined)).toEqual({ where: NOT_SUPPORT });
    expect(withoutSupportMember({})).toEqual({ where: NOT_SUPPORT });
    expect(withoutSupportMember({ where: { tenantId: "t1" } })).toEqual({
      where: { AND: [{ tenantId: "t1" }, NOT_SUPPORT] },
    });
    // "Not deactivated" would otherwise let the support member in.
    expect(withoutSupportMember({ where: { status: { not: "DEACTIVATED" } } })).toEqual({
      where: { AND: [{ status: { not: "DEACTIVATED" } }, NOT_SUPPORT] },
    });
  });

  it("keeps everything else the query asked for", () => {
    const args = { where: { tenantId: "t1" }, orderBy: { createdAt: "asc" }, take: 5 };
    expect(withoutSupportMember(args)).toMatchObject({ orderBy: { createdAt: "asc" }, take: 5 });
  });

  it("leaves a query alone that asks for the support member by name", () => {
    const explicit = { where: { tenantId: "t1", status: "SUPPORT" } };
    expect(withoutSupportMember(explicit)).toBe(explicit);
  });
});
