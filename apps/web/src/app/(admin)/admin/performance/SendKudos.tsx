"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { sendKudosAction } from "@/lib/performance/kudos-actions";

/**
 * Send a kudo (PERFORMANCE-MODULE.md §F). Three a week, one per person
 * per week — stated up front, because a cap discovered on rejection
 * feels like a slap and a cap stated up front feels like a design.
 */
export function SendKudos({
  members,
  sentThisWeek,
}: {
  members: Array<{ id: string; name: string }>;
  sentThisWeek: number;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [toMembershipId, setTo] = useState("");
  const [message, setMessage] = useState("");

  function send() {
    startTransition(async () => {
      const result = await sendKudosAction({ toMembershipId, message });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        setTo("");
        setMessage("");
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Select
        label="Who"
        placeholder="Choose someone…"
        options={members.map((m) => ({ value: m.id, label: m.name }))}
        value={toMembershipId}
        onChange={(e) => setTo(e.target.value)}
      />
      <TextArea
        label="For what"
        helper="They read exactly these words, with your name on them."
        className="max-w-none"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div>
        <Button loading={pending} disabled={!toMembershipId} onClick={send}>
          Send kudos
        </Button>
        <p className="mt-2 text-caption text-text-secondary">
          {3 - sentThisWeek > 0
            ? `${3 - sentThisWeek} of 3 left this week · one per person per week. Words only — kudos never move points.`
            : "That's your 3 for the week. Scarcity is what makes them count."}
        </p>
      </div>
    </div>
  );
}
