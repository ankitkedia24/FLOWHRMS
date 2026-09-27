"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { updateDataRequestAction } from "@/lib/consent/actions";

/** Move a request along; closing one requires saying what was done. */
export function RequestControls({
  id,
  status,
}: {
  id: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [response, setResponse] = useState("");

  function move(next: "IN_PROGRESS" | "RESOLVED" | "REJECTED") {
    startTransition(async () => {
      const result = await updateDataRequestAction({ id, status: next, response });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <TextArea
        label="What was done"
        optional
        rows={2}
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        helper="Required to close a request. The person sees this answer."
      />
      <div className="flex flex-wrap gap-2">
        {status === "OPEN" && (
          <Button size="sm" variant="outline" loading={pending} onClick={() => move("IN_PROGRESS")}>
            Start
          </Button>
        )}
        <Button size="sm" loading={pending} onClick={() => move("RESOLVED")}>
          Mark answered
        </Button>
        <Button size="sm" variant="tertiary" loading={pending} onClick={() => move("REJECTED")}>
          Decline
        </Button>
      </div>
    </div>
  );
}
