"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  cancelRedemptionAction,
  redeemRewardAction,
} from "@/lib/performance/reward-actions";

/**
 * The spend button. The confirm step is inline rather than a modal: the
 * price is already on the card, so the second tap IS the confirmation,
 * with the consequence ("spends N points") in the button label itself —
 * a decision made with its consequence on screen.
 */
export function RedeemButton({
  rewardId,
  pointCost,
  disabledReason,
}: {
  rewardId: string;
  pointCost: number;
  disabledReason?: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [arming, setArming] = useState(false);

  function redeem() {
    startTransition(async () => {
      const result = await redeemRewardAction({ rewardId });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
      setArming(false);
    });
  }

  if (disabledReason) {
    return (
      <Button size="sm" disabled disabledReason={disabledReason}>
        Redeem
      </Button>
    );
  }

  return arming ? (
    <div className="flex items-center gap-2">
      <Button size="sm" loading={pending} onClick={redeem}>
        Spend {pointCost.toLocaleString("en-IN")} points
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setArming(false)}>
        Keep them
      </Button>
    </div>
  ) : (
    <Button size="sm" onClick={() => setArming(true)}>
      Redeem
    </Button>
  );
}

/** Cancel a still-pending redemption of your own. */
export function CancelRedemptionButton({ redemptionId }: { redemptionId: string }) {
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
          const result = await cancelRedemptionAction({ redemptionId });
          show(
            result.ok
              ? { variant: "success", message: result.message }
              : { variant: "error", message: result.error },
          );
          if (result.ok) router.refresh();
        })
      }
    >
      Cancel
    </Button>
  );
}
