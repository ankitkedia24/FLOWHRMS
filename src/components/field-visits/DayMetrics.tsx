import { formatDistance, formatStay, type DaySummary } from "@/lib/field-visits/state";

/** A day's field visits in four numbers — the person's own view and the owner's. */
export function DayMetrics({ summary, placesWord }: { summary: DaySummary; placesWord: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Metric label="Visits" value={String(summary.visits)} />
      <Metric label={`At ${placesWord}`} value={formatStay(summary.atPlaceMinutes)} />
      <Metric label="Out" value={formatStay(summary.outMinutes)} />
      <Metric
        label={summary.estimated ? "Distance (about)" : "Distance"}
        value={summary.metres > 0 ? formatDistance(summary.metres) : "—"}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-sunken px-4 py-3">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="font-mono text-data font-semibold text-text-primary tabular-nums">{value}</p>
    </div>
  );
}
