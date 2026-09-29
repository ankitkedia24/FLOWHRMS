"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { raiseActionRequest, resolveActionRequest } from "@/lib/actions/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RECEIPT_BUCKET, RECEIPT_MAX_BYTES, RECEIPT_MAX_FILES, RECEIPT_MIME } from "./bucket";
import { canViewOthersClaims, loadExpensesPolicy, todayIn } from "./access";
import { formatAmount, toIsoDate } from "./format";
import {
  monthLabel,
  offeredRoutes,
  payrollRoundingNote,
  seamFailureMessage,
  settlementMonth,
} from "./payroll-settlement";
import { payrollAvailable, settleViaPayroll, type PayrollSettlementResult } from "./settle-payroll";
import { claimRef, computeFlags, deriveDecision, validateSubmission } from "./state";
import { transitionClaim } from "./transition";

/**
 * Expense claim actions (EXPENSES-MODULE.md §10–12).
 *
 * Every status change goes through `transitionClaim` inside a transaction
 * that locks the row. These actions add what surrounds the change: the
 * validation before it, and the tile, notification and cache work after.
 */

export type ActionResult =
  | { ok: true; message: string; detail?: string; claimId?: string }
  | { ok: false; error: string };

const TX = { timeout: 15_000, maxWait: 5_000 };
const SIGNED_URL_TTL_SECONDS = 120;

function refresh(claimId?: string) {
  revalidatePath("/expenses");
  revalidatePath("/admin/expenses");
  if (claimId) {
    revalidatePath(`/expenses/${claimId}`);
    revalidatePath(`/admin/expenses/${claimId}`);
  }
}

function fail(error: unknown, fallback: string): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

// ----------------------------------------------------------------- submit

const receiptSchema = z.object({
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(200),
  mime: z.enum(RECEIPT_MIME),
  sizeBytes: z.number().int().positive().max(RECEIPT_MAX_BYTES),
});

const submitSchema = z.object({
  categoryKey: z.string().min(1).max(40),
  amount: z.number().finite(),
  expenseDate: z.string().length(10),
  description: z.string().max(1000),
  receipts: z.array(receiptSchema).max(RECEIPT_MAX_FILES),
});

/** Submit-only in E1: the row is created and submitted in one transaction. */
export async function submitClaimAction(
  input: z.input<typeof submitSchema>,
): Promise<ActionResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the claim details." };

  const { session, decision } = await checkAccess({ module: "EXPENSES" });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don’t have access to Expenses." };
  }

  const db = getDb();
  const tenantId = session.tenant.id;
  const membershipId = session.membership.id;

  const published = await loadExpensesPolicy(tenantId);
  if (!published) {
    return {
      ok: false,
      error: "Your company hasn’t set up expense categories yet. Ask your admin.",
    };
  }
  const { policy, version } = published;

  const membership = await db.tenantMembership.findFirst({
    where: { id: membershipId, tenantId },
    select: { joinedOn: true },
  });
  const today = todayIn(session.tenant.timezone);

  const check = validateSubmission(
    { ...parsed.data, receiptCount: parsed.data.receipts.length },
    { policy, today, joinedOn: membership?.joinedOn ? toIsoDate(membership.joinedOn) : null },
  );
  if (!check.ok) return check;

  // Receipts must sit under this tenant’s prefix — nothing else is recorded.
  for (const receipt of parsed.data.receipts) {
    if (!receipt.path.startsWith(`${tenantId}/`)) {
      return { ok: false, error: `${receipt.name} could not be read. Upload it again.` };
    }
  }

  const expenseDate = new Date(`${parsed.data.expenseDate}T00:00:00.000Z`);
  const duplicate = await db.expenseClaim.findFirst({
    where: {
      tenantId,
      membershipId,
      categoryKey: check.category.key,
      expenseDate,
      claimedAmount: check.amount,
      status: { notIn: ["REJECTED", "WITHDRAWN"] },
    },
    select: { id: true },
  });
  const flags = computeFlags({
    expenseDate: parsed.data.expenseDate,
    submittedOn: today,
    deadlineDays: policy.submissionDeadlineDays,
    amount: check.amount,
    maxClaimAmount: check.category.maxClaimAmount,
    duplicateExists: Boolean(duplicate),
  });

  let claimId = "";
  let ref = "";
  try {
    await db.$transaction(async (tx) => {
      const counter = await tx.$queryRaw<Array<{ claimNumber: number }>>`
        INSERT INTO "expense_counters" ("tenantId", "next") VALUES (${tenantId}::uuid, 2)
        ON CONFLICT ("tenantId") DO UPDATE SET "next" = "expense_counters"."next" + 1
        RETURNING "next" - 1 AS "claimNumber"`;
      const claimNumber = counter[0].claimNumber;

      const claim = await tx.expenseClaim.create({
        data: {
          tenantId,
          membershipId,
          claimNumber,
          status: "DRAFT",
          categoryKey: check.category.key,
          categoryName: check.category.name,
          receiptRequiredAtSubmission: check.category.receiptRequired,
          maxClaimAmountAtSubmission: check.category.maxClaimAmount,
          claimedAmount: check.amount,
          expenseDate,
          description: check.description,
          isLate: flags.isLate,
          isOverCap: flags.isOverCap,
          isPossibleDuplicate: flags.isPossibleDuplicate,
          policyVersion: version,
        },
      });
      claimId = claim.id;

      for (const receipt of parsed.data.receipts) {
        const row = await tx.expenseReceipt.create({
          data: { tenantId, claimId: claim.id, ...receipt, uploadedById: session.user.id },
        });
        await recordAuditEvent(
          session,
          {
            action: "expense.receipt_uploaded",
            entityType: "expense_receipt",
            entityId: row.id,
            metadata: { claimId: claim.id, mime: row.mime, sizeBytes: row.sizeBytes },
          },
          tx,
        );
      }

      const result = await transitionClaim({
        tx,
        session,
        claimId: claim.id,
        to: "SUBMITTED",
        allowSelfApproval: policy.allowSelfApproval,
      });
      if (!result.ok) throw new Error(result.error);
      ref = result.ref;
    }, TX);
  } catch (error) {
    return fail(error, "That didn’t go through. Try again.");
  }

  const notes = [
    flags.isLate ? "late" : null,
    flags.isOverCap ? "over the category cap" : null,
    flags.isPossibleDuplicate ? "possible duplicate" : null,
  ].filter(Boolean);

  // The decision tile, through the same queue as every other approval.
  await raiseActionRequest({
    tenantId,
    kind: "EXPENSE_CLAIM",
    subjectType: "expense_claim",
    subjectId: claimId,
    aboutMembershipId: membershipId,
    title: `${session.user.displayName} — expense claim ${ref}`,
    body: `${formatAmount(check.amount)} · ${check.category.name}${notes.length ? ` · ${notes.join(", ")}` : ""}`,
    href: `/admin/expenses/${claimId}`,
    actorUserId: session.user.id,
  });

  refresh(claimId);
  return {
    ok: true,
    claimId,
    message: `${ref} sent for approval.`,
    detail: notes.length
      ? `Flagged as ${notes.join(" and ")} — the approver sees this; it can still be approved.`
      : "You’ll hear the decision here and on the bell.",
  };
}

// --------------------------------------------------------------- withdraw

const withdrawSchema = z.object({
  claimId: z.string().uuid(),
  reason: z.string().max(300).optional(),
});

/**
 * The claimant’s own door out, while nobody has decided (§3). Terminal:
 * a corrected claim is a new claim.
 */
export async function withdrawClaimAction(
  input: z.input<typeof withdrawSchema>,
): Promise<ActionResult> {
  const parsed = withdrawSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That claim could not be read." };

  const { session, decision } = await checkAccess({ module: "EXPENSES" });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don’t have access to Expenses." };
  }

  const db = getDb();
  let ref = "";
  try {
    await db.$transaction(async (tx) => {
      const result = await transitionClaim({
        tx,
        session,
        claimId: parsed.data.claimId,
        to: "WITHDRAWN",
        allowSelfApproval: false,
        reason: parsed.data.reason,
      });
      if (!result.ok) throw new Error(result.error);
      ref = result.ref;
    }, TX);
  } catch (error) {
    return fail(error, "That didn’t go through. Try again.");
  }

  // A withdrawn claim asks nothing of the approvers: the tile goes quietly.
  await resolveActionRequest({
    tenantId: session.tenant.id,
    subjectType: "expense_claim",
    subjectId: parsed.data.claimId,
    resolvedByUserId: session.user.id,
    resolution: "withdrawn",
  });

  refresh(parsed.data.claimId);
  return {
    ok: true,
    message: `${ref} withdrawn.`,
    detail: "It can’t be reopened. Submit a new claim if you still need to.",
  };
}

// ----------------------------------------------------------------- decide

const decideSchema = z.object({
  claimId: z.string().uuid(),
  decision: z.enum(["APPROVE", "APPROVE_AMOUNT", "REJECT"]),
  approvedAmount: z.number().finite().optional(),
  reason: z.string().max(300).optional(),
});

/**
 * Approve in full, approve a different amount (with a reason), or reject
 * (with a reason). Which of APPROVED / PARTIALLY_APPROVED results is
 * derived from the amounts, never chosen (invariant 4).
 */
export async function decideClaimAction(
  input: z.input<typeof decideSchema>,
): Promise<ActionResult> {
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That decision could not be read." };

  const { session, decision } = await checkAccess({
    module: "EXPENSES",
    permission: "expenses.approve",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don’t have access to this." };
  }

  const db = getDb();
  const tenantId = session.tenant.id;

  const claim = await db.expenseClaim.findFirst({
    where: { id: parsed.data.claimId, tenantId },
    include: { membership: { include: { user: { select: { id: true, displayName: true } } } } },
  });
  if (!claim) return { ok: false, error: "That claim is not here." };
  const claimed = Number(claim.claimedAmount);

  let to: "APPROVED" | "PARTIALLY_APPROVED" | "REJECTED";
  let approvedAmount: number | undefined;
  if (parsed.data.decision === "REJECT") {
    to = "REJECTED";
  } else {
    approvedAmount = parsed.data.decision === "APPROVE" ? claimed : parsed.data.approvedAmount;
    if (approvedAmount === undefined) {
      return { ok: false, error: "Enter the amount you are approving." };
    }
    const derived = deriveDecision(claimed, approvedAmount);
    if (!derived.ok) return derived;
    to = derived.status;
  }

  const published = await loadExpensesPolicy(tenantId);
  const allowSelfApproval = published?.policy.allowSelfApproval ?? false;

  let ref = "";
  let selfApproved = false;
  try {
    await db.$transaction(async (tx) => {
      const result = await transitionClaim({
        tx,
        session,
        claimId: claim.id,
        to,
        allowSelfApproval,
        approvedAmount,
        reason: parsed.data.reason,
      });
      if (!result.ok) throw new Error(result.error);
      ref = result.ref;
      selfApproved = result.selfApproved;
    }, TX);
  } catch (error) {
    return fail(error, "That didn’t go through. Try again.");
  }

  await resolveActionRequest({
    tenantId,
    subjectType: "expense_claim",
    subjectId: claim.id,
    resolvedByUserId: session.user.id,
    resolution: to,
  });

  const reason = parsed.data.reason?.trim();
  const who = claim.membership.user.displayName;
  const title =
    to === "APPROVED"
      ? `Expense ${ref} approved: ${formatAmount(claimed)}`
      : to === "PARTIALLY_APPROVED"
        ? `Expense ${ref}: ${formatAmount(approvedAmount ?? 0)} of ${formatAmount(claimed)} approved`
        : `Expense ${ref} refused`;
  await notify.expenseUpdate(
    session,
    claim.membership.user.id,
    title,
    reason || (to === "REJECTED" ? undefined : "Settlement follows — you’ll be told how."),
    `/expenses/${claim.id}`,
  );

  refresh(claim.id);
  return {
    ok: true,
    message:
      to === "APPROVED"
        ? `Approved ${formatAmount(claimed)} for ${who}.${selfApproved ? " Recorded as self-approved." : ""}`
        : to === "PARTIALLY_APPROVED"
          ? `Approved ${formatAmount(approvedAmount ?? 0)} of ${formatAmount(claimed)} for ${who}. They see your reason.`
          : `Refused. ${who} sees your reason word for word.`,
  };
}

// ----------------------------------------------------------------- settle

const settleSchema = z.object({
  claimId: z.string().uuid(),
  route: z.enum(["OUTSIDE", "PAYROLL"]),
  reference: z.string().trim().max(200).optional(),
});

/**
 * Settlement (§12): a RECORD of how it was paid — FlowHRMS moves no money.
 * The routes offered are recomputed here, at write time, from the Payroll
 * entitlement: a PAYROLL request while Payroll is off is refused with a
 * plain message, never silently downgraded. OUTSIDE records free text;
 * PAYROLL goes through the seam (§13, settle-payroll.ts).
 */
export async function settleClaimAction(
  input: z.input<typeof settleSchema>,
): Promise<ActionResult> {
  const parsed = settleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the settlement details." };

  const { session, decision } = await checkAccess({
    module: "EXPENSES",
    permission: "expenses.approve",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don’t have access to this." };
  }

  const db = getDb();
  const tenantId = session.tenant.id;
  const claim = await db.expenseClaim.findFirst({
    where: { id: parsed.data.claimId, tenantId },
    include: { membership: { include: { user: { select: { id: true, displayName: true } } } } },
  });
  if (!claim) return { ok: false, error: "That claim is not here." };
  const person = claim.membership.user.displayName;
  const ref = claimRef(claim.claimNumber);

  const published = await loadExpensesPolicy(tenantId);
  const offered = offeredRoutes({
    payrollOn: await payrollAvailable(session),
    defaultRoute: published?.policy.defaultSettlementRoute ?? "OUTSIDE",
  });
  if (!offered.routes.includes(parsed.data.route)) {
    return { ok: false, error: seamFailureMessage("PAYROLL_UNAVAILABLE", {}) };
  }

  if (parsed.data.route === "OUTSIDE") return settleOutside(session, claim.id, ref, person, claim.membership.user.id, parsed.data.reference ?? "");
  return settleThroughPayroll(session, claim.id, ref, person, claim.membership.user.id, claim.decidedAt);
}
/** Outside payroll: free text, recorded and nothing else. */
async function settleOutside(
  session: Awaited<ReturnType<typeof checkAccess>>["session"],
  claimId: string,
  ref: string,
  person: string,
  userId: string,
  reference: string,
): Promise<ActionResult> {
  if (reference.length < 3) {
    return { ok: false, error: "Say how it was paid — cash, UPI, bank — and when." };
  }
  let amount = 0;
  try {
    await getDb().$transaction(async (tx) => {
      const result = await transitionClaim({
        tx,
        session,
        claimId,
        to: "SETTLED",
        allowSelfApproval: false,
        settlement: { route: "OUTSIDE", reference },
      });
      if (!result.ok) throw new Error(result.error);
      amount = result.settledAmount ?? 0;
    }, TX);
  } catch (error) {
    return fail(error, "That didn’t go through. Try again.");
  }

  await notify.expenseUpdate(
    session,
    userId,
    `Expense ${ref} settled: ${formatAmount(amount)}`,
    `Outside payroll — ${reference}`,
    `/expenses/${claimId}`,
  );
  refresh(claimId);
  return {
    ok: true,
    message: `${ref} settled — ${formatAmount(amount)} to ${person}, recorded as paid outside payroll.`,
  };
}

/** Through payroll: the seam (§13), inside one transaction. */
async function settleThroughPayroll(
  session: Awaited<ReturnType<typeof checkAccess>>["session"],
  claimId: string,
  ref: string,
  person: string,
  userId: string,
  decidedAt: Date | null,
): Promise<ActionResult> {
  let result: PayrollSettlementResult;
  try {
    result = await getDb().$transaction((tx) => settleViaPayroll({ tx, session, claimId }), TX);
  } catch (error) {
    return fail(error, "That didn’t go through. Try again.");
  }

  if (!result.ok) {
    const tz = session.tenant.timezone;
    switch (result.reason) {
      case "PAYROLL_UNAVAILABLE":
        return { ok: false, error: seamFailureMessage("PAYROLL_UNAVAILABLE", {}) };
      case "NO_OPEN_RUN":
        return {
          ok: false,
          error: seamFailureMessage("NO_OPEN_RUN", {
            monthLabel: monthLabel(settlementMonth(decidedAt ?? new Date(), tz)),
            earliestLockedLabel: result.earliestLockedMonth ? monthLabel(result.earliestLockedMonth) : null,
          }),
        };
      case "NO_LINE_FOR_PERSON":
        return {
          ok: false,
          error: seamFailureMessage("NO_LINE_FOR_PERSON", {
            monthLabel: monthLabel(result.periodMonth),
            personName: person,
          }),
        };
      case "REFUSED":
        return { ok: false, error: result.error };
    }
  }

  const note = payrollRoundingNote(result.approvedAmount, result.amount);
  if (!result.alreadySettled) {
    await notify.expenseUpdate(
      session,
      userId,
      `Expense ${ref}: ${formatAmount(result.amount)} in ${result.periodLabel} payroll`,
      note ?? "It will show on your payslip as an adjustment.",
      `/expenses/${claimId}`,
    );
  }

  refresh(claimId);
  revalidatePath("/admin/payroll");
  return {
    ok: true,
    message: result.alreadySettled
      ? `${ref} was already settled through ${result.periodLabel} payroll (${formatAmount(result.amount)}).`
      : `${ref} added to ${result.periodLabel} payroll as ${formatAmount(result.amount)} for ${person}.`,
    detail: note ?? undefined,
  };
}

// ---------------------------------------------------------------- receipt

export type ReceiptUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Signed access to a receipt (§10): the claimant, or anyone who may see
 * other people’s claims. Minted for two minutes; every mint is audited.
 */
export async function getReceiptUrlAction(receiptId: string): Promise<ReceiptUrlResult> {
  const { session, decision } = await checkAccess({ module: "EXPENSES" });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don’t have access to this." };
  }

  const receipt = await getDb().expenseReceipt.findFirst({
    where: { id: receiptId, tenantId: session.tenant.id }, // tenant-scoped
    include: { claim: { select: { id: true, membershipId: true, claimNumber: true } } },
  });
  if (!receipt) {
    // Never reveal whether a record exists in another tenant.
    return { ok: false, error: "That file is no longer available." };
  }

  const isOwn = receipt.claim.membershipId === session.membership.id;
  if (!isOwn && !canViewOthersClaims(session)) {
    return { ok: false, error: "You don’t have access to this file." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "File storage isn’t configured yet. Ask your admin." };
  }
  const { data, error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(receipt.path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    return { ok: false, error: "We couldn’t open that file. Try again." };
  }

  await recordAuditEvent(session, {
    action: "expense.receipt_viewed",
    entityType: "expense_receipt",
    entityId: receipt.id,
    metadata: {
      claimId: receipt.claim.id,
      ref: claimRef(receipt.claim.claimNumber),
      name: receipt.name,
      own: isOwn,
    },
  });

  return { ok: true, url: data.signedUrl };
}
