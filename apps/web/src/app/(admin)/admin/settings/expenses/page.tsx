import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Alert } from "@/components/ui/Alert";
import { loadExpensesPolicy } from "@/lib/expenses/access";
import { DEFAULT_EXPENSES_POLICY } from "@/lib/expenses/policy";
import { ExpensesEditor } from "./ExpensesEditor";

export const metadata: Metadata = { title: "Expense rules" };

/**
 * The expense rules (EXPENSES-MODULE.md §8): categories, receipt
 * requirement, caps, deadline, settlement preference, self-approval,
 * retention. Publishing is the deliberate act; claims can only be
 * submitted once a version exists.
 */
export default async function ExpenseRulesPage() {
  const { session, decision } = await checkAccess({
    module: "EXPENSES",
    permission: "policy.edit",
  });
  if (!decision.allowed) redirect("/unauthorized");

  const published = devFixtureOffline() ? null : await loadExpensesPolicy(session.tenant.id);
  const initial = published?.policy ?? DEFAULT_EXPENSES_POLICY;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">Expense rules</h1>
        <Link
          href="/admin/settings"
          className="text-label text-brand-primary underline-offset-2 hover:underline"
        >
          Back to settings
        </Link>
      </div>

      {published ? (
        <Alert variant="info" title={`Version ${published.version} is live. Employees can claim.`}>
          Publishing again creates version {published.version + 1}. Claims already
          submitted keep the rules that judged them — history is never rewritten.
        </Alert>
      ) : (
        <Alert variant="warning" title="Not published yet — nobody can claim.">
          These are suggested categories. Change what does not fit your company,
          set the deadline and receipt rules, and publish.
        </Alert>
      )}

      <ExpensesEditor initial={initial} published={Boolean(published)} />
    </div>
  );
}
