"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { mediaPathOk } from "@/lib/media/bucket";
import { mediaExists, removeMedia } from "@/lib/media/urls";

/**
 * A company's own look: its logo and its optional opening animation. Both
 * are uploaded by the browser to private storage first; these actions only
 * attach a file that is really there, in this company's folder.
 */

type Result = { ok: true; message: string } | { ok: false; error: string };

async function guard() {
  const { session, decision } = await checkAccess({ module: "EMPLOYEES", permission: "settings.manage" });
  return decision.allowed ? session : null;
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function setCompanyLogoAction(input: { path: string | null }): Promise<Result> {
  const session = await guard();
  if (!session) return { ok: false, error: "Only someone who manages company settings can change the logo." };
  const path = input.path;
  if (path && (!mediaPathOk(path, session.tenant.id, "logo") || !(await mediaExists(path)))) {
    return { ok: false, error: "The logo didn't upload properly. Try again." };
  }
  const db = getDb();
  const before = await db.tenant.findUniqueOrThrow({ where: { id: session.tenant.id }, select: { logoPath: true } });
  await db.tenant.update({ where: { id: session.tenant.id }, data: { logoPath: path } });
  if (before.logoPath && before.logoPath !== path) await removeMedia([before.logoPath]);
  await recordAuditEvent(session, {
    action: path ? "settings.logo_set" : "settings.logo_removed",
    entityType: "tenant",
    entityId: session.tenant.id,
  });
  refresh();
  return { ok: true, message: path ? "Logo saved. It shows across the app now." : "Logo removed." };
}

const SPLASH_MIME = ["image/gif", "video/mp4", "video/webm"] as const;

const splashSchema = z.object({
  path: z.string().max(200).nullable(),
  mime: z.enum(SPLASH_MIME).nullable(),
});

export async function setSplashAction(input: z.input<typeof splashSchema>): Promise<Result> {
  const session = await guard();
  if (!session) return { ok: false, error: "Only someone who manages company settings can change this." };
  const parsed = splashSchema.safeParse(input);
  if (!parsed.success || (parsed.data.path && !parsed.data.mime)) {
    return { ok: false, error: "Use a GIF, MP4 or WebM file." };
  }
  const { path, mime } = parsed.data;
  if (path && (!mediaPathOk(path, session.tenant.id, "splash") || !(await mediaExists(path)))) {
    return { ok: false, error: "The animation didn't upload properly. Try again." };
  }
  const db = getDb();
  const before = await db.tenant.findUniqueOrThrow({ where: { id: session.tenant.id }, select: { splashPath: true } });
  await db.tenant.update({
    where: { id: session.tenant.id },
    // A new animation is switched on straight away; removing one switches it off.
    data: { splashPath: path, splashMime: path ? mime : null, splashEnabled: Boolean(path) },
  });
  if (before.splashPath && before.splashPath !== path) await removeMedia([before.splashPath]);
  await recordAuditEvent(session, {
    action: path ? "settings.splash_set" : "settings.splash_removed",
    entityType: "tenant",
    entityId: session.tenant.id,
    after: path ? { mime } : undefined,
  });
  refresh();
  return {
    ok: true,
    message: path ? "Animation saved and switched on. Everyone sees it the next time they open the app." : "Animation removed.",
  };
}

export async function setSplashEnabledAction(input: { enabled: boolean }): Promise<Result> {
  const session = await guard();
  if (!session) return { ok: false, error: "Only someone who manages company settings can change this." };
  const db = getDb();
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenant.id }, select: { splashPath: true } });
  if (input.enabled && !tenant.splashPath) return { ok: false, error: "Upload an animation first." };
  await db.tenant.update({ where: { id: session.tenant.id }, data: { splashEnabled: Boolean(input.enabled) } });
  await recordAuditEvent(session, {
    action: input.enabled ? "settings.splash_on" : "settings.splash_off",
    entityType: "tenant",
    entityId: session.tenant.id,
  });
  refresh();
  return { ok: true, message: input.enabled ? "Opening animation switched on." : "Opening animation switched off." };
}
