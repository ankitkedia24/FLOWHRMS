import "server-only";

import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import type { AppSession } from "@/lib/auth/types";
import {
  recordScope,
  seesWholeCompany,
  supervisorsOf,
  type RecordScope,
  type ScopeDepartment,
  type ScopeMember,
} from "./scope";

/**
 * Loads what the record-scope rules (scope.ts) need, filtered by tenant.
 * Company-wide roles cost no query at all; a team is worked out from the
 * whole company's reporting lines, which for the SMEs this serves is a few
 * hundred small rows.
 */

async function loadGraph(
  tenantId: string,
): Promise<{ members: ScopeMember[]; departments: ScopeDepartment[] }> {
  const db = getDb();
  const [members, departments] = await Promise.all([
    // Every status: a manager still looks after someone who has left, for
    // their past records, and a suspended manager still sits in the chain.
    db.tenantMembership.findMany({
      where: { tenantId },
      select: { id: true, reportingToId: true, departmentId: true },
    }),
    db.department.findMany({
      where: { tenantId, isActive: true, headId: { not: null } },
      select: { id: true, headId: true },
    }),
  ]);
  return { members, departments };
}

/**
 * Whose records this session may see and act on. The offline dev preview
 * has no database and no records, so there is nothing to narrow.
 */
export async function loadRecordScope(session: AppSession): Promise<RecordScope> {
  if (seesWholeCompany(session.membership.roleKey) || devFixtureOffline()) return "all";
  const { members, departments } = await loadGraph(session.tenant.id);
  return recordScope({
    actor: { membershipId: session.membership.id, roleKey: session.membership.roleKey },
    members,
    departments,
  });
}

/**
 * Of these would-be approvers, the ones who may decide about `targetId`:
 * company-wide roles always, anyone else only when the person is in their
 * team. Keeps tiles and the bell from reaching a manager who would only be
 * refused on pressing.
 */
export async function approversInScope<T extends { membershipId: string; roleKey: string }>(
  tenantId: string,
  targetId: string | null | undefined,
  approvers: T[],
): Promise<T[]> {
  if (approvers.every((a) => seesWholeCompany(a.roleKey))) return approvers;
  if (!targetId) return approvers.filter((a) => seesWholeCompany(a.roleKey));
  const { members, departments } = await loadGraph(tenantId);
  const above = supervisorsOf(targetId, members, departments);
  return approvers.filter((a) => seesWholeCompany(a.roleKey) || above.has(a.membershipId));
}
