import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClaimCard } from "@/components/expenses/ClaimCard";
import { loadExpensesPolicy, todayIn } from "@/lib/expenses/access";
import { activeCategories, policyIsUsable } from "@/lib/expenses/policy";
import { listMyClaims } from "@/lib/expenses/queries";
import { ClaimForm } from "./ClaimForm";

export const metadata: Metadata = { title: "Expenses" };

/**
 * The employee’s expenses (EXPENSES-MODULE.md §2): submit a claim, see
 * every claim of your own with its status, reason and settlement.
 */
export default async function ExpensesPage() {
  const { session, decision } = await checkAccess({ module: "EXPENSES" });
  if (!decision.allowed) redirect("/home");

  if (devFixtureOffline()) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-heading text-h1 text-text-primary">Expenses</h1>
        <Card flush>
          <EmptyState warm title="No claims yet." body="Connect a database to submit expenses." />
        </Card>
      </div>
    );
  }

  const [published, claims] = await Promise.all([
    loadExpensesPolicy(session.tenant.id),
    listMyClaims(session),
  ]);
  const usable = published !== null && policyIsUsable(published.policy);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-h1 text-text-primary">Expenses</h1>

      {usable ? (
        <ClaimForm
          tenantId={session.tenant.id}
          categories={activeCategories(published.policy).map((c) => ({
            key: c.key,
            name: c.name,
            receiptRequired: c.receiptRequired,
            maxClaimAmount: c.maxClaimAmount,
          }))}
          deadlineDays={published.policy.submissionDeadlineDays}
          today={todayIn(session.tenant.timezone)}
        />
      ) : (
        <Card flush>
          <EmptyState
            warm
            title="No categories yet."
            body="When your company sets up its expense rules, you can claim here."
          />
        </Card>
      )}

      <section aria-labelledby="my-claims">
        <h2 id="my-claims" className="mb-3 font-heading text-h2 text-text-primary">
          My claims
        </h2>
        {claims.length === 0 ? (
          <Card flush>
            <EmptyState warm title="Nothing claimed yet." body="Your claims and their decisions appear here." />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {claims.map((claim) => (
              <li key={claim.id}>
                <ClaimCard claim={claim} href={`/expenses/${claim.id}`} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
