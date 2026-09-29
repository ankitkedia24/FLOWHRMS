import { formatAmount, formatWhen } from "@/lib/expenses/format";
import type { ClaimStatus } from "@/lib/expenses/state";

interface TransitionRow {
  id: string;
  fromStatus: ClaimStatus | null;
  toStatus: ClaimStatus;
  actorUserId: string | null;
  reason: string | null;
  approvedAmount: { toString(): string } | null;
  selfApproved: boolean;
  createdAt: Date;
}

/**
 * The claim’s own history (EXPENSES-MODULE.md §14): who moved it, from
 * what, to what, why — rendered from the transition table, not inferred.
 */
export function ClaimTimeline({
  transitions,
  actorNames,
  claimedAmount,
  timeZone,
}: {
  transitions: TransitionRow[];
  actorNames: Record<string, string>;
  claimedAmount: number;
  timeZone: string;
}) {
  if (transitions.length === 0) return null;

  const who = (id: string | null) => (id && actorNames[id]) || "Someone";

  const line = (t: TransitionRow): string => {
    const name = who(t.actorUserId);
    switch (t.toStatus) {
      case "SUBMITTED":
        return `Submitted by ${name}`;
      case "APPROVED":
        return `Approved ${formatAmount(t.approvedAmount ?? claimedAmount)} by ${name}${t.selfApproved ? " (self-approved)" : ""}`;
      case "PARTIALLY_APPROVED":
        return `Approved ${formatAmount(t.approvedAmount ?? 0)} of ${formatAmount(claimedAmount)} by ${name}${t.selfApproved ? " (self-approved)" : ""}`;
      case "REJECTED":
        return `Refused by ${name}`;
      case "WITHDRAWN":
        return `Withdrawn by ${name}`;
      case "SETTLED":
        return `Settled by ${name}`;
      default:
        return `${t.toStatus} by ${name}`;
    }
  };

  return (
    <section aria-labelledby="claim-history">
      <h2 id="claim-history" className="mb-2 font-heading text-h3 text-text-primary">
        History
      </h2>
      <ol className="flex flex-col divide-y divide-border-subtle rounded-md border border-border-subtle bg-surface-default">
        {transitions.map((t) => (
          <li key={t.id} className="px-4 py-2.5">
            <p className="text-body text-text-primary">{line(t)}</p>
            {t.reason && (
              <p className="text-secondary text-text-secondary">&ldquo;{t.reason}&rdquo;</p>
            )}
            <p className="text-caption text-text-tertiary">{formatWhen(t.createdAt, timeZone)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
