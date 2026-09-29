import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { demoRequestStatus } from "@/lib/platform/demo-requests";
import { EnquiryControls } from "./EnquiryControls";

export const metadata: Metadata = { title: "Enquiries" };

function when(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export default async function EnquiriesPage() {
  await requirePlatformAdmin();
  const db = getDb();

  const enquiries = await db.demoRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { handledBy: { select: { displayName: true } } },
  });

  const newCount = enquiries.filter((e) => e.status === "NEW").length;

  return (
    <>
      <h1 className="font-heading text-h1 text-text-primary">Enquiries</h1>
      <p className="mt-1 text-secondary text-text-secondary">
        {newCount > 0
          ? `${newCount} waiting to be called.`
          : "Nothing waiting. Every enquiry has been picked up."}
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {enquiries.length === 0 ? (
          <Card>
            <EmptyState
              title="No enquiries yet."
              body="Requests from the demo page on the marketing site arrive here."
            />
          </Card>
        ) : (
          enquiries.map((e) => (
            <Card key={e.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-heading text-h3 text-text-primary">
                    {e.company}
                  </h2>
                  <p className="mt-0.5 text-secondary text-text-secondary">
                    {e.name} ·{" "}
                    {/* The whole point of the enquiry: one tap to call. */}
                    <a
                      href={`tel:+91${e.phone}`}
                      className="font-mono text-data text-brand-primary underline-offset-2 hover:underline"
                    >
                      +91 {e.phone}
                    </a>
                    {e.teamSize ? ` · ${e.teamSize} people` : ""}
                  </p>
                  <p className="mt-0.5 text-caption text-text-tertiary">
                    {when(e.createdAt)}
                    {e.handledBy ? ` · picked up by ${e.handledBy.displayName}` : ""}
                  </p>
                </div>
                <StatusChip
                  status={demoRequestStatus(e.status)}
                  size="sm"
                />
              </div>

              {e.notes && (
                <p className="mt-3 whitespace-pre-wrap rounded-md bg-surface-sunken p-3 text-body text-text-secondary">
                  {e.notes}
                </p>
              )}

              {e.handledNote && (
                <p className="mt-2 text-caption text-text-secondary">
                  Note: {e.handledNote}
                </p>
              )}

              <div className="mt-4">
                <EnquiryControls
                  id={e.id}
                  status={e.status}
                  company={e.company}
                  contactName={e.name}
                />
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
