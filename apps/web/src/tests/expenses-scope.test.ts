import { describe, expect, it } from "vitest";
import { ownClaimRefusal, transitionGuard } from "@/lib/expenses/state";
import { claimListWhere } from "@/lib/expenses/queue-scope";

/**
 * Hardening batch 7 — expense claims follow record scope and the
 * own-request rule. The database half (a Manager's lists, refusals, tiles)
 * is in expenses-scope-integration.test.ts; these are the pure rules.
 */

describe("your own claim (ownClaimRefusal)", () => {
  it("lets the Owner decide and settle their own, whatever the policy", () => {
    for (const allowSelfApproval of [false, true]) {
      expect(ownClaimRefusal({ step: "decide", mayDecideOwn: true, allowSelfApproval })).toBeNull();
      expect(ownClaimRefusal({ step: "settle", mayDecideOwn: true, allowSelfApproval })).toBeNull();
    }
  });

  it("lets anyone else decide their own only when the company allows self-approval", () => {
    expect(ownClaimRefusal({ step: "decide", mayDecideOwn: false, allowSelfApproval: false })).toBe(
      "You can't decide your own claim. Ask another approver.",
    );
    expect(ownClaimRefusal({ step: "decide", mayDecideOwn: false, allowSelfApproval: true })).toBeNull();
  });

  it("never lets anyone but the Owner settle their own — self-approval does not reach settlement", () => {
    for (const allowSelfApproval of [false, true]) {
      expect(ownClaimRefusal({ step: "settle", mayDecideOwn: false, allowSelfApproval })).toBe(
        "You can't settle your own claim. Another approver has to.",
      );
    }
  });
});

describe("the guard applies it", () => {
  const settle = { from: "APPROVED" as const, to: "SETTLED" as const, claimedAmount: 100, hasSettlementRecord: true };
  const decide = { from: "SUBMITTED" as const, to: "APPROVED" as const, claimedAmount: 100, approvedAmount: 100 };

  it("refuses a settler settling their own approved claim (the audit's finding)", () => {
    const self = { isClaimant: true, canApprove: true };
    const r = transitionGuard({ ...settle, actor: self, allowSelfApproval: true });
    expect(!r.ok && r.error).toBe("You can't settle your own claim. Another approver has to.");
    expect(transitionGuard({ ...settle, actor: { ...self, mayDecideOwn: false }, allowSelfApproval: false }).ok).toBe(false);
  });

  it("lets the Owner settle their own, and someone else settle anyone's", () => {
    expect(transitionGuard({ ...settle, actor: { isClaimant: true, canApprove: true, mayDecideOwn: true }, allowSelfApproval: false }).ok).toBe(true);
    expect(transitionGuard({ ...settle, actor: { isClaimant: false, canApprove: true }, allowSelfApproval: false }).ok).toBe(true);
  });

  it("lets the Owner approve their own under the default policy, recorded as self-approved", () => {
    const r = transitionGuard({ ...decide, actor: { isClaimant: true, canApprove: true, mayDecideOwn: true }, allowSelfApproval: false });
    expect(r.ok && r.selfApproved).toBe(true);
  });

  it("still needs the permission, Owner or not", () => {
    const r = transitionGuard({ ...settle, actor: { isClaimant: true, canApprove: false, mayDecideOwn: true }, allowSelfApproval: false });
    expect(r.ok).toBe(false);
  });
});

describe("what an approver's lists show (claimListWhere)", () => {
  const team = new Set(["rep1", "rep2"]);

  it("gives company-wide roles everyone, minus themselves unless they may act on their own", () => {
    expect(claimListWhere("me", "all", true)).toEqual({});
    expect(claimListWhere("me", "all", false)).toEqual({ membershipId: { not: "me" } });
  });

  it("gives a team-scoped role their team, plus themselves only where they may act", () => {
    expect(claimListWhere("me", team, false)).toEqual({ membershipId: { in: ["rep1", "rep2"] } });
    expect(claimListWhere("me", team, true)).toEqual({ membershipId: { in: ["me", "rep1", "rep2"] } });
  });

  it("gives a Manager with nobody in their team nothing but, at most, their own", () => {
    expect(claimListWhere("me", new Set(), false)).toEqual({ membershipId: { in: [] } });
    expect(claimListWhere("me", new Set(), true)).toEqual({ membershipId: { in: ["me"] } });
  });
});
