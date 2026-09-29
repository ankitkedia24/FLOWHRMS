import "server-only";

import { getDb } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { evaluateAccess } from "@/lib/authz/flags";
import { loadExpensesPolicy } from "@/lib/expenses/access";
import { claimRef } from "@/lib/expenses/state";
import { loadTripPerson } from "./audience";
import { computeLegsLater } from "./legs";
import { claimableVehicles, mayRecordVisits, type FieldVisitsPolicy, type Vehicle } from "./policy";
import { fieldVisitsReady } from "./service";
import { dateKeyIn, monthRange, monthTravel, type MonthTravel } from "./state";
import { tripsForRecords } from "./team";

/**
 * The monthly travel allowance (FIELD-VISITS-MODULE.md §7): what a person
 * can claim for a month that has ended, and the evidence a claim carries.
 */

/** The fixed Expenses category a travel claim carries — never a receipt. */
export const TRAVEL_CATEGORY = { key: "field-travel", name: "Travel allowance" } as const;

/** Claims that still stand; a refused or withdrawn one frees the month. */
const LIVE = { notIn: ["REJECTED", "WITHDRAWN"] as Array<"REJECTED" | "WITHDRAWN"> };

export type TravelBlocker =
  | "field-visits-off"
  | "not-a-recorder"
  | "expenses-off"
  | "expenses-unpublished"
  | "no-rates";

export interface TravelContext {
  policy: FieldVisitsPolicy;
  vehicles: Vehicle[];
  /** The person's vehicle, if chosen and still paid for. */
  vehicle: Vehicle | null;
  /** Chosen, but no longer offered (retired, or its rate removed). */
  vehicleGone: boolean;
  expensesVersion: number;
  thisMonth: string;
}

/** Can this person claim travel at all, and with what? */
export async function loadTravelContext(
  session: AppSession,
): Promise<{ ok: true; context: TravelContext } | { ok: false; blocker: TravelBlocker }> {
  const ready = await fieldVisitsReady(session);
  if (!ready) return { ok: false, blocker: "field-visits-off" };
  const person = await loadTripPerson(session.tenant.id, session.membership.id);
  if (!person || !mayRecordVisits({ roleKey: session.membership.roleKey, departmentId: person.departmentId }, ready.policy)) {
    return { ok: false, blocker: "not-a-recorder" };
  }
  const entitlements = await loadEntitlements(session.tenant.id, session.user.id);
  if (!evaluateAccess({ session, entitlements, module: "EXPENSES" }).allowed) return { ok: false, blocker: "expenses-off" };
  const expenses = await loadExpensesPolicy(session.tenant.id);
  if (!expenses) return { ok: false, blocker: "expenses-unpublished" };
  const vehicles = claimableVehicles(ready.policy);
  if (vehicles.length === 0) return { ok: false, blocker: "no-rates" };

  const membership = await getDb().tenantMembership.findUnique({
    where: { id: session.membership.id },
    select: { fieldVehicleKey: true },
  });
  const key = membership?.fieldVehicleKey ?? null;
  const vehicle = key ? vehicles.find((v) => v.key === key) ?? null : null;
  return {
    ok: true,
    context: {
      policy: ready.policy,
      vehicles,
      vehicle,
      vehicleGone: key !== null && vehicle === null,
      expensesVersion: expenses.version,
      thisMonth: dateKeyIn(new Date(), session.tenant.timezone).slice(0, 7),
    },
  };
}

export interface ExistingTravelClaim {
  claimId: string;
  ref: string;
  status: string;
  claimedKm: number;
}

/** A standing travel claim for this person and month, if there is one. */
export async function existingTravelClaim(
  tenantId: string,
  membershipId: string,
  month: string,
): Promise<ExistingTravelClaim | null> {
  const row = await getDb().fieldConveyance.findFirst({
    where: { tenantId, membershipId, month, claim: { status: LIVE } },
    select: { claimedKm: true, claim: { select: { id: true, claimNumber: true, status: true } } },
  });
  return row
    ? { claimId: row.claim.id, ref: claimRef(row.claim.claimNumber), status: row.claim.status, claimedKm: Number(row.claimedKm) }
    : null;
}

/**
 * The month's travel for one person — declined trips out, undecided ones
 * counted and flagged. Asks for any road distance still missing, so the
 * figures firm up while the person looks.
 */
export async function loadMonthTravel(tenantId: string, membershipId: string, month: string): Promise<MonthTravel | null> {
  const range = monthRange(month);
  if (!range) return null;
  const records = await getDb().attendanceRecord.findMany({
    where: {
      tenantId,
      membershipId,
      workDate: { gte: new Date(`${range.first}T00:00:00.000Z`), lte: new Date(`${range.last}T00:00:00.000Z`) },
    },
    select: { id: true, workDate: true },
  });
  const trips = await tripsForRecords(tenantId, records);
  const waiting = trips.filter((t) => t.legs.some((l) => l?.status === "PENDING")).map((t) => t.id);
  if (waiting.length > 0) computeLegsLater(tenantId, waiting);
  return monthTravel(trips);
}

export interface ClaimEvidence {
  month: string;
  vehicleName: string;
  ratePerKm: number;
  recordedKm: number;
  estimatedKm: number;
  claimedKm: number;
  changeReason: string | null;
  tripsCounted: number;
  tripsAwaiting: number;
  tripsDeclined: number;
  days: Array<{ date: string; km: number; estimatedKm: number; trips: number }>;
}

/** What a travel claim was worked out from — shown beside the claim. */
export async function loadClaimEvidence(tenantId: string, claimId: string): Promise<ClaimEvidence | null> {
  const row = await getDb().fieldConveyance.findFirst({ where: { tenantId, claimId } });
  if (!row) return null;
  return {
    month: row.month,
    vehicleName: row.vehicleName,
    ratePerKm: Number(row.ratePerKm),
    recordedKm: Number(row.recordedKm),
    estimatedKm: Number(row.estimatedKm),
    claimedKm: Number(row.claimedKm),
    changeReason: row.changeReason,
    tripsCounted: row.tripsCounted,
    tripsAwaiting: row.tripsAwaiting,
    tripsDeclined: row.tripsDeclined,
    days: Array.isArray(row.days) ? (row.days as ClaimEvidence["days"]) : [],
  };
}
