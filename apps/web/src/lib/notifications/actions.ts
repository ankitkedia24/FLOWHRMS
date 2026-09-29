"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { requireSession } from "@/lib/authz/guard";

/** Mark the signed-in user's notifications as read (own records only). */
export async function markAllNotificationsRead(): Promise<void> {
  const session = await requireSession();
  if (devFixtureOffline()) return;

  await getDb().notification.updateMany({
    where: {
      tenantId: session.tenant.id,
      userId: session.user.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  revalidatePath("/notifications");
}
