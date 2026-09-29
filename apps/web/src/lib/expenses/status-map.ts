import { STATUS, type Status } from "@/lib/status";
import type { ClaimStatus } from "./state";

/** Status = text + colour, never colour alone (design system). */
export const CLAIM_STATUS: Record<ClaimStatus, Status> = {
  DRAFT: STATUS.draft,
  SUBMITTED: STATUS.submitted,
  APPROVED: STATUS.approved,
  PARTIALLY_APPROVED: STATUS.partlyApproved,
  REJECTED: STATUS.rejected,
  WITHDRAWN: STATUS.withdrawn,
  SETTLED: STATUS.settled,
};

export interface FlagFacts {
  isLate: boolean;
  isOverCap: boolean;
  isPossibleDuplicate: boolean;
}

/** The three warning chips, in the order an approver should read them. */
export function flagStatuses(facts: FlagFacts): Status[] {
  const out: Status[] = [];
  if (facts.isPossibleDuplicate) out.push(STATUS.possibleDuplicate);
  if (facts.isOverCap) out.push(STATUS.overCap);
  if (facts.isLate) out.push(STATUS.lateClaim);
  return out;
}

/** Plain-language meaning of each flag (EXPENSES-MODULE.md §11). */
export const FLAG_MEANING: Record<keyof FlagFacts, string> = {
  isLate: "Submitted after the deadline for its date. It can still be approved.",
  isOverCap: "Above the cap for this category when it was submitted. It can still be approved.",
  isPossibleDuplicate:
    "Another claim by this person has the same category, date and amount. Check it is not the same expense twice.",
};

export function flagMeanings(facts: FlagFacts): string[] {
  const out: string[] = [];
  if (facts.isPossibleDuplicate) out.push(FLAG_MEANING.isPossibleDuplicate);
  if (facts.isOverCap) out.push(FLAG_MEANING.isOverCap);
  if (facts.isLate) out.push(FLAG_MEANING.isLate);
  return out;
}
