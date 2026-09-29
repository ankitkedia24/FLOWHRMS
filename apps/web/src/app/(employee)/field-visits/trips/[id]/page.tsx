import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { formatLongDate } from "@/lib/attendance/policy";
import { Card } from "@/components/ui/Card";
import { TripDecision } from "@/components/field-visits/TripDecision";
import { TripView } from "@/components/field-visits/TripView";
import { RefreshSoon } from "@/components/field-visits/RefreshSoon";
import { routesConfigured } from "@/lib/field-visits/routes";
import { loadTripPerson } from "@/lib/field-visits/audience";
import { loadTrips } from "@/lib/field-visits/service";
import { firstName, mayDecideTrip, mayViewTrip } from "@/lib/field-visits/state";

export const metadata: Metadata = { title: "Field trip" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One trip, where the reporting manager's tile lands (FIELD-VISITS-MODULE.md
 * §4): what happened so far, and Approve / Decline. In the employee area on
 * purpose — a reporting manager may have no admin access at all.
 */
export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, decision } = await checkAccess({ module: "FIELD_VISITS" });
  if (!decision.allowed) redirect("/unauthorized");
  const { id } = await params;
  if (!UUID.test(id) || devFixtureOffline()) notFound();

  const [trip] = await loadTrips(session.tenant.id, { tripId: id });
  if (!trip) notFound();
  const person = await loadTripPerson(session.tenant.id, trip.membershipId);
  if (!person) notFound();

  const viewer = {
    viewerMembershipId: session.membership.id,
    viewerSeesEveryone: session.permissions.has("fieldvisits.view"),
    person,
  };
  if (!mayViewTrip(viewer)) redirect("/unauthorized");
  const own = person.membershipId === session.membership.id;
  const canDecide = trip.approval === "PENDING" && mayDecideTrip(viewer);
  const tz = session.tenant.timezone;

  return (
    <div className="flex flex-col gap-4">
      <div className="mt-2">
        <Link href={own ? "/field-visits" : "/home"} className="text-label text-brand-primary underline-offset-2 hover:underline">
          ← {own ? "My day" : "Home"}
        </Link>
        <h1 className="mt-2 font-heading text-h1 text-text-primary">
          {own ? "Your trip" : `${trip.personName}'s trip`}
        </h1>
        <p className="text-secondary text-text-secondary">{formatLongDate(trip.startedAt, tz)}</p>
      </div>

      <Card>
        <TripView trip={trip} timeZone={tz} now={new Date()} canCorrect={own} />
      </Card>
      {routesConfigured() && trip.legs.some((l) => l?.status === "PENDING") && <RefreshSoon />}

      {canDecide && (
        <Card>
          <p className="mb-3 text-secondary text-text-secondary">
            {firstName(trip.personName)} didn&apos;t wait for this — the trip started when they tapped.
            Approving counts it towards travel allowance; declining leaves it out, with your reason.
          </p>
          <TripDecision tripId={trip.id} firstName={firstName(trip.personName)} />
        </Card>
      )}
    </div>
  );
}
