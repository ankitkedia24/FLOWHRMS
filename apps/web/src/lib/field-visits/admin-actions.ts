"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { formatDuration } from "@/lib/attendance/policy";
import { toCsv } from "@/lib/csv";
import { loadMonthReport, loadTeamContext, scopeDepartments } from "./team";
import { monthRange, placeNameKey, PLACE_NAME_MAX, tidyPlaceName } from "./state";

/**
 * The owner's side of field visits (FIELD-VISITS-MODULE.md §5, §6): the
 * monthly report as a file, and looking after the saved places.
 */

export type ActionResult =
  | { ok: true; message: string; detail?: string }
  | { ok: false; error: string };

const km = (metres: number) => (metres / 1000).toFixed(1);

// ------------------------------------------------------------ export

const exportSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  departmentId: z.string().uuid().optional(),
});

export async function exportFieldVisitsReportAction(
  input: z.input<typeof exportSchema>,
): Promise<{ ok: true; filename: string; csv: string; rows: number } | { ok: false; error: string }> {
  const parsed = exportSchema.safeParse(input);
  const range = parsed.success ? monthRange(parsed.data.month) : null;
  if (!parsed.success || !range) return { ok: false, error: "Choose a month." };

  const { session, decision } = await checkAccess({ module: "FIELD_VISITS", permission: "reports.export" });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "Your role does not allow exporting. Ask your company owner." };
  }
  const context = await loadTeamContext(session);
  if (!context.ok) return { ok: false, error: "There are no field visits for you to export." };

  // The department from the page is a hint: it must be one this person may see.
  let departmentId: string | null = null;
  let departmentName = "All departments";
  if (parsed.data.departmentId) {
    const allowed = await scopeDepartments(session, context.scope);
    const found = allowed.find((d) => d.id === parsed.data.departmentId);
    if (!found) return { ok: false, error: "That department isn't one you can see." };
    departmentId = found.id;
    departmentName = found.name;
  }

  const rows = await loadMonthReport(session, context.scope, context.policy, range, departmentId);
  const headers = [
    "Name",
    "Employee code",
    "Department",
    "Days out",
    "Trips",
    "Visits",
    `Time at ${context.policy.placeWord.plural} (h:mm)`,
    "Time out (h:mm)",
    "Km by road",
    "Km estimated",
    "Visits not ended",
    "Trips declined",
    "Trips awaiting approval",
  ];
  const data = rows.map(({ member, totals }) => [
    member.name,
    member.employeeCode ?? "",
    member.departmentName ?? "",
    totals.daysOut,
    totals.trips,
    totals.visits,
    formatDuration(totals.atPlaceMinutes),
    formatDuration(totals.outMinutes),
    km(totals.finalMetres),
    km(totals.estimatedMetres),
    totals.notEnded,
    totals.declined,
    totals.awaiting,
  ]);
  const filename = `field-visits-${parsed.data.month}.csv`;

  await recordAuditEvent(session, {
    action: "report.exported",
    entityType: "report",
    entityId: "field_visits",
    metadata: { type: "field_visits", month: parsed.data.month, department: departmentName, rows: data.length, filename },
  });

  return { ok: true, filename, csv: toCsv(headers, data), rows: data.length };
}

// ------------------------------------------------------------ places

/** Looking after the places list is for people who see everyone's visits. */
async function placeAccess() {
  const { session, decision } = await checkAccess({ module: "FIELD_VISITS", permission: "fieldvisits.view" });
  return decision.allowed
    ? { ok: true as const, session }
    : { ok: false as const, error: decision.message ?? "Only people who see everyone's field visits can change places." };
}

async function findPlace(tenantId: string, placeId: string) {
  return getDb().fieldPlace.findFirst({ where: { id: placeId, tenantId } });
}

const editSchema = z.object({
  placeId: z.string().uuid(),
  name: z.string().trim().min(1).max(PLACE_NAME_MAX),
  address: z.string().trim().max(200).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Rename a place, or put its pin where it really is. Visits already made
 * keep the name they were recorded with; the distance flag for future
 * visits is measured from the new spot.
 */
export async function editPlaceAction(input: z.input<typeof editSchema>): Promise<ActionResult> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Give the place a name and a location." };
  const access = await placeAccess();
  if (!access.ok) return access;
  const { session } = access;
  const place = await findPlace(session.tenant.id, parsed.data.placeId);
  if (!place) return { ok: false, error: "That place is no longer on the list." };

  const name = tidyPlaceName(parsed.data.name);
  const after = { name, address: parsed.data.address || null, lat: parsed.data.lat, lng: parsed.data.lng };
  await getDb().fieldPlace.update({
    where: { id: place.id },
    data: { ...after, nameKey: placeNameKey(name) },
  });
  await recordAuditEvent(session, {
    action: "field_visits.place_edited",
    entityType: "field_place",
    entityId: place.id,
    before: { name: place.name, address: place.address, lat: place.lat, lng: place.lng },
    after,
  });
  revalidatePath("/admin/field-visits/places");
  return { ok: true, message: `${name} saved.`, detail: "Visits already made keep the name they were recorded with." };
}

const mergeSchema = z.object({ fromId: z.string().uuid(), intoId: z.string().uuid() });

/**
 * Two entries for one place ("Sharma Traders", "Sharma Traders Old Town"):
 * the visits of one are counted under the other, and the first is retired.
 * Each visit still shows the name it was recorded with.
 */
export async function mergePlacesAction(input: z.input<typeof mergeSchema>): Promise<ActionResult> {
  const parsed = mergeSchema.safeParse(input);
  if (!parsed.success || parsed.data.fromId === parsed.data.intoId) {
    return { ok: false, error: "Choose a different place to merge into." };
  }
  const access = await placeAccess();
  if (!access.ok) return access;
  const { session } = access;
  const tenantId = session.tenant.id;
  const [from, into] = await Promise.all([findPlace(tenantId, parsed.data.fromId), findPlace(tenantId, parsed.data.intoId)]);
  if (!from || !into) return { ok: false, error: "One of those places is no longer on the list." };
  if (!into.isActive) return { ok: false, error: `${into.name} is retired. Restore it first, or merge the other way.` };

  const db = getDb();
  const [moved] = await db.$transaction([
    db.fieldVisit.updateMany({ where: { tenantId, placeId: from.id }, data: { placeId: into.id } }),
    db.fieldPlace.update({ where: { id: from.id }, data: { isActive: false } }),
  ]);
  await recordAuditEvent(session, {
    action: "field_visits.places_merged",
    entityType: "field_place",
    entityId: into.id,
    before: { from: from.name, into: into.name },
    after: { visitsMoved: moved.count, retired: from.name },
  });
  revalidatePath("/admin/field-visits/places");
  return {
    ok: true,
    message: `${from.name} merged into ${into.name}.`,
    detail: `${moved.count} visit${moved.count === 1 ? "" : "s"} now count under ${into.name}.`,
  };
}

const activeSchema = z.object({ placeId: z.string().uuid(), active: z.boolean() });

/** Retired places stay for history and are no longer offered on the phone. */
export async function setPlaceActiveAction(input: z.input<typeof activeSchema>): Promise<ActionResult> {
  const parsed = activeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That didn't work. Try again." };
  const access = await placeAccess();
  if (!access.ok) return access;
  const { session } = access;
  const place = await findPlace(session.tenant.id, parsed.data.placeId);
  if (!place) return { ok: false, error: "That place is no longer on the list." };
  await getDb().fieldPlace.update({ where: { id: place.id }, data: { isActive: parsed.data.active } });
  await recordAuditEvent(session, {
    action: parsed.data.active ? "field_visits.place_restored" : "field_visits.place_retired",
    entityType: "field_place",
    entityId: place.id,
    after: { name: place.name },
  });
  revalidatePath("/admin/field-visits/places");
  return {
    ok: true,
    message: parsed.data.active ? `${place.name} is back on the list.` : `${place.name} is retired.`,
    detail: parsed.data.active ? undefined : "Its visits stay in the reports. It's no longer offered on the phone.",
  };
}
