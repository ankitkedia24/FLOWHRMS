"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cancelLeaveAction } from "@/lib/leave/actions";

/** Cancel a pending request (allowed until payroll is approved). */
export function CancelLeaveButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await cancelLeaveAction({ requestId });
          if (result.ok) {
            show({ variant: "success", message: result.message });
            router.refresh();
          } else {
            show({ variant: "error", message: result.error });
          }
        })
      }
    >
      Cancel request
    </Button>
  );
}
