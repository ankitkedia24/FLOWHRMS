import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { STATUS, type Status } from "@/lib/status";
import { MyDocuments } from "./MyDocuments";

export const metadata: Metadata = { title: "My documents" };

const statusFor: Record<string, Status> = {
  PENDING_REVIEW: STATUS.pendingReview,
  VERIFIED: STATUS.verified,
  REJECTED: STATUS.needsReview,
};

/**
 * My documents (screen E17). The privacy notice is stated at the point of
 * capture, in the approved words (Constitution §7, copy-deck.md §5).
 */
export default async function MyDocumentsPage() {
  const { session, decision } = await checkAccess({ module: "EMPLOYEES" });
  if (!decision.allowed) redirect("/unauthorized");

  const documents = devFixtureOffline()
    ? []
    : await getDb().employeeDocument.findMany({
        where: {
          tenantId: session.tenant.id,
          membershipId: session.membership.id, // own records only
        },
        orderBy: { uploadedAt: "desc" },
      });

  const tz = session.tenant.timezone;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="mt-2 font-heading text-h1 text-text-primary">
        My documents
      </h1>

      <p className="text-secondary text-text-secondary">
        Your documents are visible to you, HR and your company owner. They
        are not shared with other employees.
      </p>

      <MyDocuments membershipId={session.membership.id} />

      {documents.length === 0 ? (
        <Card flush>
          <EmptyState
            warm
            title="No documents yet."
            body="HR may ask you for ID or address proof."
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {documents.map((document) => (
            <li key={document.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-text-primary">
                      {document.kind}
                    </p>
                    <p className="text-caption text-text-secondary">
                      {document.name} ·{" "}
                      {(document.sizeBytes / 1024).toFixed(0)} KB · added{" "}
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: tz,
                      }).format(document.uploadedAt)}
                    </p>
                  </div>
                  <StatusChip
                    status={statusFor[document.status] ?? STATUS.pendingReview}
                    size="sm"
                  />
                </div>
                {document.reviewReason && (
                  <p className="mt-2 text-secondary text-text-secondary">
                    HR asked for a better copy: {document.reviewReason}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
