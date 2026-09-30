"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getProofFileUrl } from "@/lib/tasks/proof-access";

/**
 * Open one task proof file (Hardening 7E.1). The proof bucket is private,
 * so a file name alone is all a reviewer ever had: they approved proof they
 * could not look at. The server action checks the permission, the team and
 * the stored path, mints a two-minute signed link and records the view;
 * the assignee opens their own the same way. A refusal is said, not
 * swallowed.
 */
export function ViewProofFile({ fileId, name }: { fileId: string; name: string }) {
  const { show } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      loading={pending}
      aria-label={`View ${name}`}
      onClick={() =>
        startTransition(async () => {
          const result = await getProofFileUrl(fileId);
          if (result.ok) window.open(result.url, "_blank", "noopener,noreferrer");
          else show({ variant: "error", message: result.error });
        })
      }
    >
      View
    </Button>
  );
}
