"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { setPolicy } from "@/lib/policies";
// Values live in constants.ts, not here: a "use server" module may only
// export async functions, and exporting one to a client component fails at
// render time rather than at build time.
import { TIMEZONES } from "./constants";

/**
 * Company settings (screen A24) and notification preferences (A18).
 * Every change is audited with before/after values.
 */

export type ActionResult =
  | { ok: true; message: string; detail?: string }
  | { ok: false; error: string };

const companySchema = z.object({
  name: z.string().trim().min(1, "Give your company a name.").max(160),
  timezone: z.enum(TIMEZONES),
});

export async function saveCompanySettingsAction(
  input: z.input<typeof companySchema>,
): Promise<ActionResult> {
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the company details.",
    };
  }

  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "settings.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const before = await db.tenant.findUniqueOrThrow({
    where: { id: session.tenant.id },
    select: { name: true, timezone: true },
  });

  await db.tenant.update({
    where: { id: session.tenant.id },
    data: { name: parsed.data.name, timezone: parsed.data.timezone },
  });

  await recordAuditEvent(session, {
    action: "settings.company_changed",
    entityType: "tenant",
    entityId: session.tenant.id,
    before,
    after: parsed.data,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");

  return {
    ok: true,
    message: "Company settings saved.",
    detail:
      before.timezone !== parsed.data.timezone
        ? "Times already recorded keep the moment they happened; only how they are shown changes."
        : undefined,
  };
}

const notificationSchema = z.object({
  matrix: z.record(z.string(), z.boolean()),
  quietHours: z.object({
    enabled: z.boolean(),
    fromMinutes: z.number().int().min(0).max(1439),
    toMinutes: z.number().int().min(0).max(1439),
  }),
});

export async function saveNotificationSettingsAction(
  input: z.input<typeof notificationSchema>,
): Promise<ActionResult> {
  const parsed = notificationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the notification settings." };
  }

  const { session, decision } = await checkAccess({
    module: "NOTIFICATIONS",
    permission: "settings.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const { version, previous } = await setPolicy(
    session.tenant.id,
    "notifications",
    parsed.data,
    session.user.id,
  );

  await recordAuditEvent(session, {
    action: "settings.notifications_changed",
    entityType: "tenant_policy",
    entityId: session.tenant.id,
    before: previous ?? undefined,
    after: { ...parsed.data, version },
  });

  revalidatePath("/admin/settings/notifications");

  return {
    ok: true,
    message: `Notification settings saved as version ${version}.`,
    detail:
      "Channels without a provider stay off until one is added, and are never silently failed.",
  };
}
