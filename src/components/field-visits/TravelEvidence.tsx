import { StatusChip } from "@/components/ui/StatusChip";
import type { ClaimEvidence } from "@/lib/field-visits/conveyance";
import { monthName } from "@/lib/field-visits/state";

/**
 * What a travel allowance claim was worked out from (FIELD-VISITS-MODULE.md
 * §7), fixed at submission: the recorded and claimed kilometres side by
 * side, the rate, day by day, and what the approver should know.
 */
export function TravelEvidence({ evidence, detailed = true }: { evidence: ClaimEvidence; detailed?: boolean }) {
  const differs = Math.abs(evidence.claimedKm - evidence.recordedKm) >= 0.05;
  const flags = [
    differs && { key: "km-differs", label: "Kilometres changed", tone: "warning" as const },
    evidence.tripsAwaiting > 0 && {
      key: "trips-awaiting",
      label: `${evidence.tripsAwaiting} trip${evidence.tripsAwaiting === 1 ? "" : "s"} not yet approved`,
      tone: "warning" as const,
    },
    evidence.estimatedKm > 0 && { key: "km-estimated", label: `${evidence.estimatedKm} km estimated`, tone: "info" as const },
  ].filter(Boolean) as Array<{ key: string; label: string; tone: "warning" | "info" }>;

  return (
    <div className="rounded-md border border-border-subtle p-3">
      <p className="text-label text-text-primary">Travel in {monthName(evidence.month)}</p>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-secondary">
        <dt className="text-text-secondary">Recorded from field trips</dt>
        <dd className="text-right font-mono tabular-nums text-text-primary">{evidence.recordedKm} km</dd>
        <dt className="text-text-secondary">Claimed</dt>
        <dd className={`text-right font-mono tabular-nums ${differs ? "font-semibold text-status-warning-fg" : "text-text-primary"}`}>
          {evidence.claimedKm} km
        </dd>
        <dt className="text-text-secondary">Rate</dt>
        <dd className="text-right text-text-primary">
          ₹{evidence.ratePerKm.toFixed(2)} per km · {evidence.vehicleName}
        </dd>
        <dt className="text-text-secondary">Trips counted</dt>
        <dd className="text-right text-text-primary">
          {evidence.tripsCounted}
          {evidence.tripsDeclined > 0 ? ` (${evidence.tripsDeclined} declined, left out)` : ""}
        </dd>
      </dl>
      {evidence.changeReason && (
        <p className="mt-2 text-secondary text-text-primary">Reason for the change: “{evidence.changeReason}”</p>
      )}
      {flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {flags.map((f) => (
            <StatusChip key={f.key} status={f} size="sm" bordered />
          ))}
        </div>
      )}
      {detailed && evidence.days.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-caption text-brand-primary">Day by day</summary>
          <ul className="mt-1 flex flex-col gap-0.5 text-caption text-text-secondary">
            {evidence.days.map((d) => (
              <li key={d.date} className="flex justify-between gap-3">
                <span>
                  {new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
                    new Date(`${d.date}T00:00:00.000Z`),
                  )}{" "}
                  · {d.trips} trip{d.trips === 1 ? "" : "s"}
                </span>
                <span className="font-mono tabular-nums">
                  {d.km} km{d.estimatedKm > 0 ? ` (${d.estimatedKm} estimated)` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
