import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";

export type PayrollRunStatus = "DRAFT" | "APPROVED";

/**
 * Take a payroll run's row lock for the rest of the caller's transaction
 * and return the run's status as it stands NOW (after any writer ahead of
 * us has committed). Null when the run is not in this tenant.
 *
 * Calculate, Approve and every adjustment — including an expense settled
 * through payroll — take this same lock before they read or write the
 * run's lines, so they queue behind one another: nothing can slip in
 * between a status check and the write that relies on it. Lock order is
 * always run first, then its lines.
 *
 * Only meaningful inside a transaction: pass the transaction client.
 */
export async function lockPayrollRun(
  tx: Pick<PrismaClient, "$queryRaw">,
  tenantId: string,
  runId: string,
): Promise<{ id: string; status: PayrollRunStatus } | null> {
  const rows = await tx.$queryRaw<Array<{ id: string; status: PayrollRunStatus }>>`
    SELECT "id", "status"::text AS "status" FROM "payroll_runs"
    WHERE "id" = ${runId}::uuid AND "tenantId" = ${tenantId}::uuid
    FOR UPDATE`;
  return rows[0] ?? null;
}
