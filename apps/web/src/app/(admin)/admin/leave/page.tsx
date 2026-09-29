import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  formatDateRange,
  leaveApprovalImpact,
  payrollMonthLabel,
} from "@/lib/leave/policy";
import { LeaveQueue } from "./LeaveQueue";

export const metadata: Metadata = { title: "Leave" };

/** Leave approval queue (screen A6). */
export default async function AdminLeavePage() {
  const { session, decision } = await checkAccess({
    module: "LEAVE",
    permission: "leave.view",
  });
  if (!decision.allowed) redirect("/unauthorized");

  const canApprove = session.permissions.has("leave.approve");
  const tz = session.tenant.timezone;

  const requests = devFixtureOffline()
    ? []
    : await getDb().leaveRequest.findMany({
        where: { tenantId: session.tenant.id, status: "PENDING" },
        include: { membership: { include: { user: true } } },
        orderBy: { createdAt: "asc" },
        take: 25,
      });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-h1 text-text-primary">Leave</h1>

      <Alert
        variant="warning"
        title="Payroll for this period is not yet approved."
      >
        Leave decisions made now will be included in this month&apos;s
        calculation. Rejecting needs a reason.
      </Alert>

      {requests.length === 0 ? (
        <Card flush>
          <EmptyState
            title="No leave to approve."
            body="New requests appear here as soon as they are sent."
          />
        </Card>
      ) : !canApprove ? (
        <Alert variant="info" title="You can see requests but not decide them.">
          Ask your company owner for the leave approval permission.
        </Alert>
      ) : (
        <LeaveQueue
          items={requests.map((request) => ({
            id: request.id,
            name: request.membership.user.displayName,
            meta: request.membership.employeeCode ?? undefined,
            dates: formatDateRange(request.startDate, request.endDate, tz),
            type:
              request.type === "HALF_DAY"
                ? "Half day"
                : request.type === "EMERGENCY"
                  ? "Emergency"
                  : "Full day",
            reason: request.reason,
            days: request.unpaidDays,
            impactUnpaid: leaveApprovalImpact({
              days: request.unpaidDays,
              monthLabel: payrollMonthLabel(request.startDate, tz),
              name: request.membership.user.displayName,
              paid: false,
            }),
          }))}
        />
      )}
    </div>
  );
}
