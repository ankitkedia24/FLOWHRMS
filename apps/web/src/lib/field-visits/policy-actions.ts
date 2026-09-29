"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { getPolicy, setPolicy } from "@/lib/policies";
import {
  FAR_FLAG_MAX_M,
  FAR_FLAG_MIN_M,
  MAX_PURPOSES,
  MAX_RATE_PER_KM,
  MAX_VEHICLES,
  PLACE_WORD_MAX,
  PURPOSE_NAME_MAX,
  VEHICLE_NAME_MAX,
  claimableVehicles,
  normalizeFieldVisitsPolicy,
  policyProblem,
  type FieldVisitsPolicy,
} from "./policy";

/**
 * Publishing the field visit rules (FIELD-VISITS-MODULE.md §6). A new
 * version every time; trips already made keep the version they started
 * under.
 */

export type ActionResult =
  | { ok: true; message: string; detail?: string }
  | { ok: false; error: string };

const listItem = (nameMax: number) => ({
  key: z.string().max(40).optional(),
  name: z.string().trim().min(1).max(nameMax),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});

const policySchema = z.object({
  placeWord: z.object({
    singular: z.string().trim().min(1).max(PLACE_WORD_MAX),
    plural: z.string().trim().min(1).max(PLACE_WORD_MAX),
  }),
  purposes: z.array(z.object(listItem(PURPOSE_NAME_MAX))).max(MAX_PURPOSES),
  photo: z.enum(["OFF", "OPTIONAL", "REQUIRED"]),
  farFlagMeters: z.number().int().min(FAR_FLAG_MIN_M).max(FAR_FLAG_MAX_M),
  goingOutApproval: z.boolean(),
  managerUpdates: z.boolean(),
  recorders: z.object({
    mode: z.enum(["ALL", "DEPARTMENTS"]),
    departmentIds: z.array(z.string().uuid()).max(200),
  }),
  vehicles: z
    .array(
      z.object({
        ...listItem(VEHICLE_NAME_MAX),
        ratePerKm: z.number().positive().max(MAX_RATE_PER_KM).nullable(),
      }),
    )
    .max(MAX_VEHICLES),
});

function firstProblem(error: z.ZodError): string {
  const path = error.issues[0]?.path ?? [];
  switch (path[0]) {
    case "placeWord":
      return `Give the word for what your people visit, up to ${PLACE_WORD_MAX} letters.`;
    case "purposes":
      return `Each purpose needs a name of up to ${PURPOSE_NAME_MAX} letters, and at most ${MAX_PURPOSES} purposes.`;
    case "farFlagMeters":
      return `The away-from-saved-spot distance must be between ${FAR_FLAG_MIN_M} and ${FAR_FLAG_MAX_M} metres.`;
    case "vehicles":
      return `Each vehicle needs a name, and a rate of at most ₹${MAX_RATE_PER_KM} per km.`;
    default:
      return "Check the values — something is out of range.";
  }
}

export async function publishFieldVisitsPolicyAction(
  input: z.input<typeof policySchema>,
): Promise<ActionResult> {
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstProblem(parsed.error) };

  const { session, decision } = await checkAccess({
    module: "FIELD_VISITS",
    permission: "policy.edit",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don’t have access to field visit rules." };
  }

  const normalized = normalizeFieldVisitsPolicy(parsed.data);

  // Only this company's departments that are still in use.
  if (normalized.recorders.mode === "DEPARTMENTS") {
    const found = await getDb().department.findMany({
      where: { tenantId: session.tenant.id, isActive: true, id: { in: normalized.recorders.departmentIds } },
      select: { id: true },
    });
    const ok = new Set(found.map((d) => d.id));
    normalized.recorders.departmentIds = normalized.recorders.departmentIds.filter((id) => ok.has(id));
  }

  const problem = policyProblem(normalized);
  if (problem) return { ok: false, error: problem };

  const previous = await getPolicy<FieldVisitsPolicy>(session.tenant.id, "field_visits");
  const { version } = await setPolicy(session.tenant.id, "field_visits", normalized, session.user.id);

  await recordAuditEvent(session, {
    action: "field_visits.policy_published",
    entityType: "tenant_policy",
    before: previous
      ? {
          placeWord: previous.placeWord?.singular,
          photo: previous.photo,
          goingOutApproval: previous.goingOutApproval,
          recorders: previous.recorders?.mode,
        }
      : undefined,
    after: {
      version,
      placeWord: normalized.placeWord.singular,
      activePurposes: normalized.purposes.filter((p) => p.isActive).length,
      photo: normalized.photo,
      farFlagMeters: normalized.farFlagMeters,
      goingOutApproval: normalized.goingOutApproval,
      managerUpdates: normalized.managerUpdates,
      recorders: normalized.recorders.mode,
      departments: normalized.recorders.departmentIds.length,
      claimableVehicles: claimableVehicles(normalized).length,
    },
  });

  revalidatePath("/admin/settings/field-visits");

  return {
    ok: true,
    message: `Version ${version} is live.`,
    detail: "Trips already made keep the rules they started under.",
  };
}
