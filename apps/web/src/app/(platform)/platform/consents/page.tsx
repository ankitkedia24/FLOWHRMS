import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { fieldsFromRow, verifyChain, type PurposeChoice } from "@/lib/consent/chain";

export const metadata: Metadata = { title: "Consent records" };

const ACTION = {
  GRANTED: { key: "c-granted", label: "Granted", tone: "success" },
  UPDATED: { key: "c-updated", label: "Updated", tone: "info" },
  WITHDRAWN: { key: "c-withdrawn", label: "Withdrawn", tone: "warning" },
} as const;

function when(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

/**
 * Proof of consent (DPDP Act s.6(10): the burden of proof is ours). Search
 * by email or company, open a record to see exactly what was shown, and
 * export for a regulator or a customer.
 */
export default async function ConsentRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePlatformAdmin();
  const { q = "" } = await searchParams;
  const query = q.trim();
  const db = getDb();

  const [records, all] = await Promise.all([
    db.consentRecord.findMany({
      where:
        query.length >= 2
          ? {
              OR: [
                { email: { contains: query, mode: "insensitive" } },
                { tenantName: { contains: query, mode: "insensitive" } },
              ],
            }
          : {},
      orderBy: { seq: "desc" },
      take: 200,
    }),
    // The whole chain is checked on every visit; it is small, and a break
    // should never wait for someone to think of looking.
    db.consentRecord.findMany({ orderBy: { seq: "asc" } }),
  ]);

  const chain = verifyChain(
    all.map((r) => ({
      ...fieldsFromRow(r),
      seq: r.seq,
      prevHash: r.prevHash,
      recordHash: r.recordHash,
    })),
  );

  const exportQuery = query ? `&q=${encodeURIComponent(query)}` : "";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-h1 text-text-primary">Consent records</h1>
          <p className="mt-1 text-secondary text-text-secondary">
            Every notice shown and every choice made, as recorded. Records
            cannot be changed or deleted.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/platform/consents/export?format=csv${exportQuery}`}
            className="inline-flex h-10 items-center rounded-button border border-border-default px-3 text-label text-text-primary hover:bg-surface-sunken"
          >
            Export CSV
          </a>
          <a
            href={`/platform/consents/export?format=json${exportQuery}`}
            className="inline-flex h-10 items-center rounded-button border border-border-default px-3 text-label text-text-primary hover:bg-surface-sunken"
          >
            Export JSON
          </a>
        </div>
      </div>

      <div className="mt-4">
        {chain.ok ? (
          <p className="text-secondary text-status-success-text">
            ✓ Record chain intact — {chain.checked} record{chain.checked === 1 ? "" : "s"} checked.
          </p>
        ) : (
          <p role="alert" className="text-secondary text-status-error-text">
            ✗ Record chain broken at record #{chain.brokenAtSeq}: {chain.reason}
          </p>
        )}
      </div>

      <form className="mt-4 flex max-w-[520px] gap-2" action="/platform/consents">
        <label htmlFor="consent-q" className="sr-only">
          Search by email or company
        </label>
        <input
          id="consent-q"
          name="q"
          defaultValue={query}
          placeholder="Email or company name"
          className="h-11 min-w-0 flex-1 rounded-input border border-border-default bg-surface-default px-3 text-body"
        />
        <button className="h-11 rounded-button bg-brand-primary px-4 text-label text-text-on-primary">
          Search
        </button>
      </form>

      <div className="mt-4">
        {records.length === 0 ? (
          <Card>
            <EmptyState
              title={query ? "No records match." : "No consent recorded yet."}
              body="Records appear as people sign up, accept a notice, or change a choice."
            />
          </Card>
        ) : (
          <Card flush>
            <ul>
              {records.map((r) => {
                const purposes = r.purposes as unknown as PurposeChoice[];
                return (
                  <li key={r.id} className="border-b border-border-subtle last:border-0">
                    <Link
                      href={`/platform/consents/${r.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-sunken"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-body font-semibold text-text-primary">
                          {r.email}
                        </p>
                        <p className="text-caption text-text-secondary">
                          #{r.seq} · {r.tenantName ?? "No company"} · {r.noticeKey} v{r.noticeVersion} ·{" "}
                          {purposes.filter((p) => p.granted).length}/{purposes.length} granted ·{" "}
                          {when(r.createdAt)}
                        </p>
                      </div>
                      <StatusChip status={ACTION[r.action]} size="sm" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

