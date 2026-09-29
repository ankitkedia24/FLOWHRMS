import "server-only";

import { after } from "next/server";
import { getDb } from "@/lib/db";
import { roadRoute, routesConfigured } from "./routes";
import {
  estimatedStart,
  legDue,
  MAX_ROUTE_ATTEMPTS,
  SHORT_LEG_M,
  straightMetres,
} from "./state";

/**
 * Fills in road distances (FIELD-VISITS-MODULE.md §7).
 *
 * A tap records a straight-line estimate at once and never waits for
 * Google. This runs afterwards — after the tap's response, and again when
 * a day or trip is looked at — asking for each waiting leg's road distance,
 * backing off while the Routes API is unreachable, and giving up after a
 * few tries, when the estimate stays, marked as one.
 */

/** Route lines are kept this long, then dropped: the distance stays. */
const POLYLINE_DAYS = 30;

export async function computeLegs(input: { tenantId: string; tripIds?: string[]; limit?: number }): Promise<void> {
  if (!routesConfigured()) return;
  const db = getDb();
  const now = new Date();

  const waiting = await db.fieldLeg.findMany({
    where: {
      tenantId: input.tenantId,
      status: "PENDING",
      attempts: { lt: MAX_ROUTE_ATTEMPTS },
      ...(input.tripIds ? { tripId: { in: input.tripIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: input.limit ?? 25,
  });

  for (const leg of waiting) {
    if (!legDue(leg, now)) continue;
    const from = { lat: leg.fromLat, lng: leg.fromLng };
    const to = { lat: leg.toLat, lng: leg.toLng };

    // Across the road, or leaving from where you arrived: no route needed.
    const straight = straightMetres(from, to);
    if (straight < SHORT_LEG_M) {
      await db.fieldLeg.updateMany({
        where: { id: leg.id, status: "PENDING" },
        data: { status: "DONE", method: "STRAIGHT", meters: straight, computedAt: now },
      });
      continue;
    }

    // Claim the attempt first, so two page loads never pay for one leg twice.
    const claimed = await db.fieldLeg.updateMany({
      where: { id: leg.id, status: "PENDING", attempts: leg.attempts },
      data: { attempts: leg.attempts + 1, lastTriedAt: now },
    });
    if (claimed.count === 0) continue;

    const route = await roadRoute(from, to);
    if (route.ok) {
      await db.fieldLeg.update({
        where: { id: leg.id },
        data: {
          meters: route.meters,
          durationSeconds: route.seconds,
          polyline: route.polyline,
          method: "ROAD",
          status: "DONE",
          computedAt: new Date(),
        },
      });
      if (leg.sequence === 1 && route.seconds !== null) await refineEstimatedStart(leg.tripId, route.seconds);
    } else if (route.permanent || leg.attempts + 1 >= MAX_ROUTE_ATTEMPTS) {
      await db.fieldLeg.update({ where: { id: leg.id }, data: { status: "FAILED" } });
      console.warn("[field-visits:route-gave-up]", leg.id, route.error);
    } else {
      console.warn("[field-visits:route-retry-later]", leg.id, route.error);
    }
  }

  // Google's terms limit how long route content may be kept: the line for
  // the map goes after 30 days; the distance, a business record, stays.
  await db.fieldLeg.updateMany({
    where: {
      tenantId: input.tenantId,
      polyline: { not: null },
      computedAt: { lt: new Date(now.getTime() - POLYLINE_DAYS * 86_400_000) },
    },
    data: { polyline: null },
  });
}

/**
 * A trip whose Going out was skipped starts at the first arrival until the
 * road time to it is known; then it starts that long before, never before
 * the check-in.
 */
async function refineEstimatedStart(tripId: string, seconds: number): Promise<void> {
  const db = getDb();
  const trip = await db.fieldTrip.findUnique({
    where: { id: tripId },
    select: {
      startEstimated: true,
      record: { select: { checkInAt: true } },
      visits: { where: { sequence: 1 }, select: { arrivedAt: true } },
    },
  });
  const first = trip?.visits[0];
  if (!trip?.startEstimated || !first) return;
  const start = estimatedStart(first.arrivedAt, seconds, trip.record.checkInAt);
  await db.$transaction([
    db.fieldTrip.update({ where: { id: tripId }, data: { startedAt: start } }),
    db.fieldLeg.updateMany({ where: { tripId, sequence: 1 }, data: { fromAt: start } }),
  ]);
}

/**
 * Ask for road distances once the response has gone. Never throws into
 * the page or tap that scheduled it.
 */
export function computeLegsLater(tenantId: string, tripIds?: string[]): void {
  if (!routesConfigured()) return;
  after(async () => {
    try {
      await computeLegs({ tenantId, tripIds });
    } catch (error) {
      console.error("[field-visits:compute-legs-failed]", error);
    }
  });
}
