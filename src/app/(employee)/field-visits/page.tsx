import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { formatLongDate } from "@/lib/attendance/policy";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TripView } from "@/components/field-visits/TripView";
import { RefreshSoon } from "@/components/field-visits/RefreshSoon";
import { routesConfigured } from "@/lib/field-visits/routes";
import { loadFieldVisitsPolicy } from "@/lib/field-visits/access";
import { loadTrips } from "@/lib/field-visits/service";
import { dateKeyIn, formatDistance, formatStay, summariseDay } from "@/lib/field-visits/state";

export const metadata: Metadata = { title: "Field visits" };

/**
 * My day (FIELD-VISITS-MODULE.md §3): every trip of a working day, as a
 * timeline, with what it adds up to. A visit left open when the day
 * closed can be given its end time here.
 */
export default async function MyFieldDayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { session, decision } = await checkAccess({ module: "FIELD_VISITS" });
  if (!decision.allowed) redirect("/unauthorized");

  const tz = session.tenant.timezone;
  const now = new Date();
  const today = dateKeyIn(now, tz);
  const asked = (await searchParams).date;
  const date = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today;
  const workDate = new Date(`${date}T00:00:00.000Z`);
  const shift = (days: number) =>
    new Date(workDate.getTime() + days * 86_400_000).toISOString().slice(0, 10);

  const offline = devFixtureOffline();
  const published = offline ? null : await loadFieldVisitsPolicy(session.tenant.id);
  const record = offline
    ? null
    : await getDb().attendanceRecord.findUnique({
        where: {
          tenantId_membershipId_workDate: {
            tenantId: session.tenant.id,
            membershipId: session.membership.id,
            workDate,
          },
        },
        select: { id: true },
      });
  const trips = record ? await loadTrips(session.tenant.id, { recordId: record.id }) : [];
  const summary = summariseDay(trips, now);
  const roadPending =
    routesConfigured() && trips.some((t) => t.legs.some((l) => l?.status === "PENDING"));
  const plural = published?.policy.placeWord.plural ?? "places";

  return (
    <div className="flex flex-col gap-4">
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">My day</h1>
        <nav aria-label="Choose a day" className="flex items-center gap-1">
          <Link
            href={`/field-visits?date=${shift(-1)}`}
            aria-label="Previous day"
            className="rounded-md p-2 text-text-secondary hover:bg-surface-sunken"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Link>
          <span className="min-w-[150px] text-center text-label text-text-primary">
            {date === today ? "Today" : formatLongDate(workDate, "UTC")}
          </span>
          {date < today ? (
            <Link
              href={`/field-visits?date=${shift(1)}`}
              aria-label="Next day"
              className="rounded-md p-2 text-text-secondary hover:bg-surface-sunken"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </Link>
          ) : (
            <span className="p-2 text-text-disabled" aria-hidden="true">
              <ChevronRight className="size-5" />
            </span>
          )}
        </nav>
      </div>

      {session.membership.roleKey === "OWNER" && (
        <p className="text-secondary text-text-secondary">
          Owners don&apos;t record field visits. Trips reach you for approval when you are
          someone&apos;s reporting manager, or when they have no manager or department head.
        </p>
      )}

      {trips.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Visits" value={String(summary.visits)} />
          <Metric label={`At ${plural}`} value={formatStay(summary.atPlaceMinutes)} />
          <Metric label="Out" value={formatStay(summary.outMinutes)} />
          <Metric
            label={summary.estimated ? "Distance (about)" : "Distance"}
            value={summary.metres > 0 ? formatDistance(summary.metres) : "—"}
          />
        </div>
      )}

      {trips.length === 0 ? (
        <Card flush>
          <EmptyState
            title={date === today ? "No trips yet today." : "No trips that day."}
            body="Tap Going out on your home screen when you leave the office. Each visit shows here."
          />
        </Card>
      ) : (
        trips.map((trip, i) => (
          <Card key={trip.id}>
            <h2 className="mb-3 font-heading text-h3 text-text-primary">
              Trip {i + 1}
            </h2>
            <TripView trip={trip} timeZone={tz} now={now} canCorrect />
          </Card>
        ))
      )}

      {summary.estimated && (
        <p className="text-caption text-text-secondary">
          Distances marked “about” are straight lines between the spots where you tapped, until the
          road distance is worked out.
        </p>
      )}
      {roadPending && <RefreshSoon />}
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
