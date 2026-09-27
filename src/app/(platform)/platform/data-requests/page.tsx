import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { DATA_REQUEST_LABEL, daysUntilDue } from "@/lib/consent/requests";
import { RequestControls } from "./RequestControls";

export const metadata: Metadata = { title: "Data requests" };

const STATUS = {
  OPEN: { key: "dr-open", label: "Open", tone: "warning" },
  IN_PROGRESS: { key: "dr-progress", label: "In progress", tone: "info" },
  RESOLVED: { key: "dr-resolved", label: "Answered", tone: "success" },
  REJECTED: { key: "dr-rejected", label: "Declined", tone: "neutral" },
} as const;

/**
 * Rights requests from Data Principals — access, correction, erasure,
 * grievances and withdrawals — with the 90-day answer date (Rule 14).
 * Open requests first, soonest due at the top.
 */
export default async function DataRequestsPage() {
  await requirePlatformAdmin();
  const requests = await getDb().dataRequest.findMany({
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    take: 200,
  });
  const now = new Date();
  const open = requests.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS");

  return (
    <>
      <h1 className="font-heading text-h1 text-text-primary">Data requests</h1>
      <p className="mt-1 text-secondary text-text-secondary">
        {open.length > 0
          ? `${open.length} waiting for an answer. Each must be answered within 90 days.`
          : "Nothing waiting."}
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {requests.length === 0 ? (
          <Card>
            <EmptyState
              title="No requests yet."
              body="Requests people raise from Account → Privacy & consent arrive here."
            />
          </Card>
        ) : (
          requests.map((r) => {
            const days = daysUntilDue(r.dueAt, now);
            const pending = r.status === "OPEN" || r.status === "IN_PROGRESS";
            return (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-heading text-h3 text-text-primary">
                      {DATA_REQUEST_LABEL[r.type]} · {r.email}
                    </h2>
                    <p className="mt-0.5 text-secondary text-text-secondary">
                      {r.tenantName ?? "No company"} · received{" "}
                      {r.createdAt.toISOString().slice(0, 10)}
                      {pending &&
                        (days >= 0
                          ? ` · due in ${days} day${days === 1 ? "" : "s"}`
                          : ` · OVERDUE by ${-days} day${days === -1 ? "" : "s"}`)}
                    </p>
                  </div>
                  <StatusChip status={STATUS[r.status]} size="sm" />
                </div>
                <p className="mt-3 whitespace-pre-wrap rounded-md bg-surface-sunken p-3 text-body text-text-secondary">
                  {r.details}
                </p>
                {r.response && (
                  <p className="mt-2 whitespace-pre-wrap text-secondary text-text-secondary">
                    Answer: {r.response}
                  </p>
                )}
                {pending && (
                  <div className="mt-3">
                    <RequestControls id={r.id} status={r.status} />
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
