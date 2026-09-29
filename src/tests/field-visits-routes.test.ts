import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  estimatedStart,
  legDue,
  MAX_ROUTE_ATTEMPTS,
  parseRouteDuration,
  routeRetryDelayMs,
  summariseDay,
  tripTimeline,
  type DayTrip,
} from "@/lib/field-visits/state";
import { roadRoute, routesConfigured } from "@/lib/field-visits/routes";

const at = (hhmm: string) => new Date(`2026-09-29T${hhmm}:00+05:30`);
const A = { lat: 20.2961, lng: 85.8245 };
const B = { lat: 20.34, lng: 85.815 };

describe("road distance rules", () => {
  it("reads the Routes API's durations", () => {
    expect(parseRouteDuration("1080s")).toBe(1080);
    expect(parseRouteDuration("12.6s")).toBe(13);
    expect(parseRouteDuration("soon")).toBeNull();
    expect(parseRouteDuration(42)).toBeNull();
  });

  it("backs off 1, 2, 4 … minutes, never more than an hour", () => {
    expect(routeRetryDelayMs(1)).toBe(60_000);
    expect(routeRetryDelayMs(3)).toBe(4 * 60_000);
    expect(routeRetryDelayMs(20)).toBe(60 * 60_000);
  });

  it("asks again only when due, and not after the last try", () => {
    const now = at("12:00");
    expect(legDue({ status: "PENDING", attempts: 0, lastTriedAt: null }, now)).toBe(true);
    expect(legDue({ status: "PENDING", attempts: 2, lastTriedAt: at("11:59") }, now)).toBe(false);
    expect(legDue({ status: "PENDING", attempts: 2, lastTriedAt: at("11:57") }, now)).toBe(true);
    expect(legDue({ status: "PENDING", attempts: MAX_ROUTE_ATTEMPTS, lastTriedAt: at("08:00") }, now)).toBe(false);
    expect(legDue({ status: "DONE", attempts: 1, lastTriedAt: null }, now)).toBe(false);
  });

  it("puts a skipped Going out before the first arrival by the road time, never before check-in", () => {
    expect(estimatedStart(at("11:05"), 18 * 60, at("09:30"))).toEqual(at("10:47"));
    expect(estimatedStart(at("09:40"), 30 * 60, at("09:30"))).toEqual(at("09:30"));
  });

  it("labels road, short and given-up legs, and counts only unfinished ones as estimates", () => {
    const trip: DayTrip = {
      id: "t",
      startedAt: at("10:40"),
      startEstimated: false,
      endedAt: at("12:00"),
      endKind: "BACK_AT_OFFICE",
      approval: "APPROVED",
      visits: [
        { placeName: "A", purposeName: null, arrivedAt: at("11:00"), leftAt: at("11:10"), endKind: "ENDED", isFar: false, hasPhoto: false, note: null },
        { placeName: "B", purposeName: null, arrivedAt: at("11:20"), leftAt: at("11:30"), endKind: "ENDED", isFar: false, hasPhoto: false, note: null },
      ],
      legs: [
        { meters: 6200, durationSeconds: 1080, method: "ROAD", status: "DONE" },
        { meters: 30, method: "STRAIGHT", status: "DONE" },
        { meters: 7400, method: "STRAIGHT", status: "FAILED" },
      ],
    };
    const legs = tripTimeline(trip, at("13:00")).filter((e) => e.kind === "leg").map((e) => e.label);
    expect(legs).toEqual([
      "6.2 km by road · about 18 min",
      "30 m (too short to need a route)",
      "About 7.4 km (straight line — the road distance couldn't be worked out)",
    ]);
    expect(summariseDay([trip], at("13:00")).estimated).toBe(true);
    expect(summariseDay([{ ...trip, legs: trip.legs.slice(0, 2) }], at("13:00")).estimated).toBe(false);
  });
});

describe("asking Google for the road", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "test-key-not-real");
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const reply = (status: number, body: unknown) =>
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));

  it("sends only the fields used, with the key in a header", async () => {
    reply(200, { routes: [{ distanceMeters: 6243.4, duration: "1080s", polyline: { encodedPolyline: "abc" } }] });
    expect(await roadRoute(A, B)).toEqual({ ok: true, meters: 6243, seconds: 1080, polyline: "abc" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://routes.googleapis.com/directions/v2:computeRoutes");
    expect(init.headers["X-Goog-Api-Key"]).toBe("test-key-not-real");
    expect(init.headers["X-Goog-FieldMask"]).toBe("routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE" });
    expect(body.origin.location.latLng).toEqual({ latitude: A.lat, longitude: A.lng });
  });

  it("gives up on a bad request or no road, and tries again after quota or outages", async () => {
    reply(400, { error: {} });
    expect(await roadRoute(A, B)).toMatchObject({ ok: false, permanent: true });
    reply(200, { routes: [] });
    expect(await roadRoute(A, B)).toMatchObject({ ok: false, permanent: true });
    reply(429, {});
    expect(await roadRoute(A, B)).toMatchObject({ ok: false, permanent: false });
    reply(503, {});
    expect(await roadRoute(A, B)).toMatchObject({ ok: false, permanent: false });
    fetchMock.mockRejectedValueOnce(new TypeError("network"));
    expect(await roadRoute(A, B)).toMatchObject({ ok: false, permanent: false });
  });

  it("never mentions the key when something goes wrong", async () => {
    reply(403, { error: { message: "API key not valid" } });
    const result = await roadRoute(A, B);
    expect(JSON.stringify(result)).not.toContain("test-key-not-real");
  });

  it("does nothing without a key", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "");
    expect(routesConfigured()).toBe(false);
    expect(await roadRoute(A, B)).toMatchObject({ ok: false, permanent: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
