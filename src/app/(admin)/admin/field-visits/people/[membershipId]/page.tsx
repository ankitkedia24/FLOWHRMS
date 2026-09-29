import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { getDb } from "@/lib/db";
import { formatLongDate } from "@/lib/attendance/policy";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DayMetrics } from "@/components/field-visits/DayMetrics";
import { RefreshSoon } from "@/components/field-visits/RefreshSoon";
import { TripDecision } from "@/components/field-visits/TripDecision";
import { TripView } from "@/components/field-visits/TripView";
import { loadTripPerson } from "@/lib/field-visits/audience";
import { routesConfigured } from "@/lib/field-visits/routes";
import { loadTrips } from "@/lib/field-visits/service";
import { dateKeyIn, firstName, mayDecideTrip, summariseDay } from "@/lib/field-visits/state";
import { loadTeamContext, teamMember } from "@/lib/field-visits/team";

export const metadata: Metadata = { title: "Field visits" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One person's day (FIELD-VISITS-MODULE.md §5): every trip on the map and
 * as a timeline, with Approve / Decline for trips still waiting — if this
 * viewer may decide them.
 */
export default async function PersonFieldDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ membershipId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { session, decision } = await checkAccess({ module: "FIELD_VISITS", permission: "admin.access" });
  if (!decision.allowed) redirect("/unauthorized");
  if (devFixtureOffline()) redirect("/admin");
  const { membershipId } = await params;
  if (!UUID.test(membershipId)) notFound();

  const context = await loadTeamContext(session);
  if (!context.ok) redirect("/admin/field-visits");
  const member = await teamMember(session, context.scope, membershipId);
  if (!member) redirect("/unauthorized");
  const person = await loadTripPerson(session.tenant.id, membershipId);
  if (!person) notFound();

  const tz = session.tenant.timezone;
  const now = new Date();
  const today = dateKeyIn(now, tz);
  const asked = (await searchParams).date;
  const date = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today;
  const workDate = new Date(`${date}T00:00:00.000Z`);
  const shift = (days: number) => new Date(workDate.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  const base = `/admin/field-visits/people/${membershipId}`;

  const record = await getDb().attendanceRecord.findUnique({
    where: { tenantId_membershipId_workDate: { tenantId: session.tenant.id, membershipId, workDate } },
    select: { id: true },
  });
  const trips = record ? await loadTrips(session.tenant.id, { recordId: record.id }) : [];
  const summary = summariseDay(trips, now);
  const canDecide = mayDecideTrip({
    viewerMembershipId: session.membership.id,
    viewerSeesEveryone: session.permissions.has("fieldvisits.view"),
    person,
  });
  const roadPending = routesConfigured() && trips.some((t) => t.legs.some((l) => l?.status === "PENDING"));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/admin/field-visits" className="text-label text-brand-primary underline-offset-2 hover:underline">
          ← Field visits
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-h1 text-text-primary">{member.name}</h1>
            <p className="text-secondary text-text-secondary">
              {[member.designation, member.departmentName].filter(Boolean).join(" · ") || "Field visits"}
            </p>
          </div>
          <nav aria-label="Choose a day" className="flex items-center gap-1">
            <Link href={`${base}?date=${shift(-1)}`} aria-label="Previous day" className="rounded-md p-2 text-text-secondary hover:bg-surface-sunken">
              <ChevronLeft aria-hidden="true" className="size-5" />
            </Link>
            <span className="min-w-[150px] text-center text-label text-text-primary">
              {date === today ? "Today" : formatLongDate(workDate, "UTC")}
            </span>
            {date < today ? (
              <Link href={`${base}?date=${shift(1)}`} aria-label="Next day" className="rounded-md p-2 text-text-secondary hover:bg-surface-sunken">
                <ChevronRight aria-hidden="true" className="size-5" />
              </Link>
            ) : (
              <span className="p-2 text-text-disabled" aria-hidden="true">
                <ChevronRight className="size-5" />
              </span>
            )}
          </nav>
        </div>
      </div>

      {trips.length > 0 && <DayMetrics summary={summary} placesWord={context.policy.placeWord.plural} />}

      {trips.length === 0 ? (
        <Card flush>
          <EmptyState
            title={date === today ? "No trips yet today." : "No trips that day."}
            body={`${firstName(member.name)}'s trips show here once they tap Going out or Reached.`}
          />
        </Card>
      ) : (
        trips.map((trip, i) => (
          <Card key={trip.id}>
            <h2 className="mb-3 font-heading text-h3 text-text-primary">Trip {i + 1}</h2>
            <TripView trip={trip} timeZone={tz} now={now} />
            {canDecide && trip.approval === "PENDING" && (
              <div className="mt-4 border-t border-border-subtle pt-4">
                <TripDecision tripId={trip.id} firstName={firstName(member.name)} />
              </div>
            )}
          </Card>
        ))
      )}

      {roadPending && <RefreshSoon />}
    </div>
  );
}
