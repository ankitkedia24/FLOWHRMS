import "server-only";

import { parseRouteDuration, type Spot } from "./state";

/**
 * Road distance between two tapped spots, from the Google Routes API
 * (FIELD-VISITS-MODULE.md §7). Server only: the key is
 * GOOGLE_MAPS_SERVER_KEY, restricted to the Routes API, entered by the
 * owner in .env.local and Hostinger and never sent to a browser.
 *
 * Asks for the cheapest kind of route — driving, without live traffic —
 * and only the three fields used, which is what keeps it on the basic
 * price tier. The key never appears in a log or an error.
 */

const ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
const FIELDS = "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline";
const TIMEOUT_MS = 8_000;

export type RoadRoute =
  | { ok: true; meters: number; seconds: number | null; polyline: string | null }
  /** `permanent`: asking again won't help (no road between the spots, a bad request). */
  | { ok: false; permanent: boolean; error: string };

export function routesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_SERVER_KEY?.trim());
}

const point = (s: Spot) => ({ location: { latLng: { latitude: s.lat, longitude: s.lng } } });

export async function roadRoute(from: Spot, to: Spot): Promise<RoadRoute> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
  if (!key) return { ok: false, permanent: false, error: "no key" };

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELDS,
      },
      body: JSON.stringify({
        origin: point(from),
        destination: point(to),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        units: "METRIC",
        regionCode: "IN",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return { ok: false, permanent: false, error: "Routes API unreachable" };
  }

  if (!response.ok) {
    // 400: the request itself is wrong; asking again sends the same thing.
    // 403 (key not allowed yet), 429 (quota) and 5xx may clear up.
    return {
      ok: false,
      permanent: response.status === 400 || response.status === 404,
      error: `Routes API ${response.status}`,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, permanent: false, error: "Routes API sent something unreadable" };
  }
  const route = (body as { routes?: Array<Record<string, unknown>> })?.routes?.[0];
  const meters = route?.distanceMeters;
  if (!route || typeof meters !== "number" || !Number.isFinite(meters)) {
    // No route between the two spots (an island, a closed area): the
    // straight line stays as the estimate.
    return { ok: false, permanent: true, error: "No road route between the spots" };
  }
  const polyline = (route.polyline as { encodedPolyline?: unknown } | undefined)?.encodedPolyline;
  return {
    ok: true,
    meters: Math.round(meters),
    seconds: parseRouteDuration(route.duration),
    polyline: typeof polyline === "string" && polyline.length <= 20_000 ? polyline : null,
  };
}
