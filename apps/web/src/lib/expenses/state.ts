/**
 * The expense claim state machine (EXPENSES-MODULE.md §3–4).
 *
 * Seven states, seven permitted transitions, and nothing else. This module
 * is PURE — the only place that knows which moves are legal, who may make
 * them, and what each one requires. `transition.ts` is the single database
 * seam that calls it inside a row lock; no screen or script sets a status.
 */
import type { ExpenseCategory, ExpensesPolicy } from "./policy";
import { categoryByKey } from "./policy";

export const CLAIM_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "PARTIALLY_APPROVED",
  "REJECTED",
  "WITHDRAWN",
  "SETTLED",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const STATUS_LABEL: Record<ClaimStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  PARTIALLY_APPROVED: "Partly approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  SETTLED: "Settled",
};

/** The diagram in §3, as data. Order matters nowhere; membership does. */
export const TRANSITIONS: ReadonlyArray<readonly [ClaimStatus, ClaimStatus]> = [
  ["DRAFT", "SUBMITTED"],
  ["SUBMITTED", "APPROVED"],
  ["SUBMITTED", "PARTIALLY_APPROVED"],
  ["SUBMITTED", "REJECTED"],
  ["SUBMITTED", "WITHDRAWN"],
  ["APPROVED", "SETTLED"],
  ["PARTIALLY_APPROVED", "SETTLED"],
];

export const TERMINAL_STATUSES: ReadonlySet<ClaimStatus> = new Set([
  "REJECTED",
  "WITHDRAWN",
  "SETTLED",
]);

export function canTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  return TRANSITIONS.some(([f, t]) => f === from && t === to);
}

export function isTerminal(status: ClaimStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Statuses that hold a decided amount (invariant 2). */
export function holdsApprovedAmount(status: ClaimStatus): boolean {
  return status === "APPROVED" || status === "PARTIALLY_APPROVED" || status === "SETTLED";
}

export function claimRef(claimNumber: number): string {
  return `EXP-${String(claimNumber).padStart(6, "0")}`;
}

// ------------------------------------------------------------------ money

/** Rupees with at most two decimals (paise). */
export function isValidMoney(value: number): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

/**
 * The decision is DERIVED from the amounts (invariant 4): nobody asks for
 * "partially approved"; approving less than claimed simply is one.
 */
export function deriveDecision(
  claimedAmount: number,
  approvedAmount: number,
): { ok: true; status: "APPROVED" | "PARTIALLY_APPROVED" } | { ok: false; error: string } {
  if (!isValidMoney(approvedAmount)) {
    return { ok: false, error: "Enter an amount above zero, in rupees and paise." };
  }
  if (approvedAmount > claimedAmount) {
    return { ok: false, error: "You can't approve more than was claimed." };
  }
  return {
    ok: true,
    status: approvedAmount === claimedAmount ? "APPROVED" : "PARTIALLY_APPROVED",
  };
}

// ------------------------------------------------------------------ dates

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Whole days from `a` to `b` (both yyyy-mm-dd); negative when b is earlier. */
export function daysBetween(a: string, b: string): number {
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const db = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((db - da) / 86_400_000);
}

// ------------------------------------------------------------ submission

export interface SubmissionInput {
  categoryKey: string;
  amount: number;
  /** yyyy-mm-dd */
  expenseDate: string;
  description: string;
  receiptCount: number;
}

export interface SubmissionContext {
  policy: ExpensesPolicy;
  /** Today's date in the tenant's timezone, yyyy-mm-dd. */
  today: string;
  /** The person's joining date, yyyy-mm-dd, when known. */
  joinedOn: string | null;
}

export type SubmissionCheck =
  | { ok: true; category: ExpenseCategory; amount: number; description: string }
  | { ok: false; error: string };

export const DESCRIPTION_MAX = 300;

/** §10.1 — refusals. Nothing here is stored. */
export function validateSubmission(
  input: SubmissionInput,
  ctx: SubmissionContext,
): SubmissionCheck {
  const category = categoryByKey(ctx.policy, input.categoryKey);
  if (!category || !category.isActive) {
    return { ok: false, error: "Choose a category from the list." };
  }
  if (!isValidMoney(input.amount)) {
    return { ok: false, error: "Enter an amount above zero, in rupees and paise." };
  }
  if (!isIsoDate(input.expenseDate)) {
    return { ok: false, error: "Choose the date of the expense." };
  }
  if (input.expenseDate > ctx.today) {
    return { ok: false, error: "The expense date can't be in the future." };
  }
  if (ctx.joinedOn && input.expenseDate < ctx.joinedOn) {
    return { ok: false, error: "The expense date is before your joining date." };
  }
  const description = input.description.trim();
  if (!description) {
    return { ok: false, error: "Say what the expense was for." };
  }
  if (description.length > DESCRIPTION_MAX) {
    return { ok: false, error: `Keep the description under ${DESCRIPTION_MAX} characters.` };
  }
  if (category.receiptRequired && input.receiptCount === 0) {
    return { ok: false, error: `${category.name} needs a receipt. Add a photo or PDF.` };
  }
  return { ok: true, category, amount: input.amount, description };
}

export interface ClaimFlags {
  isLate: boolean;
  isOverCap: boolean;
  isPossibleDuplicate: boolean;
}

/** §10.1 — facts for the approver. Computed once, at submission. */
export function computeFlags(input: {
  expenseDate: string;
  submittedOn: string;
  deadlineDays: number;
  amount: number;
  maxClaimAmount: number | null;
  duplicateExists: boolean;
}): ClaimFlags {
  return {
    isLate: daysBetween(input.expenseDate, input.submittedOn) > input.deadlineDays,
    isOverCap: input.maxClaimAmount !== null && input.amount > input.maxClaimAmount,
    isPossibleDuplicate: input.duplicateExists,
  };
}

// ------------------------------------------------------------- the guard

export interface GuardInput {
  from: ClaimStatus;
  to: ClaimStatus;
  actor: {
    isClaimant: boolean;
    canApprove: boolean;
  };
  allowSelfApproval: boolean;
  claimedAmount: number;
  /** For decisions. */
  approvedAmount?: number;
  reason?: string;
  /** For settlement: the record that must accompany it. */
  hasSettlementRecord?: boolean;
}

export type GuardResult =
  | { ok: true; approvedAmount: number | null; selfApproved: boolean; reason: string | null }
  | { ok: false; error: string };

/**
 * Every rule in §3's table and §4's invariants, in one place. The database
 * seam calls this with the locked row; nothing else decides.
 */
export function transitionGuard(input: GuardInput): GuardResult {
  const { from, to, actor } = input;
  const reason = input.reason?.trim() || null;

  if (!canTransition(from, to)) {
    return {
      ok: false,
      error: isTerminal(from)
        ? `This claim is ${STATUS_LABEL[from].toLowerCase()} and can't change.`
        : `A claim that is ${STATUS_LABEL[from].toLowerCase()} can't become ${STATUS_LABEL[to].toLowerCase()}.`,
    };
  }

  switch (to) {
    case "SUBMITTED": {
      if (!actor.isClaimant) {
        return { ok: false, error: "Only the claimant can submit a claim." };
      }
      return { ok: true, approvedAmount: null, selfApproved: false, reason: null };
    }

    case "WITHDRAWN": {
      // Invariant 13: the claimant, and nobody else — no permission substitutes.
      if (!actor.isClaimant) {
        return { ok: false, error: "Only the person who submitted a claim can withdraw it." };
      }
      return { ok: true, approvedAmount: null, selfApproved: false, reason };
    }

    case "APPROVED":
    case "PARTIALLY_APPROVED":
    case "REJECTED": {
      if (!actor.canApprove) {
        return { ok: false, error: "You don't have permission to decide expense claims." };
      }
      const selfApproved = actor.isClaimant;
      if (selfApproved && !input.allowSelfApproval) {
        return { ok: false, error: "You can't decide your own claim. Ask another approver." };
      }
      if (to === "REJECTED") {
        if (!reason) {
          return { ok: false, error: "A rejection needs a reason — the employee reads it word for word." };
        }
        return { ok: true, approvedAmount: null, selfApproved, reason };
      }
      if (input.approvedAmount === undefined) {
        return { ok: false, error: "Enter the amount you are approving." };
      }
      const derived = deriveDecision(input.claimedAmount, input.approvedAmount);
      if (!derived.ok) return derived;
      if (derived.status !== to) {
        return {
          ok: false,
          error:
            derived.status === "PARTIALLY_APPROVED"
              ? "Approving less than claimed is a partial approval — it needs a reason."
              : "The full amount was approved; nothing partial about it.",
        };
      }
      if (to === "PARTIALLY_APPROVED" && !reason) {
        return { ok: false, error: "Say why you are approving a different amount." };
      }
      return { ok: true, approvedAmount: input.approvedAmount, selfApproved, reason };
    }

    case "SETTLED": {
      if (!actor.canApprove) {
        return { ok: false, error: "You don't have permission to settle expense claims." };
      }
      if (!input.hasSettlementRecord) {
        return { ok: false, error: "Settlement needs a record of how it was paid." };
      }
      return { ok: true, approvedAmount: null, selfApproved: false, reason };
    }

    default:
      return { ok: false, error: "That change is not allowed." };
  }
}
