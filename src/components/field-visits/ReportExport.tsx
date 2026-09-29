"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { exportFieldVisitsReportAction } from "@/lib/field-visits/admin-actions";

/**
 * The month as a CSV. Built on the server, where the permission and the
 * scope are checked, and handed to the browser as a download.
 */
export function ReportExport({
  month,
  departmentId,
  canExport,
}: {
  month: string;
  departmentId: string | null;
  canExport: boolean;
}) {
  const { show } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      disabled={!canExport}
      disabledReason={canExport ? undefined : "Your role does not allow exporting. Ask your company owner."}
      leadingIcon={<Download aria-hidden="true" className="size-4" />}
      onClick={() =>
        startTransition(async () => {
          const result = await exportFieldVisitsReportAction({ month, departmentId: departmentId ?? undefined });
          if (!result.ok) {
            show({ variant: "error", message: result.error });
            return;
          }
          const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8;" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = result.filename;
          link.click();
          URL.revokeObjectURL(url);
          show({ variant: "success", message: `${result.rows} ${result.rows === 1 ? "person" : "people"} exported.` });
        })
      }
    >
      Download CSV
    </Button>
  );
}
