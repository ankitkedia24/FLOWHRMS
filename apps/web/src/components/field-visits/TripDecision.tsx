"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { decideTripAction } from "@/lib/field-visits/actions";

/**
 * The reporting manager's answer (FIELD-VISITS-MODULE.md §4). The trip has
 * already happened or is happening — this decides whether it counts for
 * travel allowance. Declining needs a reason, read word for word.
 */
export function TripDecision({ tripId, firstName }: { tripId: string; firstName: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function decide(decision: "APPROVED" | "DECLINED") {
    if (decision === "DECLINED" && !reason.trim()) {
      setError(`Say why — ${firstName} reads it word for word.`);
      return;
    }
    startTransition(async () => {
      const result = await decideTripAction({ tripId, decision, reason: reason.trim() || undefined });
      if (result.ok) {
        show({ variant: "success", message: result.detail ? `${result.message} ${result.detail}` : result.message });
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {declining && (
        <TextArea
          label="Why you're declining"
          rows={3}
          maxLength={500}
          value={reason}
          error={error ?? undefined}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
        />
      )}
      {!declining && error && <p className="text-caption text-status-error-text">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        {declining ? (
          <>
            <Button variant="danger" loading={pending} onClick={() => decide("DECLINED")}>
              Decline trip
            </Button>
            <Button variant="outline" onClick={() => setDeclining(false)}>
              Back
            </Button>
          </>
        ) : (
          <>
            <Button loading={pending} onClick={() => decide("APPROVED")}>
              Approve trip
            </Button>
            <Button variant="outline" onClick={() => setDeclining(true)}>
              Decline
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
