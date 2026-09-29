import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Tx = Prisma.TransactionClient;

/**
 * What happens when someone stops being active — the same whether it is
 * the Deactivate button or the Status field on their record, so neither
 * path leaves loose ends the other would have tidied (MODULE_GAP_AUDIT.md,
 * security 1).
 *
 * - Suspended: decisions waiting on them personally are released, so they
 *   don't sit in a queue nobody can see. Department headship is kept —
 *   a suspension is usually temporary, and new approvals only ever go to
 *   active people (src/lib/actions/service.ts).
 * - Has left: the same, plus pending invitations are revoked and any
 *   department they headed loses its head, and the department screen says so.
 *
 * Their attendance, leave and payslips are evidence and stay exactly as
 * recorded (Product Constitution §3).
 */
export async function applyLeaving(
  tx: Tx,
  input: {
    tenantId: string;
    membershipId: string;
    userId: string;
    status: "SUSPENDED" | "DEACTIVATED";
    headOf: Array<{ id: string; name: string; isActive: boolean }>;
  },
): Promise<{ departmentsLeftWithoutHead: string[] }> {
  await tx.actionRequestRecipient.deleteMany({
    where: { tenantId: input.tenantId, userId: input.userId },
  });
  if (input.status === "SUSPENDED") return { departmentsLeftWithoutHead: [] };

  await tx.employeeInvite.updateMany({
    where: { membershipId: input.membershipId, status: "PENDING" },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  const headed = input.headOf.filter((d) => d.isActive);
  if (headed.length > 0) {
    await tx.department.updateMany({
      where: { id: { in: headed.map((d) => d.id) }, tenantId: input.tenantId },
      data: { headId: null },
    });
  }
  return { departmentsLeftWithoutHead: headed.map((d) => d.name) };
}

/**
 * Best effort: end their open sessions too. Access is already refused on
 * their next request, because a session needs an active membership
 * (src/lib/auth/session.ts).
 */
export async function endSessions(authUserId: string | null): Promise<void> {
  if (!authUserId) return;
  const admin = getSupabaseAdmin();
  await admin?.auth.admin.signOut(authUserId, "global").catch(() => {
    // The membership check already denies access.
  });
}

/** Active owners in the company other than `membershipId`. */
export async function otherActiveOwners(tenantId: string, membershipId: string): Promise<number> {
  return getDb().tenantMembership.count({
    where: { tenantId, status: "ACTIVE", role: { key: "OWNER" }, id: { not: membershipId } },
  });
}
