"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { getPolicy, setPolicy } from "@/lib/policies";
import {
  RECEIPT_RETENTION_FLOOR_YEARS,
  normalizeExpensesPolicy,
  policyIsUsable,
  type ExpensesPolicy,
} from "./policy";

/**
 * Publishing the expense rules (EXPENSES-MODULE.md §8). A new version
 * every time; claims already submitted keep the version that judged them.
 */

export type ActionResult =
  | { ok: true; message: string; detail?: string }
  | { ok: false; error: string };

const categorySchema = z.object({
  key: z.string().max(40).optional(),
  name: z.string().trim().min(1).max(60),
  receiptRequired: z.boolean(),
  maxClaimAmount: z.number().finite().positive().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});

const policySchema = z.object({
  submissionDeadlineDays: z.number().int().min(1).max(3650),
  defaultSettlementRoute: z.enum(["PAYROLL", "OUTSIDE"]),
  allowSelfApproval: z.boolean(),
  receiptRetentionYears: z.number().int().min(RECEIPT_RETENTION_FLOOR_YEARS).max(99),
  categories: z.array(categorySchema).min(1).max(50),
});

export async function publishExpensesPolicyAction(
  input: z.input<typeof policySchema>,
): Promise<ActionResult> {
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error:
        issue?.path[0] === "receiptRetentionYears"
          ? `Receipts are kept for at least ${RECEIPT_RETENTION_FLOOR_YEARS} years after settlement.`
          : issue?.path[0] === "categories"
            ? "Add at least one category."
            : "Check the values — something is out of range.",
    };
  }

  const { session, decision } = await checkAccess({
    module: "EXPENSES",
    permission: "policy.edit",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don’t have access to expense rules." };
  }

  const normalized = normalizeExpensesPolicy(parsed.data);
  if (!policyIsUsable(normalized)) {
    return { ok: false, error: "Keep at least one category active — nobody can claim otherwise." };
  }

  const previous = await getPolicy<ExpensesPolicy>(session.tenant.id, "expenses");
  const { version } = await setPolicy(session.tenant.id, "expenses", normalized, session.user.id);

  await recordAuditEvent(session, {
    action: "expense.policy_published",
    entityType: "tenant_policy",
    before: previous
      ? {
          categories: previous.categories?.length ?? 0,
          submissionDeadlineDays: previous.submissionDeadlineDays,
          receiptRetentionYears: previous.receiptRetentionYears,
        }
      : undefined,
    after: {
      version,
      categories: normalized.categories.length,
      activeCategories: normalized.categories.filter((c) => c.isActive).length,
      submissionDeadlineDays: normalized.submissionDeadlineDays,
      defaultSettlementRoute: normalized.defaultSettlementRoute,
      allowSelfApproval: normalized.allowSelfApproval,
      receiptRetentionYears: normalized.receiptRetentionYears,
    },
  });

  revalidatePath("/admin/settings/expenses");
  revalidatePath("/admin/expenses");
  revalidatePath("/expenses");

  return {
    ok: true,
    message: `Version ${version} is live.`,
    detail: "Claims already submitted keep the rules that applied when they were sent.",
  };
}
