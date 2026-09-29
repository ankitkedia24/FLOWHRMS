import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Delete one company and everything belonging to it.
 *
 * This used to live only in scripts/delete-tenant.ts, and the cost of that
 * showed: the cascade there was written before performance events existed,
 * so deleting a company that had earned points would fail on a foreign key
 * halfway in. A second copy in the sample-data script would have gone stale
 * the same way. Both callers now run these exact lines, so a new table is
 * remembered in one place or forgotten in none.
 *
 * The order is the constraint graph, children first, and every statement is
 * scoped to one tenant — nothing here can reach another company's rows. It
 * runs in a transaction, so it cannot half-delete.
 *
 * This is genuinely destructive and has no undo. The GUARDS belong to the
 * caller: this function trusts that the decision has already been made.
 */
export async function purgeTenant(
  db: PrismaClient,
  tenantId: string,
): Promise<{ memberships: number; orphanedUsersRemoved: number }> {
  const memberships = await db.tenantMembership.findMany({
    where: { tenantId },
    select: { id: true, userId: true },
  });
  const userIds = [...new Set(memberships.map((m) => m.userId))];
  let orphanedUsersRemoved = 0;

  const t = { tenantId };

  // Prisma's 5-second default is fine for a small company and far too short
  // for a busy one — a tenant with a year of attendance takes longer than
  // that to walk. Timing out mid-way is harmless (the transaction rolls
  // back whole), but it means the delete never completes, so give it room.
  await db.$transaction(
    async (tx) => {
      await tx.actionRequestRecipient.deleteMany({ where: t });
      await tx.actionRequest.deleteMany({ where: t });
      await tx.performanceEvent.deleteMany({ where: t });
      await tx.employeeBadge.deleteMany({ where: t });
      await tx.performanceBoost.deleteMany({ where: t });
      await tx.kudos.deleteMany({ where: t });
      await tx.rewardRedemption.deleteMany({ where: t });
      await tx.reward.deleteMany({ where: t });
      // A travel claim's evidence goes with its claim (it cascades too).
      await tx.fieldConveyance.deleteMany({ where: t });
      await tx.expenseSettlement.deleteMany({ where: t });
      await tx.expenseClaimTransition.deleteMany({ where: t });
      await tx.expenseReceipt.deleteMany({ where: t });
      await tx.expenseClaim.deleteMany({ where: t });
      await tx.expenseCounter.deleteMany({ where: { tenantId } });
      await tx.proofFile.deleteMany({ where: { proof: { tenantId } } });
      await tx.taskProof.deleteMany({ where: t });
      await tx.task.deleteMany({ where: t });
      await tx.leaveRequest.deleteMany({ where: t });
      // Field visits hang off the working day and the saved places, so they
      // go first. Visits and legs cascade from their trip; deleting them
      // explicitly keeps this list readable as the full inventory.
      await tx.fieldLeg.deleteMany({ where: t });
      await tx.fieldVisit.deleteMany({ where: t });
      await tx.fieldTrip.deleteMany({ where: t });
      await tx.fieldPlace.deleteMany({ where: t });
      // Punches cascade from their day record (schema onDelete: Cascade).
      await tx.attendanceRecord.deleteMany({ where: t });
      await tx.employeeDocument.deleteMany({ where: t });
      await tx.payrollAdjustment.deleteMany({ where: { line: { tenantId } } });
      await tx.payrollLine.deleteMany({ where: t });
      await tx.payrollRun.deleteMany({ where: t });
      await tx.salaryStructureLine.deleteMany({ where: { structure: { tenantId } } });
      await tx.salaryStructure.deleteMany({ where: t });
      await tx.salaryComponent.deleteMany({ where: t });
      await tx.employeeInvite.deleteMany({ where: t });
      await tx.emailVerification.deleteMany({ where: t });
      // consent_records and data_requests are deliberately NOT removed: they
      // are evidence and must outlive the company (DPDP Act s.6(10)).
      await tx.notification.deleteMany({ where: t });
      await tx.userFeatureException.deleteMany({ where: t });
      await tx.tenantFeatureSetting.deleteMany({ where: t });
      await tx.tenantModuleSetting.deleteMany({ where: t });
      await tx.tenantPolicy.deleteMany({ where: t });

      // Departments point at memberships and memberships point back — break
      // both links before removing either.
      await tx.department.updateMany({ where: t, data: { headId: null } });
      await tx.tenantMembership.updateMany({
        where: t,
        data: { departmentId: null, reportingToId: null, branchId: null, shiftId: null },
      });
      await tx.department.deleteMany({ where: t });
      await tx.tenantMembership.deleteMany({ where: t });
      await tx.designation.deleteMany({ where: t });
      await tx.branch.deleteMany({ where: t });
      await tx.shift.deleteMany({ where: t });

      await tx.rolePermission.deleteMany({ where: { role: { tenantId } } });
      await tx.role.deleteMany({ where: t });
      await tx.auditEvent.deleteMany({ where: t });
      await tx.tenant.delete({ where: { id: tenantId } });

      // Logins are platform-level and may belong to other companies. Remove
      // only those left with no membership anywhere.
      for (const userId of userIds) {
        const remaining = await tx.tenantMembership.count({ where: { userId } });
        if (remaining === 0) {
          await tx.user.delete({ where: { id: userId } });
          orphanedUsersRemoved += 1;
        }
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  return { memberships: memberships.length, orphanedUsersRemoved };
}
