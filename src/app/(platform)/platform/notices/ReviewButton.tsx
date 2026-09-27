"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { markNoticeReviewedAction } from "@/lib/consent/actions";

/** Record that a lawyer has approved this exact version. Audited. */
export function ReviewButton({ noticeId }: { noticeId: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      loading={pending}
      onClick={() => {
        if (!window.confirm("Confirm a lawyer has reviewed and approved this exact version?")) return;
        startTransition(async () => {
          const result = await markNoticeReviewedAction({ noticeId });
          show({ variant: result.ok ? "success" : "error", message: result.ok ? result.message : result.error });
          if (result.ok) router.refresh();
        });
      }}
    >
      Mark reviewed
    </Button>
  );
}
