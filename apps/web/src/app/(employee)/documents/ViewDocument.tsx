"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getDocumentUrl } from "@/lib/employees/documents";

/**
 * Open one of your own documents (screen E17). The same server action HR
 * uses: it mints a two-minute signed link after checking the document is
 * yours (your own need no documents.download permission) and records the
 * view. Without this, a file could be sent but never looked at again.
 */
export function ViewDocument({ documentId, name }: { documentId: string; name: string }) {
  const { show } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="md"
      variant="outline"
      loading={pending}
      aria-label={`View ${name}`}
      onClick={() =>
        startTransition(async () => {
          const result = await getDocumentUrl(documentId);
          if (result.ok) window.open(result.url, "_blank", "noopener,noreferrer");
          else show({ variant: "error", message: result.error });
        })
      }
    >
      View
    </Button>
  );
}
