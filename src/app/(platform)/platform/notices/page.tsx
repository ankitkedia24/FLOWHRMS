import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { ReviewButton } from "./ReviewButton";

export const metadata: Metadata = { title: "Notices & policies" };

/**
 * Every published version of every notice and policy, with its fingerprint
 * and whether a lawyer has reviewed it. The legal-review flag is internal:
 * customers see the notice itself, never "draft".
 */
export default async function NoticesPage() {
  await requirePlatformAdmin();
  const db = getDb();
  const [notices, counts] = await Promise.all([
    db.consentNotice.findMany({ orderBy: [{ key: "asc" }, { version: "desc" }] }),
    db.consentRecord.groupBy({ by: ["noticeId"], _count: true }),
  ]);
  const countFor = new Map(counts.map((c) => [c.noticeId, c._count]));

  return (
    <>
      <h1 className="font-heading text-h1 text-text-primary">Notices &amp; policies</h1>
      <p className="mt-1 max-w-[65ch] text-secondary text-text-secondary">
        Published with <code>npm run publish-notices</code>. A published text never
        changes; a new version makes everyone consent again. Drafts written
        in-house must be reviewed by a lawyer before launch.
      </p>

      <div className="mt-5">
        {notices.length === 0 ? (
          <Card>
            <EmptyState
              title="Nothing published yet."
              body="Run npm run publish-notices. Sign-up and consent are refused until the notices are published."
            />
          </Card>
        ) : (
          <Card flush>
            <ul>
              {notices.map((n) => (
                <li
                  key={n.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-text-primary">
                      {n.title} · v{n.version} ({n.language})
                    </p>
                    <p className="text-caption text-text-secondary">
                      {n.key} · published {n.publishedAt.toISOString().slice(0, 10)} ·{" "}
                      {countFor.get(n.id) ?? 0} consent record(s) · sha256{" "}
                      <span className="font-mono">{n.sha256.slice(0, 16)}…</span>
                    </p>
                    {["account_holder", "customer_terms", "employee"].includes(n.key) ? (
                      <Link href={`/privacy/notice/${n.key}`} target="_blank" className="text-caption text-brand-primary underline-offset-2 hover:underline">
                        View current public version
                      </Link>
                    ) : (
                      <Link href={`/${n.key}`} target="_blank" className="text-caption text-brand-primary underline-offset-2 hover:underline">
                        View current public version
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip
                      status={
                        n.status === "PUBLISHED"
                          ? { key: "n-pub", label: "In force", tone: "success" }
                          : { key: "n-ret", label: "Retired", tone: "neutral" }
                      }
                      size="sm"
                    />
                    {n.legalReviewed ? (
                      <StatusChip status={{ key: "n-rev", label: "Legally reviewed", tone: "info" }} size="sm" />
                    ) : (
                      <>
                        <StatusChip status={{ key: "n-draft", label: "Pending legal review", tone: "warning" }} size="sm" />
                        <ReviewButton noticeId={n.id} />
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
