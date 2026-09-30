"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { startSupportSessionAction } from "@/lib/platform/support-actions";

/**
 * Open this company as Flowacord support (lib/auth/support.ts). `refusal`
 * is why it can't be opened yet, worked out on the server with the same
 * rule the action applies.
 */
export function SupportControl({ tenantId, refusal }: { tenantId: string; refusal: string | null }) {
  const { show } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          size="sm"
          variant="outline"
          loading={pending}
          disabled={refusal !== null}
          disabledReason={refusal ?? undefined}
          onClick={() =>
            startTransition(async () => {
              const result = await startSupportSessionAction({ tenantId });
              if (result && !result.ok) show({ variant: "error", message: result.error });
            })
          }
        >
          Open as support
        </Button>
      </div>
      {/* When it can't be opened, the disabled button already says why. */}
      {refusal === null && (
        <p className="text-caption text-text-secondary">
          You work inside the company with the Owner&apos;s access, for as long as you need. Your changes are recorded
          as “Flowacord support”. Exit from the strip at the top.
        </p>
      )}
    </div>
  );
}
