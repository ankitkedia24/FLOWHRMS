"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { raiseActionRequest } from "@/lib/actions/service";
import { loadExpensesPolicy, todayIn } from "@/lib/expenses/access";
import { formatAmount } from "@/lib/expenses/format";
import { claimRef, computeFlags, isValidMoney } from "@/lib/expenses/state";
import { transitionClaim } from "@/lib/expenses/transition";
import { loadFieldVisitsPolicy } from "./access";
import { loadMonthTravel, loadTravelContext, TRAVEL_CATEGORY, type TravelBlocker } from "./conveyance";
import { claimableVehicles } from "./policy";
import { checkClaimedKm, claimableMonths, monthName, monthRange, travelAmount } from "./state";

/**
 * The monthly travel allowance (FIELD-VISITS-MODULE.md §7).
 *
 * A travel claim IS an expense claim — numbered, submitted, approved and
 * settled through the Expenses module exactly like any other, in the fixed
 * category "Travel allowance". What this adds: the kilometres come from
 * the month's trips (declined ones left out), a different figure needs a
 * reason, and the evidence is fixed beside the claim at submission.
 */

export type ActionResult =
  | { ok: true; message: string; detail?: string; claimId?: string }
  | { ok: false; error: string };

type Tx = Prisma.TransactionClient;

const BLOCKED: Record<TravelBlocker, string> = {
  "field-visits-off": "Field visits aren't switched on for your company.",
  "not-a-recorder": "Your company hasn't asked you to record field visits.",
  "expenses-off": "Expenses isn't switched on for your company, so travel can't be claimed yet.",
  "expenses-unpublished": "Your company hasn't published its expense rules yet. Ask your admin.",
  "no-rates": "Your company hasn't set a travel rate for any vehicle yet. Ask your admin.",
};

function refresh(claimId?: string) {
  revalidatePath("/field-visits");
  revalidatePath("/field-visits/claim");
  revalidatePath("/expenses");
  revalidatePath("/admin/expenses");
  if (claimId) {
    revalidatePath(`/expenses/${claimId}`);
    revalidatePath(`/admin/expenses/${claimId}`);
  }
}

// ------------------------------------------------------------ vehicle

const vehicleSchema = z.object({ vehicleKey: z.string().min(1).max(40) });

/** The person's own choice — once. After that, an admin changes it. */
export async function chooseVehicleAction(input: z.input<typeof vehicleSchema>): Promise<ActionResult> {
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a vehicle." };
  const { session, decision } = await checkAccess({ module: "FIELD_VISITS" });
  if (!decision.allowed) return { ok: false, error: decision.message ?? BLOCKED["field-visits-off"] };
  const loaded = await loadTravelContext(session);
  if (!loaded.ok) return { ok: false, error: BLOCKED[loaded.blocker] };
  const { context } = loaded;
  if (context.vehicle) {
    return { ok: false, error: `Your vehicle is ${context.vehicle.name}. Ask your admin to change it.` };
  }
  const vehicle = context.vehicles.find((v) => v.key === parsed.data.vehicleKey);
  if (!vehicle) return { ok: false, error: "Choose one of the vehicles your company pays for." };

  await getDb().tenantMembership.update({
    where: { id: session.membership.id },
    data: { fieldVehicleKey: vehicle.key },
  });
  await recordAuditEvent(session, {
    action: "field_visits.vehicle_chosen",
    entityType: "tenant_membership",
    entityId: session.membership.id,
    after: { vehicle: vehicle.name },
  });
  refresh();
  return { ok: true, message: `Your vehicle is ${vehicle.name}.`, detail: "Only an admin can change it from now on." };
}

const personVehicleSchema = z.object({ membershipId: z.string().uuid(), vehicleKey: z.string().min(1).max(40) });

/** An admin corrects someone's vehicle (they changed bikes, picked wrongly). */
export async function setPersonVehicleAction(input: z.input<typeof personVehicleSchema>): Promise<ActionResult> {
  const parsed = personVehicleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a vehicle." };
  const { session, decision } = await checkAccess({ module: "FIELD_VISITS", permission: "fieldvisits.view" });
  if (!decision.allowed) return { ok: false, error: decision.message ?? "Only people who see everyone's field visits can change this." };
  const published = await loadFieldVisitsPolicy(session.tenant.id);
  const vehicle = published ? claimableVehicles(published.policy).find((v) => v.key === parsed.data.vehicleKey) : null;
  if (!vehicle) return { ok: false, error: "Choose one of the vehicles your company pays for." };

  const db = getDb();
  const member = await db.tenantMembership.findFirst({
    where: { id: parsed.data.membershipId, tenantId: session.tenant.id },
    select: { id: true, fieldVehicleKey: true, user: { select: { displayName: true } } },
  });
  if (!member) return { ok: false, error: "That person is no longer in your company." };
  await db.tenantMembership.update({ where: { id: member.id }, data: { fieldVehicleKey: vehicle.key } });
  await recordAuditEvent(session, {
    action: "field_visits.vehicle_changed",
    entityType: "tenant_membership",
    entityId: member.id,
    before: { vehicle: member.fieldVehicleKey },
    after: { vehicle: vehicle.key },
  });
  revalidatePath(`/admin/field-visits/people/${member.id}`);
  return {
    ok: true,
    message: `${member.user.displayName}'s vehicle is now ${vehicle.name}.`,
    detail: "Claims already made keep the vehicle and rate they were made with.",
  };
}

// ------------------------------------------------------------ claim

const claimSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  claimedKm: z.number().finite(),
  reason: z.string().trim().max(300).optional(),
});

export async function claimTravelAction(input: z.input<typeof claimSchema>): Promise<ActionResult> {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the month and the kilometres." };
  const { session, decision } = await checkAccess({ module: "FIELD_VISITS" });
  if (!decision.allowed) return { ok: false, error: decision.message ?? BLOCKED["field-visits-off"] };
  const expensesAccess = await checkAccess({ module: "EXPENSES" });
  if (!expensesAccess.decision.allowed) return { ok: false, error: BLOCKED["expenses-off"] };

  const loaded = await loadTravelContext(session);
  if (!loaded.ok) return { ok: false, error: BLOCKED[loaded.blocker] };
  const { context } = loaded;
  const vehicle = context.vehicle;
  if (!vehicle || vehicle.ratePerKm === null) {
    return { ok: false, error: context.vehicleGone ? "Your vehicle is no longer paid for. Ask your admin." : "Choose your vehicle first." };
  }
  const month = parsed.data.month;
  if (!claimableMonths(context.thisMonth).includes(month)) {
    return { ok: false, error: "Travel is claimed once a month has ended, for up to three months back." };
  }
  const expenses = await loadExpensesPolicy(session.tenant.id);
  if (!expenses) return { ok: false, error: BLOCKED["expenses-unpublished"] };

  const tenantId = session.tenant.id;
  const membershipId = session.membership.id;
  const travel = await loadMonthTravel(tenantId, membershipId, month);
  if (!travel || travel.tripsCounted === 0) {
    return { ok: false, error: `No trips to claim in ${monthName(month)}.` };
  }
  const km = checkClaimedKm(travel.recordedKm, parsed.data.claimedKm, parsed.data.reason);
  if (!km.ok) return km;
  const rate = vehicle.ratePerKm;
  const amount = travelAmount(km.km, rate);
  if (!isValidMoney(amount)) return { ok: false, error: "That comes to less than a paisa. Check the kilometres." };

  const expenseDate = monthRange(month)!.last;
  const today = todayIn(session.tenant.timezone);
  const flags = computeFlags({
    expenseDate,
    submittedOn: today,
    deadlineDays: expenses.policy.submissionDeadlineDays,
    amount,
    maxClaimAmount: null,
    duplicateExists: false,
  });
  const description = `${monthName(month)}: ${km.km} km × ₹${rate.toFixed(2)} per km (${vehicle.name}), from ${travel.tripsCounted} field trip${travel.tripsCounted === 1 ? "" : "s"}.`;

  let claimId = "";
  let ref = "";
  try {
    await getDb().$transaction(
      async (tx: Tx) => {
        // One live claim per person per month, even from two phones at once.
        await tx.$queryRaw`SELECT id FROM tenant_memberships WHERE id = ${membershipId}::uuid FOR UPDATE`;
        const standing = await tx.fieldConveyance.findFirst({
          where: { tenantId, membershipId, month, claim: { status: { notIn: ["REJECTED", "WITHDRAWN"] } } },
          select: { claim: { select: { claimNumber: true } } },
        });
        if (standing) {
          throw new Error(`${monthName(month)} is already claimed (${claimRef(standing.claim.claimNumber)}).`);
        }

        const counter = await tx.$queryRaw<Array<{ claimNumber: number }>>`
          INSERT INTO "expense_counters" ("tenantId", "next") VALUES (${tenantId}::uuid, 2)
          ON CONFLICT ("tenantId") DO UPDATE SET "next" = "expense_counters"."next" + 1
          RETURNING "next" - 1 AS "claimNumber"`;

        const claim = await tx.expenseClaim.create({
          data: {
            tenantId,
            membershipId,
            claimNumber: counter[0].claimNumber,
            status: "DRAFT",
            categoryKey: TRAVEL_CATEGORY.key,
            categoryName: TRAVEL_CATEGORY.name,
            receiptRequiredAtSubmission: false,
            maxClaimAmountAtSubmission: null,
            claimedAmount: amount,
            expenseDate: new Date(`${expenseDate}T00:00:00.000Z`),
            description,
            isLate: flags.isLate,
            isOverCap: false,
            isPossibleDuplicate: false,
            policyVersion: expenses.version,
          },
        });
        claimId = claim.id;

        await tx.fieldConveyance.create({
          data: {
            tenantId,
            membershipId,
            claimId: claim.id,
            month,
            vehicleKey: vehicle.key,
            vehicleName: vehicle.name,
            ratePerKm: rate,
            recordedKm: travel.recordedKm,
            estimatedKm: travel.estimatedKm,
            claimedKm: km.km,
            changeReason: km.changed ? parsed.data.reason?.trim() || null : null,
            tripsCounted: travel.tripsCounted,
            tripsAwaiting: travel.tripsAwaiting,
            tripsDeclined: travel.tripsDeclined,
            days: travel.days as unknown as Prisma.InputJsonValue,
          },
        });

        const result = await transitionClaim({
          tx,
          session,
          claimId: claim.id,
          to: "SUBMITTED",
        });
        if (!result.ok) throw new Error(result.error);
        ref = result.ref;
      },
      { timeout: 15_000, maxWait: 5_000 },
    );
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "That didn't go through. Try again." };
  }

  const notes = [
    km.changed ? `claimed ${km.km} km, recorded ${travel.recordedKm} km` : null,
    travel.tripsAwaiting ? `${travel.tripsAwaiting} trip${travel.tripsAwaiting === 1 ? "" : "s"} not yet approved` : null,
    travel.estimatedKm > 0 ? `${travel.estimatedKm} km estimated` : null,
    flags.isLate ? "late" : null,
  ].filter(Boolean);

  await recordAuditEvent(session, {
    action: "field_visits.travel_claimed",
    entityType: "expense_claim",
    entityId: claimId,
    reason: km.changed ? parsed.data.reason?.trim() : undefined,
    after: {
      month,
      vehicle: vehicle.name,
      ratePerKm: rate,
      recordedKm: travel.recordedKm,
      claimedKm: km.km,
      amount,
      tripsAwaiting: travel.tripsAwaiting,
      tripsDeclined: travel.tripsDeclined,
    },
  });

  await raiseActionRequest({
    tenantId,
    kind: "EXPENSE_CLAIM",
    subjectType: "expense_claim",
    subjectId: claimId,
    aboutMembershipId: membershipId,
    title: `${session.user.displayName} — travel allowance ${ref}`,
    body: `${formatAmount(amount)} · ${km.km} km in ${monthName(month)}${notes.length ? ` · ${notes.join(", ")}` : ""}`,
    href: `/admin/expenses/${claimId}`,
    actorUserId: session.user.id,
  });

  refresh(claimId);
  return {
    ok: true,
    claimId,
    message: `${ref} sent for approval.`,
    detail: notes.length
      ? `Your approver will see: ${notes.join("; ")}.`
      : "You'll hear the decision here and on the bell.",
  };
}
