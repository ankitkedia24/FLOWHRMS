import "server-only";

import { getDb } from "@/lib/db";
import { sendMail } from "@/lib/email/send";
import { errorAlertEmail } from "@/lib/email/templates";
import {
  ALERT_EMAIL,
  ALERT_EVERY_MS,
  errorFingerprint,
  isControlFlow,
  routeLabel,
  scrubMessage,
  shouldEmail,
} from "./error-policy";

/**
 * Record a server error on the live site (called from src/instrumentation.ts)
 * and email the first of each kind in an hour to info@flowacord.com. The
 * rest are counted on /platform/system.
 *
 * Never throws: it runs while a request is already failing, and a broken
 * error reporter must not turn one failure into two. If the database itself
 * is down nothing is recorded — the uptime monitor catches that.
 */
export async function recordServerError(input: {
  error: unknown;
  path?: string;
  method?: string;
  routePath?: string;
  routeType?: string;
}): Promise<void> {
  try {
    const err = input.error;
    const digest =
      typeof err === "object" && err !== null && "digest" in err
        ? String((err as { digest: unknown }).digest)
        : undefined;
    if (isControlFlow(digest)) return;

    const message = scrubMessage(err instanceof Error ? err.message : String(err));
    const route = routeLabel(input.routePath, input.path);
    const kind = (input.routeType ?? "unknown").slice(0, 20);
    const method = (input.method ?? "GET").slice(0, 10);
    const fingerprint = errorFingerprint({ route, kind, message });
    const now = new Date();
    const db = getDb();

    const row = await db.platformError.upsert({
      where: { fingerprint },
      create: { fingerprint, message, route, method, kind, digest, firstSeenAt: now, lastSeenAt: now },
      update: { count: { increment: 1 }, lastSeenAt: now, message, digest },
    });
    if (!shouldEmail(row.lastEmailedAt, now)) return;

    // Claim the email first, so two failures at the same moment send one.
    const claimed = await db.platformError.updateMany({
      where: {
        id: row.id,
        OR: [{ lastEmailedAt: null }, { lastEmailedAt: { lte: new Date(now.getTime() - ALERT_EVERY_MS) } }],
      },
      data: { lastEmailedAt: now },
    });
    if (claimed.count !== 1) return;

    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://hrms.flowacord.com").replace(/\/+$/, "");
    await sendMail({
      to: ALERT_EMAIL,
      ...errorAlertEmail({
        message,
        route,
        kind,
        method,
        count: row.count,
        firstSeenAt: row.firstSeenAt,
        link: `${site}/platform/system`,
      }),
    });
  } catch (error) {
    console.error("error record failed:", error instanceof Error ? error.message : error);
  }
}
