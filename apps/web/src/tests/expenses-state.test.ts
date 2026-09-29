import { describe, expect, it } from "vitest";
import {
  CLAIM_STATUSES,
  TRANSITIONS,
  canTransition,
  claimRef,
  computeFlags,
  daysBetween,
  deriveDecision,
  holdsApprovedAmount,
  isTerminal,
  isValidMoney,
  transitionGuard,
  validateSubmission,
  type ClaimStatus,
} from "@/lib/expenses/state";
import {
  DEFAULT_EXPENSES_POLICY,
  RECEIPT_RETENTION_FLOOR_YEARS,
  activeCategories,
  normalizeExpensesPolicy,
  policyIsUsable,
  slugify,
} from "@/lib/expenses/policy";

const PERMITTED: ReadonlyArray<readonly [ClaimStatus, ClaimStatus]> = [
  ["DRAFT", "SUBMITTED"],
  ["SUBMITTED", "APPROVED"],
  ["SUBMITTED", "PARTIALLY_APPROVED"],
  ["SUBMITTED", "REJECTED"],
  ["SUBMITTED", "WITHDRAWN"],
  ["APPROVED", "SETTLED"],
  ["PARTIALLY_APPROVED", "SETTLED"],
];

const isPermitted = (from: ClaimStatus, to: ClaimStatus) =>
  PERMITTED.some(([f, t]) => f === from && t === to);

/** An actor who could do anything a person can do — claimant AND approver. */
const OMNIPOTENT = { isClaimant: true, canApprove: true };

const ALL_PAIRS: Array<[ClaimStatus, ClaimStatus]> = [];
for (const from of CLAIM_STATUSES) {
  for (const to of CLAIM_STATUSES) ALL_PAIRS.push([from, to]);
}

describe("state machine — the exhaustive 49 pairs (§17)", () => {
  it("has seven states, seven transitions, and 49 pairs to check", () => {
    expect(CLAIM_STATUSES).toHaveLength(7);
    expect(TRANSITIONS).toHaveLength(7);
    expect(ALL_PAIRS).toHaveLength(49);
  });

  it.each(ALL_PAIRS)("%s → %s is permitted exactly when the diagram says so", (from, to) => {
    expect(canTransition(from, to)).toBe(isPermitted(from, to));
  });

  it.each(ALL_PAIRS)("%s → %s: the guard refuses everything off the diagram, even for an omnipotent actor", (from, to) => {
    const result = transitionGuard({
      from,
      to,
      actor: OMNIPOTENT,
      allowSelfApproval: true,
      claimedAmount: 100,
      approvedAmount: to === "PARTIALLY_APPROVED" ? 50 : 100,
      reason: "because",
      hasSettlementRecord: true,
    });
    expect(result.ok).toBe(isPermitted(from, to));
  });

  it("exactly seven of the 49 pairs are permitted", () => {
    expect(ALL_PAIRS.filter(([f, t]) => canTransition(f, t))).toHaveLength(7);
  });

  it("REJECTED, WITHDRAWN and SETTLED are terminal — nothing leaves them", () => {
    for (const status of ["REJECTED", "WITHDRAWN", "SETTLED"] as const) {
      expect(isTerminal(status)).toBe(true);
      for (const to of CLAIM_STATUSES) expect(canTransition(status, to)).toBe(false);
    }
    for (const status of ["DRAFT", "SUBMITTED", "APPROVED", "PARTIALLY_APPROVED"] as const) {
      expect(isTerminal(status)).toBe(false);
    }
  });

  it("only decided states hold an approved amount (invariant 2)", () => {
    expect(holdsApprovedAmount("DRAFT")).toBe(false);
    expect(holdsApprovedAmount("SUBMITTED")).toBe(false);
    expect(holdsApprovedAmount("REJECTED")).toBe(false);
    expect(holdsApprovedAmount("WITHDRAWN")).toBe(false);
    expect(holdsApprovedAmount("APPROVED")).toBe(true);
    expect(holdsApprovedAmount("PARTIALLY_APPROVED")).toBe(true);
    expect(holdsApprovedAmount("SETTLED")).toBe(true);
  });
});

describe("decisions are derived from amounts (invariant 4)", () => {
  it("the full amount is APPROVED; anything less is PARTIALLY_APPROVED", () => {
    expect(deriveDecision(100, 100)).toEqual({ ok: true, status: "APPROVED" });
    expect(deriveDecision(100, 99.99)).toEqual({ ok: true, status: "PARTIALLY_APPROVED" });
    expect(deriveDecision(100, 0.01)).toEqual({ ok: true, status: "PARTIALLY_APPROVED" });
  });

  it("refuses more than claimed, zero, negatives and third decimals (invariant 3)", () => {
    expect(deriveDecision(100, 100.01).ok).toBe(false);
    expect(deriveDecision(100, 0).ok).toBe(false);
    expect(deriveDecision(100, -5).ok).toBe(false);
    expect(deriveDecision(100, 10.005).ok).toBe(false);
  });

  it("PARTIALLY_APPROVED cannot be requested when the amounts say APPROVED, and vice versa", () => {
    const base = {
      from: "SUBMITTED" as const,
      actor: { isClaimant: false, canApprove: true },
      allowSelfApproval: false,
      claimedAmount: 100,
      reason: "trimmed the auto fare",
    };
    expect(transitionGuard({ ...base, to: "PARTIALLY_APPROVED", approvedAmount: 100 }).ok).toBe(false);
    expect(transitionGuard({ ...base, to: "APPROVED", approvedAmount: 60 }).ok).toBe(false);
    expect(transitionGuard({ ...base, to: "PARTIALLY_APPROVED", approvedAmount: 60 }).ok).toBe(true);
    expect(transitionGuard({ ...base, to: "APPROVED", approvedAmount: 100 }).ok).toBe(true);
  });
});

describe("the guard: who may do what", () => {
  const approver = { isClaimant: false, canApprove: true };
  const claimant = { isClaimant: true, canApprove: false };
  const bystander = { isClaimant: false, canApprove: false };

  it("rejecting needs a reason; partial approval needs a reason; full approval does not", () => {
    const base = { from: "SUBMITTED" as const, actor: approver, allowSelfApproval: false, claimedAmount: 500 };
    expect(transitionGuard({ ...base, to: "REJECTED" }).ok).toBe(false);
    expect(transitionGuard({ ...base, to: "REJECTED", reason: "   " }).ok).toBe(false);
    expect(transitionGuard({ ...base, to: "REJECTED", reason: "No receipt for fuel." }).ok).toBe(true);
    expect(transitionGuard({ ...base, to: "PARTIALLY_APPROVED", approvedAmount: 300 }).ok).toBe(false);
    expect(transitionGuard({ ...base, to: "APPROVED", approvedAmount: 500 }).ok).toBe(true);
  });

  it("a rejection keeps the reason verbatim, trimmed", () => {
    const r = transitionGuard({
      from: "SUBMITTED",
      to: "REJECTED",
      actor: approver,
      allowSelfApproval: false,
      claimedAmount: 500,
      reason: "  Submitted twice — see EXP-000012.  ",
    });
    expect(r.ok && r.reason).toBe("Submitted twice — see EXP-000012.");
  });

  it("deciding needs the permission; a bystander is refused", () => {
    for (const to of ["APPROVED", "PARTIALLY_APPROVED", "REJECTED", "SETTLED"] as const) {
      const from = to === "SETTLED" ? "APPROVED" : "SUBMITTED";
      expect(
        transitionGuard({ from, to, actor: bystander, allowSelfApproval: true, claimedAmount: 10, approvedAmount: 10, reason: "x", hasSettlementRecord: true }).ok,
      ).toBe(false);
    }
  });

  it("self-approval is refused by default and allowed-but-flagged when policy says so (invariant 9)", () => {
    const self = { isClaimant: true, canApprove: true };
    const base = { from: "SUBMITTED" as const, to: "APPROVED" as const, actor: self, claimedAmount: 100, approvedAmount: 100 };
    expect(transitionGuard({ ...base, allowSelfApproval: false }).ok).toBe(false);
    const allowed = transitionGuard({ ...base, allowSelfApproval: true });
    expect(allowed.ok && allowed.selfApproved).toBe(true);
    const other = transitionGuard({ ...base, actor: approver, allowSelfApproval: false });
    expect(other.ok && other.selfApproved).toBe(false);
  });

  it("withdrawal: the claimant only — an approver, even the owner, is refused (invariant 13)", () => {
    const base = { from: "SUBMITTED" as const, to: "WITHDRAWN" as const, allowSelfApproval: false, claimedAmount: 100 };
    expect(transitionGuard({ ...base, actor: claimant }).ok).toBe(true);
    expect(transitionGuard({ ...base, actor: approver }).ok).toBe(false);
    expect(transitionGuard({ ...base, actor: bystander }).ok).toBe(false);
  });

  it("withdrawal reason is optional and kept when given", () => {
    const base = { from: "SUBMITTED" as const, to: "WITHDRAWN" as const, actor: claimant, allowSelfApproval: false, claimedAmount: 100 };
    const silent = transitionGuard(base);
    expect(silent.ok && silent.reason).toBeNull();
    const spoken = transitionGuard({ ...base, reason: "Wrong amount, resubmitting." });
    expect(spoken.ok && spoken.reason).toBe("Wrong amount, resubmitting.");
  });

  it("withdrawal is refused from every status but SUBMITTED", () => {
    for (const from of CLAIM_STATUSES) {
      if (from === "SUBMITTED") continue;
      expect(transitionGuard({ from, to: "WITHDRAWN", actor: claimant, allowSelfApproval: false, claimedAmount: 1 }).ok).toBe(false);
    }
  });

  it("settlement needs the permission and a settlement record", () => {
    const base = { from: "APPROVED" as const, to: "SETTLED" as const, allowSelfApproval: false, claimedAmount: 100 };
    expect(transitionGuard({ ...base, actor: approver, hasSettlementRecord: true }).ok).toBe(true);
    expect(transitionGuard({ ...base, actor: approver, hasSettlementRecord: false }).ok).toBe(false);
    expect(transitionGuard({ ...base, actor: claimant, hasSettlementRecord: true }).ok).toBe(false);
  });

  it("the refusal names the current status so a racing caller learns what happened", () => {
    const r = transitionGuard({ from: "WITHDRAWN", to: "APPROVED", actor: approver, allowSelfApproval: false, claimedAmount: 1, approvedAmount: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain("withdrawn");
  });
});

describe("submission validation (§10.1 refusals)", () => {
  const policy = DEFAULT_EXPENSES_POLICY;
  const ctx = { policy, today: "2026-09-04", joinedOn: "2025-01-15" };
  const good = { categoryKey: "fuel", amount: 1240.5, expenseDate: "2026-09-02", description: "Diesel, site run", receiptCount: 1 };

  it("accepts a well-formed claim and returns the category snapshot", () => {
    const r = validateSubmission(good, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.category.name).toBe("Fuel");
      expect(r.category.receiptRequired).toBe(true);
      expect(r.amount).toBe(1240.5);
    }
  });

  it("refuses an unknown or retired category", () => {
    expect(validateSubmission({ ...good, categoryKey: "yachts" }, ctx).ok).toBe(false);
    const retired = normalizeExpensesPolicy({
      ...policy,
      categories: policy.categories.map((c) => (c.key === "fuel" ? { ...c, isActive: false } : c)),
    });
    expect(validateSubmission(good, { ...ctx, policy: retired }).ok).toBe(false);
  });

  it("refuses bad money: zero, negative, three decimals, NaN", () => {
    for (const amount of [0, -1, 10.005, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validateSubmission({ ...good, amount }, ctx).ok).toBe(false);
    }
    expect(isValidMoney(0.01)).toBe(true);
    expect(isValidMoney(99999.99)).toBe(true);
  });

  it("refuses future dates, dates before joining, and malformed dates", () => {
    expect(validateSubmission({ ...good, expenseDate: "2026-09-05" }, ctx).ok).toBe(false);
    expect(validateSubmission({ ...good, expenseDate: "2026-09-04" }, ctx).ok).toBe(true);
    expect(validateSubmission({ ...good, expenseDate: "2025-01-14" }, ctx).ok).toBe(false);
    expect(validateSubmission({ ...good, expenseDate: "2025-01-15" }, ctx).ok).toBe(true);
    expect(validateSubmission({ ...good, expenseDate: "2026-02-30" }, ctx).ok).toBe(false);
    expect(validateSubmission({ ...good, expenseDate: "yesterday" }, ctx).ok).toBe(false);
  });

  it("a required receipt blocks submission; an optional one does not", () => {
    expect(validateSubmission({ ...good, receiptCount: 0 }, ctx).ok).toBe(false);
    expect(validateSubmission({ ...good, categoryKey: "local-travel", receiptCount: 0 }, ctx).ok).toBe(true);
  });

  it("refuses an empty or over-long description", () => {
    expect(validateSubmission({ ...good, description: "   " }, ctx).ok).toBe(false);
    expect(validateSubmission({ ...good, description: "x".repeat(301) }, ctx).ok).toBe(false);
    expect(validateSubmission({ ...good, description: "x".repeat(300) }, ctx).ok).toBe(true);
  });
});

describe("flags are facts, never refusals (§10.1)", () => {
  it("late is strictly more than the deadline, counted in whole days", () => {
    const base = { expenseDate: "2026-08-01", deadlineDays: 30, amount: 100, maxClaimAmount: null, duplicateExists: false };
    expect(computeFlags({ ...base, submittedOn: "2026-08-31" }).isLate).toBe(false);
    expect(computeFlags({ ...base, submittedOn: "2026-09-01" }).isLate).toBe(true);
    expect(daysBetween("2026-08-01", "2026-09-01")).toBe(31);
    expect(daysBetween("2026-09-01", "2026-08-01")).toBe(-31);
  });

  it("over cap is strictly above the cap; no cap means never", () => {
    const base = { expenseDate: "2026-09-01", submittedOn: "2026-09-01", deadlineDays: 30, duplicateExists: false };
    expect(computeFlags({ ...base, amount: 500, maxClaimAmount: 500 }).isOverCap).toBe(false);
    expect(computeFlags({ ...base, amount: 500.01, maxClaimAmount: 500 }).isOverCap).toBe(true);
    expect(computeFlags({ ...base, amount: 1e9, maxClaimAmount: null }).isOverCap).toBe(false);
  });

  it("duplicate is whatever the lookup found", () => {
    const base = { expenseDate: "2026-09-01", submittedOn: "2026-09-01", deadlineDays: 30, amount: 1, maxClaimAmount: null };
    expect(computeFlags({ ...base, duplicateExists: true }).isPossibleDuplicate).toBe(true);
    expect(computeFlags({ ...base, duplicateExists: false }).isPossibleDuplicate).toBe(false);
  });
});

describe("policy normalisation (§8)", () => {
  it("an empty document becomes the defaults, minus categories", () => {
    const p = normalizeExpensesPolicy({});
    expect(p.submissionDeadlineDays).toBe(30);
    expect(p.defaultSettlementRoute).toBe("PAYROLL");
    expect(p.allowSelfApproval).toBe(false);
    expect(p.receiptRetentionYears).toBe(RECEIPT_RETENTION_FLOOR_YEARS);
    expect(p.categories).toEqual([]);
    expect(policyIsUsable(p)).toBe(false);
    expect(policyIsUsable(DEFAULT_EXPENSES_POLICY)).toBe(true);
  });

  it("retention cannot go below the floor, can go above; deadline is at least one day", () => {
    expect(normalizeExpensesPolicy({ receiptRetentionYears: 2 }).receiptRetentionYears).toBe(7);
    expect(normalizeExpensesPolicy({ receiptRetentionYears: 10 }).receiptRetentionYears).toBe(10);
    expect(normalizeExpensesPolicy({ submissionDeadlineDays: 0 }).submissionDeadlineDays).toBe(1);
    expect(normalizeExpensesPolicy({ submissionDeadlineDays: -9 }).submissionDeadlineDays).toBe(1);
  });

  it("broken categories are dropped, duplicate keys keep the first, keys derive from names", () => {
    const p = normalizeExpensesPolicy({
      categories: [
        { name: "Fuel", receiptRequired: true },
        { name: "Fuel", receiptRequired: false },
        { name: "", receiptRequired: true },
        42,
        { name: "Customer Lunch", maxClaimAmount: 1500.555 },
      ],
    });
    expect(p.categories.map((c) => c.key)).toEqual(["fuel", "customer-lunch"]);
    expect(p.categories[0].receiptRequired).toBe(true);
    expect(p.categories[1].maxClaimAmount).toBe(1500.56);
    expect(slugify("  Site  Material!! ")).toBe("site-material");
  });

  it("a nonsense route falls back; a retired category is excluded from the active list", () => {
    const p = normalizeExpensesPolicy({
      defaultSettlementRoute: "CASHAPP",
      categories: [{ name: "A", isActive: false }, { name: "B" }],
    });
    expect(p.defaultSettlementRoute).toBe("PAYROLL");
    expect(activeCategories(p).map((c) => c.name)).toEqual(["B"]);
  });
});

describe("claim references", () => {
  it("are zero-padded to six digits", () => {
    expect(claimRef(1)).toBe("EXP-000001");
    expect(claimRef(42)).toBe("EXP-000042");
    expect(claimRef(1234567)).toBe("EXP-1234567");
  });
});

describe("tile kinds carry their module (EXPENSES-MODULE.md §7)", () => {
  it("every action kind maps to a module, and the expense claim maps to EXPENSES", async () => {
    const { ACTION_KINDS, MODULE_FOR_KIND, APPROVE_INLINE, openLabel } = await import("@/lib/actions/kinds");
    for (const kind of ACTION_KINDS) {
      expect(MODULE_FOR_KIND[kind]).toBeTruthy();
      expect(APPROVE_INLINE[kind]).toBeDefined();
      expect(openLabel(kind).length).toBeGreaterThan(0);
    }
    expect(MODULE_FOR_KIND.EXPENSE_CLAIM).toBe("EXPENSES");
    expect(APPROVE_INLINE.EXPENSE_CLAIM.allowed).toBe(false);
  });
});
