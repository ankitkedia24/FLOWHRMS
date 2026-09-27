"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { mediaPathOk } from "@/lib/media/bucket";
import { mediaExists, removeMedia } from "@/lib/media/urls";
import { normaliseLayout } from "./layout";

type Result = { ok: true; message: string } | { ok: false; error: string };

/**
 * Save the company's ID card design: its background image (uploaded by
 * the browser to company-media/<tenant>/idcard/) and where the photo and
 * text go. `backgroundPath` undefined keeps the current image; null removes it.
 */
export async function saveIdCardDesignAction(input: {
  backgroundPath?: string | null;
  layout: unknown;
}): Promise<Result> {
  const { session, decision } = await checkAccess({ module: "EMPLOYEES", permission: "settings.manage" });
  if (!decision.allowed) return { ok: false, error: "Only someone who manages company settings can change the ID card." };

  const path = input.backgroundPath;
  if (typeof path === "string" && (!mediaPathOk(path, session.tenant.id, "idcard") || !(await mediaExists(path)))) {
    return { ok: false, error: "The design didn't upload properly. Try again." };
  }
  const layout = normaliseLayout(input.layout);
  const db = getDb();
  const before = await db.tenant.findUniqueOrThrow({
    where: { id: session.tenant.id },
    select: { idCardBackgroundPath: true },
  });
  await db.tenant.update({
    where: { id: session.tenant.id },
    data: {
      idCardLayout: layout as unknown as object,
      ...(path !== undefined ? { idCardBackgroundPath: path } : {}),
    },
  });
  if (path !== undefined && before.idCardBackgroundPath && before.idCardBackgroundPath !== path) {
    await removeMedia([before.idCardBackgroundPath]);
  }
  await recordAuditEvent(session, {
    action: "settings.id_card_saved",
    entityType: "tenant",
    entityId: session.tenant.id,
    after: { orientation: layout.orientation, background: path === undefined ? "unchanged" : path ? "set" : "removed" },
  });
  revalidatePath("/admin/settings/id-card");
  return { ok: true, message: "ID card design saved. Every card uses it from now on." };
}
