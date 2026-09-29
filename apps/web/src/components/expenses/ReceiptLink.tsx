"use client";

import { useTransition } from "react";
import { FileText } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { getReceiptUrlAction } from "@/lib/expenses/actions";

/**
 * Opens a receipt through a short-lived signed URL (EXPENSES-MODULE.md
 * §10). No public path exists; every open is audited server-side.
 */
export function ReceiptLink({
  receiptId,
  name,
  sizeBytes,
}: {
  receiptId: string;
  name: string;
  sizeBytes: number;
}) {
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const kb = Math.max(1, Math.round(sizeBytes / 1024));

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await getReceiptUrlAction(receiptId);
          if (result.ok) window.open(result.url, "_blank", "noopener,noreferrer");
          else show({ variant: "error", message: result.error });
        })
      }
      className="flex min-h-11 w-full items-center gap-2 rounded-md border border-border-default bg-surface-default px-3 text-left text-body text-brand-primary hover:bg-surface-sunken disabled:opacity-60"
    >
      <FileText aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="shrink-0 text-caption text-text-secondary">
        {pending ? "Opening…" : `${kb} KB`}
      </span>
    </button>
  );
}
