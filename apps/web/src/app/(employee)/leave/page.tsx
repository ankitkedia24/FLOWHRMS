import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { STATUS, type Status } from "@/lib/status";
import { formatDateRange } from "@/lib/leave/policy";
import { LeaveRequestForm } from "./LeaveRequestForm";
import { CancelLeaveButton } from "./CancelLeaveButton";

export const metadata: Metadata = { title: "Leave" };

const statusFor: Record<string, Status> = {
  PENDING: STATUS.pendingReview,
  APPROVED: STATUS.approved,
  REJECTED: STATUS.rejected,
  CANCELLED: STATUS.notAvailable,
  DETAILS_REQUESTED: STATUS.needsReview,
};

/** Leave request + status (screens E10/E11). */
export default async function EmployeeLeavePage() {
  const { session, decision } = await checkAccess({ module: "LEAVE" });
  if (!decision.allowed) redirect("/unauthorized");

  const requests = devFixtureOffline()
    ? []
    : await getDb().leaveRequest.findMany({
        where: {
          tenantId: session.tenant.id,
          membershipId: session.membership.id,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

  const tz = session.tenant.timezone;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="mt-2 font-heading text-h1 text-text-primary">Leave</h1>

      <LeaveRequestForm timezone={tz} />

      <section aria-labelledby="my-leave">
        <h2 id="my-leave" className="mb-3 font-heading text-h2 text-text-primary">
          Your requests
        </h2>

        {requests.length === 0 ? (
          <Card flush>
            <EmptyState
              warm
              title="No leave requests."
              body="Request leave when you need it. Your manager is notified straight away."
            />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((request) => (
              <li key={request.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-body font-semibold text-text-primary">
                        {formatDateRange(request.startDate, request.endDate, tz)}
                      </p>
                      <p className="text-caption text-text-secondary">
                        {request.type === "HALF_DAY"
                          ? "Half day"
                          : request.type === "EMERGENCY"
                            ? "Emergency"
                            : "Full day"}
                      </p>
                    </div>
                    <StatusChip
                      status={statusFor[request.status] ?? STATUS.pendingReview}
                      size="sm"
                    />
                  </div>

                  <p className="mt-2 text-secondary text-text-secondary">
                    Your reason: {request.reason}
                  </p>

                  {request.status === "PENDING" && (
                    <p className="mt-2 text-caption text-text-secondary">
                      Sent · waiting for your manager · payroll effect applied
                      after approval
                    </p>
                  )}
                  {request.status === "APPROVED" && (
                    <p className="mt-2 text-caption text-text-secondary">
                      {request.paid
                        ? "Approved as paid. No deduction."
                        : `${request.unpaidDays} unpaid days will be applied to payroll.`}
                    </p>
                  )}
                  {request.decisionReason && (
                    <p className="mt-1 text-secondary text-text-secondary">
                      Reason from your manager: {request.decisionReason}
                    </p>
                  )}

                  {request.status === "PENDING" && (
                    <div className="mt-3">
                      <CancelLeaveButton requestId={request.id} />
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
