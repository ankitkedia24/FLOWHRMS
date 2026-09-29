import { Building2, Footprints, MapPin, Route, TriangleAlert } from "lucide-react";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatClockTime } from "@/lib/attendance/policy";
import { STATUS, type Status } from "@/lib/status";
import { tripTimeline } from "@/lib/field-visits/state";
import type { TripDetail } from "@/lib/field-visits/service";
import { VisitCorrection } from "./VisitCorrection";
import { TripMap } from "./TripMap";

/**
 * One trip as a timeline (FIELD-VISITS-MODULE.md §3, §4): going out, the
 * road between stops, each visit with its note and photo, and the way
 * back — with the manager's decision on top. Server-rendered.
 */

const APPROVAL: Record<TripDetail["approval"], Status | null> = {
  NOT_NEEDED: null,
  PENDING: { key: "trip-pending", label: "Waiting for approval", tone: "neutral" },
  APPROVED: STATUS.approved,
  DECLINED: { key: "trip-declined", label: "Declined", tone: "error" },
};

export function TripView({
  trip,
  timeZone,
  now,
  canCorrect = false,
}: {
  trip: TripDetail;
  timeZone: string;
  now: Date;
  /** The person's own view: a visit left open can be given its end time. */
  canCorrect?: boolean;
}) {
  const time = (d: Date) => formatClockTime(d, timeZone);
  const entries = tripTimeline(trip, now);
  const approval = APPROVAL[trip.approval];

  return (
    <div className="flex flex-col gap-3">
      {approval && (
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={approval} size="sm" />
          {trip.approvalDecidedByName && trip.approvalDecidedAt && (
            <span className="text-caption text-text-secondary">
              by {trip.approvalDecidedByName}, {time(trip.approvalDecidedAt)}
            </span>
          )}
        </div>
      )}
      {trip.approval === "DECLINED" && trip.approvalReason && (
        <p className="text-secondary text-text-primary">
          “{trip.approvalReason}” — not counted towards travel allowance.
        </p>
      )}

      {trip.map && <TripMap data={trip.map} />}

      <ol className="flex flex-col gap-2">
        {entries.map((entry, i) => {
          if (entry.kind === "leg") {
            return (
              <li key={i} className="ml-[72px] flex items-center gap-2 text-caption text-text-secondary">
                <Route aria-hidden="true" className="size-3.5 shrink-0" />
                {entry.label}
              </li>
            );
          }
          if (entry.kind === "gap") {
            return (
              <li key={i} className="flex items-start gap-2 text-caption text-status-warning-fg">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {entry.label}
              </li>
            );
          }
          if (entry.kind === "visit") {
            const visit = trip.visits[entry.index];
            return (
              <li key={i} className="grid grid-cols-[64px_1fr] gap-2">
                <span className="pt-0.5 text-caption text-text-secondary tabular-nums">{time(entry.at)}</span>
                <div className="min-w-0 rounded-md border border-border-subtle p-3">
                  <p className="inline-flex items-center gap-2 text-body font-semibold text-text-primary">
                    <MapPin aria-hidden="true" className="size-4 shrink-0 text-status-success-fg" />
                    {entry.label}
                  </p>
                  <p className="text-caption text-text-secondary">{entry.detail}</p>
                  {entry.flag && (
                    <p className="mt-1 inline-flex rounded-chip bg-[color:var(--fh-color-status-warning-bg)] px-2 py-0.5 text-caption text-status-warning-fg">
                      {entry.flag}
                    </p>
                  )}
                  {visit?.note && <p className="mt-2 whitespace-pre-wrap text-secondary text-text-primary">{visit.note}</p>}
                  {visit?.photoUrl && (
                    <a href={visit.photoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link */}
                      <img src={visit.photoUrl} alt={`Photo at ${visit.placeName}`} className="size-24 rounded-md object-cover" />
                    </a>
                  )}
                  {canCorrect && visit?.endKind === "NOT_RECORDED" && (
                    <VisitCorrection visitId={visit.id} placeName={visit.placeName} />
                  )}
                </div>
              </li>
            );
          }
          const Icon = entry.kind === "out" ? Footprints : Building2;
          return (
            <li key={i} className="grid grid-cols-[64px_1fr] gap-2">
              <span className="pt-0.5 text-caption text-text-secondary tabular-nums">{time(entry.at)}</span>
              <div>
                <p className="inline-flex items-center gap-2 text-body text-text-primary">
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-brand-primary" />
                  {entry.label}
                </p>
                {entry.kind === "out" && entry.detail && (
                  <p className="text-caption text-text-secondary">{entry.detail}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
