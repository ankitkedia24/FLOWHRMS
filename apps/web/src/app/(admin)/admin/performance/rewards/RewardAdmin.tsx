"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, TextArea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  createRewardAction,
  decideRedemptionAction,
  retireRewardAction,
} from "@/lib/performance/reward-actions";

/**
 * Store management + the fulfilment queue (PERFORMANCE-MODULE.md §D, §E).
 *
 * Approving means "I handed it over" — a record of a physical act, which
 * is why the tile always routes here instead of offering one-tap approve.
 * Rejecting demands a reason because the employee reads it word for word.
 */

export function CreateRewardForm() {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pointCost, setPointCost] = useState("");
  const [stock, setStock] = useState("");

  function create() {
    startTransition(async () => {
      const result = await createRewardAction({
        name,
        description: description || undefined,
        pointCost: Number(pointCost),
        stock: stock === "" ? null : Number(stock),
      });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        setName("");
        setDescription("");
        setPointCost("");
        setStock("");
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Reward" placeholder="A paid day off" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Point cost"
          type="number"
          inputMode="numeric"
          value={pointCost}
          onChange={(e) => setPointCost(e.target.value)}
        />
        <Input
          label="Stock"
          type="number"
          inputMode="numeric"
          optional
          helper="Leave empty for unlimited."
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
      </div>
      <TextArea
        label="Description"
        optional
        className="max-w-none"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div>
        <Button loading={pending} onClick={create}>
          Add to the store
        </Button>
      </div>
    </div>
  );
}

export function RetireRewardButton({ rewardId }: { rewardId: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await retireRewardAction({ rewardId });
          show(result.ok
            ? { variant: "success", message: result.message }
            : { variant: "error", message: result.error });
          if (result.ok) router.refresh();
        })
      }
    >
      Retire
    </Button>
  );
}

export function DecideRedemption({ redemptionId }: { redemptionId: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  function decide(decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      const result = await decideRedemptionAction({
        redemptionId,
        decision,
        reason: reason || undefined,
      });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        setRejecting(false);
        setReason("");
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  return rejecting ? (
    <div className="flex w-full flex-col gap-2">
      <Input
        label="Why it's refused"
        helper="The employee reads exactly these words. Their points return automatically."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="danger" loading={pending} onClick={() => decide("REJECTED")}>
          Refuse and return the points
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setRejecting(false)}>
          Back
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex gap-2">
      <Button size="sm" loading={pending} onClick={() => decide("APPROVED")}>
        Handed over
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setRejecting(true)}>
        Refuse
      </Button>
    </div>
  );
}
