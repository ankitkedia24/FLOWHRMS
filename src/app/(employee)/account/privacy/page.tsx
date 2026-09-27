import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { CONTROLLER, CURRENT_DOCUMENTS } from "@/lib/consent/documents";
import { requiredNoticeKeys } from "@/lib/consent/chain";
import { consentStandings } from "@/lib/consent/record";
import { DATA_REQUEST_LABEL } from "@/lib/consent/requests";
import { PrivacyControls } from "./PrivacyControls";

export const metadata: Metadata = { title: "Privacy & consent" };

const REQUEST_STATUS = {
  OPEN: { key: "dr-open", label: "Received", tone: "info" },
  IN_PROGRESS: { key: "dr-progress", label: "In progress", tone: "warning" },
  RESOLVED: { key: "dr-resolved", label: "Answered", tone: "success" },
  REJECTED: { key: "dr-rejected", label: "Declined", tone: "neutral" },
} as const;

function formatDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

/**
 * Everything a Data Principal can do about their own data, in one place:
 * see what they agreed to and when, change optional choices, withdraw
 * consent as easily as they gave it, and exercise their rights.
 */
export default async function PrivacyPage() {
  const session = await requireSession();
  const tz = session.tenant.timezone;
  const isOwner = session.membership.roleKey === "OWNER";
  const keys = requiredNoticeKeys({ isOwner });
  const [standings, requests] = await Promise.all([
    session.source === "supabase" ? consentStandings(session.user.id, keys) : Promise.resolve([]),
    session.source === "supabase"
      ? getDb().dataRequest.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  const accountStanding = standings.find((s) => s.key === "account_holder");
  const productUpdates =
    accountStanding?.status.state === "current"
      ? accountStanding.status.choices.some((c) => c.key === "product_updates" && c.granted)
      : false;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/account" className="text-label text-brand-primary underline-offset-2 hover:underline">
          ← Account
        </Link>
        <h1 className="mt-2 font-heading text-h1 text-text-primary">Privacy &amp; consent</h1>
      </div>

      <Card>
        <CardHeader title="What you agreed to" />
        <ul className="flex flex-col gap-3">
          {standings.map((s) => {
            const doc = CURRENT_DOCUMENTS[s.key];
            return (
              <li key={s.key} className="border-b border-border-subtle pb-3 last:border-0 last:pb-0">
                <p className="text-body font-semibold text-text-primary">{doc.title}</p>
                <p className="text-secondary text-text-secondary">
                  {s.status.state === "current"
                    ? `Agreed on ${formatDate(s.status.grantedAt, tz)} · version ${s.status.version}`
                    : "Not agreed to the current version"}
                </p>
                {s.status.state === "current" && (
                  <ul className="mt-1 flex flex-col gap-0.5 text-caption text-text-secondary">
                    {s.status.choices.map((c) => (
                      <li key={c.key}>
                        {c.granted ? "✓" : "✗"} {c.label}
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href={`/privacy/notice/${s.key}`}
                  target="_blank"
                  className="mt-1 inline-block text-label text-brand-primary underline-offset-2 hover:underline"
                >
                  Read the notice
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      <PrivacyControls isOwner={isOwner} productUpdates={productUpdates} />

      <Card>
        <CardHeader title="Your requests" />
        {requests.length === 0 ? (
          <p className="text-secondary text-text-secondary">No requests yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-border-subtle pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-body font-semibold text-text-primary">
                    {DATA_REQUEST_LABEL[r.type]}
                  </p>
                  <p className="text-caption text-text-secondary">
                    Sent {formatDate(r.createdAt, tz)} · answer due by{" "}
                    {formatDate(r.dueAt, tz)}
                  </p>
                  {r.response && (
                    <p className="mt-1 whitespace-pre-wrap text-secondary text-text-secondary">
                      {r.response}
                    </p>
                  )}
                </div>
                <StatusChip status={REQUEST_STATUS[r.status]} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-caption text-text-secondary">
        Questions or grievances: {CONTROLLER.grievanceOfficer}, {CONTROLLER.email},{" "}
        {CONTROLLER.phone}. If you are not satisfied with the answer you may
        complain to the Data Protection Board of India.{" "}
        <Link href="/privacy" className="text-brand-primary underline-offset-2 hover:underline">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}
