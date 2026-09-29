import "server-only";

import type { AppSession } from "@/lib/auth/types";
import { raiseActionRequest } from "@/lib/actions/service";
import { notify } from "@/lib/notifications";
import { tripAudience, type TripPerson } from "./audience";
import { tripTileText } from "./state";

/**
 * What the reporting manager hears (FIELD-VISITS-MODULE.md §4): an
 * approval tile when someone goes out, information notices for the other
 * taps. Neither ever fails the tap that caused it — the trip is recorded
 * whether or not the nudge could be sent.
 */

export const TRIP_SUBJECT = "field_trip";

export function tripHref(tripId: string): string {
  return `/field-visits/trips/${tripId}`;
}

export async function askForTripApproval(
  session: AppSession,
  person: TripPerson,
  trip: { id: string; startedAt: Date },
  skipped: { placeName: string } | null,
): Promise<void> {
  try {
    const recipients = await tripAudience(session.tenant.id, person);
    const { title, body } = tripTileText({
      name: person.displayName,
      at: trip.startedAt,
      timeZone: session.tenant.timezone,
      skippedGoingOut: skipped !== null,
      placeName: skipped?.placeName,
    });
    await raiseActionRequest({
      tenantId: session.tenant.id,
      kind: "FIELD_TRIP",
      subjectType: TRIP_SUBJECT,
      subjectId: trip.id,
      aboutMembershipId: person.membershipId,
      title,
      body,
      href: tripHref(trip.id),
      actorUserId: session.user.id,
      recipients,
    });
  } catch (error) {
    console.error("[field-visits:approval-nudge-failed]", trip.id, error);
  }
}

export async function informManager(
  session: AppSession,
  person: TripPerson,
  tripId: string,
  text: { title: string; body: string },
): Promise<void> {
  try {
    const recipients = await tripAudience(session.tenant.id, person);
    await notify.fieldVisit(
      session.tenant.id,
      recipients.map((r) => r.userId),
      text.title,
      text.body,
      tripHref(tripId),
    );
  } catch (error) {
    console.error("[field-visits:info-nudge-failed]", tripId, error);
  }
}
