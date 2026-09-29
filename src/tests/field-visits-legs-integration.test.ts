/**
 * Field visits, Phase 3 — road distances against the real database, with
 * the Routes API faked (no key, no Google call, no cost).
 *
 * Works in the placeholder company (slug demo-co) on a day long past, and
 * removes everything it made. Skips itself without a database.
 *
 * What this proves that the pure tests cannot: a waiting leg becomes a
 * road distance; a stretch too short to route is settled without a call;
 * an outage leaves the leg waiting and a second pass inside the back-off
 * asks nobody; a request Google refuses gives up; and a trip whose Going
 * out was skipped gets its start moved back by the road time.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const HAS_DB = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));

const OFFICE = { lat: 20.2961, lng: 85.8245 };
const ROAD = { lat: 20.34, lng: 85.815 }; // Google answers 6.2 km, 18 min
const DOWN = { lat: 20.31, lng: 85.86 }; // Google is down
const REFUSED = { lat: 20.25, lng: 85.8 }; // Google refuses the request
const NEXT_DOOR = { lat: 20.29612, lng: 85.82452 }; // a few metres

describe.skipIf(!HAS_DB)("road distances (database)", () => {
  let getDb: typeof import("@/lib/db").getDb;
  let computeLegs: typeof import("@/lib/field-visits/legs").computeLegs;
  let tenantId: string;
  let recordId: string;
  let tripId: string;
  const legIds: Record<string, string> = {};
  const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
    const dest = JSON.parse(init.body).destination.location.latLng;
    if (dest.latitude === ROAD.lat) {
      return new Response(
        JSON.stringify({ routes: [{ distanceMeters: 6200, duration: "1080s", polyline: { encodedPolyline: "_p~iF~ps|U" } }] }),
        { status: 200 },
      );
    }
    if (dest.latitude === REFUSED.lat) return new Response("{}", { status: 400 });
    return new Response("{}", { status: 503 });
  });

  beforeAll(async () => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "test-key-not-real");
    ({ getDb } = await import("@/lib/db"));
    ({ computeLegs } = await import("@/lib/field-visits/legs"));
    const db = getDb();

    const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-co" } });
    tenantId = tenant.id;
    const member = await db.tenantMembership.findFirstOrThrow({
      where: { tenantId, status: "ACTIVE", role: { key: "EMPLOYEE" } },
    });
    const checkInAt = new Date("2020-01-06T03:30:00Z"); // 9:00 IST
    const record = await db.attendanceRecord.create({
      data: { tenantId, membershipId: member.id, workDate: new Date("2020-01-06T00:00:00Z"), checkInAt },
    });
    recordId = record.id;

    // Going out was skipped: the trip starts at the first arrival, 11:05 IST.
    const arrivedAt = new Date("2020-01-06T05:35:00Z");
    const trip = await db.fieldTrip.create({
      data: {
        tenantId,
        membershipId: member.id,
        recordId,
        startedAt: arrivedAt,
        startLat: OFFICE.lat,
        startLng: OFFICE.lng,
        startEstimated: true,
        policyVersion: 1,
      },
    });
    tripId = trip.id;
    await db.fieldVisit.create({
      data: { tenantId, tripId, membershipId: member.id, sequence: 1, placeName: "Test place", arrivedAt },
    });

    const leg = (sequence: number, to: { lat: number; lng: number }) =>
      db.fieldLeg.create({
        data: {
          tenantId,
          tripId,
          sequence,
          fromLat: OFFICE.lat,
          fromLng: OFFICE.lng,
          fromAt: arrivedAt,
          toLat: to.lat,
          toLng: to.lng,
          toAt: arrivedAt,
          meters: 1,
          method: "STRAIGHT",
        },
      });
    legIds.road = (await leg(1, ROAD)).id;
    legIds.down = (await leg(2, DOWN)).id;
    legIds.refused = (await leg(3, REFUSED)).id;
    legIds.short = (await leg(4, NEXT_DOOR)).id;
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    if (!tripId) return;
    const db = getDb();
    await db.fieldLeg.deleteMany({ where: { tripId } });
    await db.fieldVisit.deleteMany({ where: { tripId } });
    await db.fieldTrip.deleteMany({ where: { id: tripId } });
    await db.attendanceRecord.deleteMany({ where: { id: recordId } });
  });

  it("fills in what it can, and leaves the rest honestly marked", async () => {
    await computeLegs({ tenantId, tripIds: [tripId] });
    const db = getDb();
    const legs = await db.fieldLeg.findMany({ where: { tripId } });
    const byId = (id: string) => legs.find((l) => l.id === id)!;

    expect(byId(legIds.road)).toMatchObject({ status: "DONE", method: "ROAD", meters: 6200, durationSeconds: 1080, attempts: 1 });
    expect(byId(legIds.road).polyline).toBe("_p~iF~ps|U");
    expect(byId(legIds.short)).toMatchObject({ status: "DONE", method: "STRAIGHT", attempts: 0 });
    expect(byId(legIds.down)).toMatchObject({ status: "PENDING", attempts: 1 });
    expect(byId(legIds.down).lastTriedAt).not.toBeNull();
    expect(byId(legIds.refused)).toMatchObject({ status: "FAILED", attempts: 1 });
    // Three legs needed Google; the one next door did not.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not ask again inside the back-off", async () => {
    fetchMock.mockClear();
    await computeLegs({ tenantId, tripIds: [tripId] });
    expect(fetchMock).not.toHaveBeenCalled();
    const down = await getDb().fieldLeg.findUniqueOrThrow({ where: { id: legIds.down } });
    expect(down.attempts).toBe(1);
  });

  it("moves a skipped Going out back by the road time", async () => {
    const trip = await getDb().fieldTrip.findUniqueOrThrow({ where: { id: tripId } });
    // 11:05 IST arrival − 18 min = 10:47 IST.
    expect(trip.startedAt.toISOString()).toBe("2020-01-06T05:17:00.000Z");
    const first = await getDb().fieldLeg.findUniqueOrThrow({ where: { id: legIds.road } });
    expect(first.fromAt.toISOString()).toBe("2020-01-06T05:17:00.000Z");
  });
});
