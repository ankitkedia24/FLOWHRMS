"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { STATUS, type Status } from "@/lib/status";
import {
  getDocumentUrl,
  reviewDocumentAction,
} from "@/lib/employees/documents";

/**
 * Employee documents on the admin profile (screen A5).
 *
 * Verification uses the three-decision shape: Verify, or ask for a better
 * copy with a reason the employee can act on. Opening a file mints a
 * short-lived signed URL server-side and is recorded.
 */
export interface DocumentRow {
  id: string;
  kind: string;
  name: string;
  sizeBytes: number;
  status: string;
  reviewReason: string | null;
  uploadedAt: string;
}

const statusFor: Record<string, Status> = {
  PENDING_REVIEW: STATUS.needsReview,
  VERIFIED: STATUS.verified,
  REJECTED: STATUS.rejected,
};

export function DocumentsPanel({
  documents,
  canManage,
  canDownload,
}: {
  membershipId: string;
  documents: DocumentRow[];
  canManage: boolean;
  canDownload: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function open(documentId: string) {
    startTransition(async () => {
      const result = await getDocumentUrl(documentId);
      if (result.ok) window.open(result.url, "_blank", "noopener,noreferrer");
      else show({ variant: "error", message: result.error });
    });
  }

  function decide(documentId: string, decision: "VERIFIED" | "REJECTED") {
    startTransition(async () => {
      const result = await reviewDocumentAction({
        documentId,
        decision,
        reason: reason.trim() || undefined,
      });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        setRejecting(null);
        setReason("");
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  return (
    <Card flush>
      <div className="p-5 pb-0">
        <CardHeader
          title="Documents"
          meta="Visible to this person, HR and your company owner."
        />
      </div>

      {documents.length === 0 ? (
        <EmptyState
          title="No documents yet."
          body="ID or address proof appears here once it is added."
        />
      ) : (
        <ul className="flex flex-col p-5 pt-0">
          {documents.map((document) => (
            <li
              key={document.id}
              className="border-b border-border-subtle py-3 last:border-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-body font-semibold text-text-primary">
                    {document.kind}
                  </p>
                  <p className="text-caption text-text-secondary">
                    {document.name} · {(document.sizeBytes / 1024).toFixed(0)} KB
                    · added {document.uploadedAt}
                  </p>
                  {document.reviewReason && (
                    <p className="mt-1 text-secondary text-text-secondary">
                      Note: {document.reviewReason}
                    </p>
                  )}
                </div>
                <StatusChip
                  status={statusFor[document.status] ?? STATUS.needsReview}
                  size="sm"
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  loading={pending}
                  disabled={!canDownload}
                  disabledReason={
                    canDownload
                      ? undefined
                      : "Your role does not allow opening employee documents."
                  }
                  onClick={() => open(document.id)}
                >
                  Open
                </Button>
                {canManage && document.status === "PENDING_REVIEW" && (
                  <>
                    <Button
                      size="sm"
                      loading={pending}
                      onClick={() => decide(document.id, "VERIFIED")}
                    >
                      Verify
                    </Button>
                    <Button
                      size="sm"
                      variant="dangerSubtle"
                      onClick={() => setRejecting(document.id)}
                    >
                      Request a better copy
                    </Button>
                  </>
                )}
              </div>

              {rejecting === document.id && (
                <div className="mt-3">
                  <Input
                    label="What is wrong with it?"
                    required
                    helper="They will see this, so be specific."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      loading={pending}
                      disabled={!reason.trim()}
                      disabledReason={
                        !reason.trim() ? "Say what is wrong." : undefined
                      }
                      onClick={() => decide(document.id, "REJECTED")}
                    >
                      Send request
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRejecting(null);
                        setReason("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
