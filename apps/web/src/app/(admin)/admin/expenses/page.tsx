import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClaimCard } from "@/components/expenses/ClaimCard";
import { canViewOthersClaims, loadExpensesPolicy } from "@/lib/expenses/access";
import { listAdminClaims } from "@/lib/expenses/queries";

export const metadata: Metadata = { title: "Expenses" };

/**
 * The approver’s queue (EXPENSES-MODULE.md §11): waiting first, because
 * it is the work; then approved claims still owed; then recent history.
 */
export default async function AdminExpensesPage() {
  const { session, decision } = await checkAccess({ module: "EXPENSES" });
  if (!decision.allowed) redirect("/unauthorized");
  if (!canViewOthersClaims(session)) redirect("/unauthorized");

  if (devFixtureOffline()) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-heading text-h1 text-text-primary">Expenses</h1>
        <Card flush>
          <EmptyState title="No claims yet." body="Connect a database to see claims." />
        </Card>
      </div>
    );
  }

  const [published, { waiting, unsettled, recent }] = await Promise.all([
    loadExpensesPolicy(session.tenant.id),
    listAdminClaims(session),
  ]);
  const canEditRules = session.permissions.has("policy.edit");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">Expenses</h1>
        {canEditRules && (
          <Link
            href="/admin/settings/expenses"
            className="text-label text-brand-primary underline-offset-2 hover:underline"
          >
            Expense rules
          </Link>
        )}
      </div>

      {!published && (
        <Alert variant="warning" title="No expense rules published yet — nobody can claim.">
          {canEditRules ? (
            <>
              Set up categories and publish under{" "}
              <Link href="/admin/settings/expenses" className="text-brand-primary underline underline-offset-2">
                Expense rules
              </Link>
              .
            </>
          ) : (
            "Someone with policy access needs to publish the expense rules first."
          )}
        </Alert>
      )}

      <section aria-labelledby="waiting">
        <h2 id="waiting" className="mb-3 font-heading text-h2 text-text-primary">
          Waiting for a decision ({waiting.length})
        </h2>
        {waiting.length === 0 ? (
          <Card flush>
            <EmptyState title="Nothing waiting." body="Claims land here the moment someone submits one." />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {waiting.map((claim) => (
              <li key={claim.id}>
                <ClaimCard claim={claim} href={`/admin/expenses/${claim.id}`} showPerson />
              </li>
            ))}
          </ul>
        )}
      </section>

      {unsettled.length > 0 && (
        <section aria-labelledby="unsettled">
          <h2 id="unsettled" className="mb-3 font-heading text-h2 text-text-primary">
            Approved, not yet settled ({unsettled.length})
          </h2>
          <ul className="flex flex-col gap-3">
            {unsettled.map((claim) => (
              <li key={claim.id}>
                <ClaimCard claim={claim} href={`/admin/expenses/${claim.id}`} showPerson />
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="recent">
          <h2 id="recent" className="mb-3 font-heading text-h2 text-text-primary">
            Recently closed
          </h2>
          <ul className="flex flex-col gap-3">
            {recent.map((claim) => (
              <li key={claim.id}>
                <ClaimCard claim={claim} href={`/admin/expenses/${claim.id}`} showPerson />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
