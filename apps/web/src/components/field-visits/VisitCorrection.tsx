"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, TextArea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { correctVisitAction } from "@/lib/field-visits/actions";

/**
 * A visit left open when the day closed: the person says when they left,
 * and why. It is recorded as corrected, never as if it had been tapped
 * (FIELD-VISITS-MODULE.md §3).
 */
export function VisitCorrection({ visitId, placeName }: { visitId: string; placeName: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [leftTime, setLeftTime] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="mt-2">
        <p className="text-caption text-text-secondary">The time you left wasn&apos;t recorded.</p>
        <Button variant="tertiary" size="sm" onClick={() => setOpen(true)}>
          Say when you left
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-1 border-t border-border-subtle pt-3">
      <Input
        label={`When you left ${placeName}`}
        type="time"
        value={leftTime}
        onChange={(e) => {
          setLeftTime(e.target.value);
          setError(null);
        }}
      />
      <TextArea
        label="What happened"
        rows={2}
        maxLength={300}
        value={reason}
        error={error ?? undefined}
        onChange={(e) => {
          setReason(e.target.value);
          setError(null);
        }}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          loading={pending}
          onClick={() => {
            if (!leftTime) return setError("Give the time you left.");
            if (!reason.trim()) return setError("Say what happened.");
            startTransition(async () => {
              const result = await correctVisitAction({ visitId, leftTime, reason });
              if (result.ok) {
                show({ variant: "success", message: result.message });
                router.refresh();
              } else {
                setError(result.error);
              }
            });
          }}
        >
          Record it
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
