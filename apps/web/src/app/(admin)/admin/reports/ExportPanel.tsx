"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { exportReportAction } from "@/lib/reports/actions";

/**
 * Report export. The file is generated server-side (where the permission
 * and tenant scope are enforced) and handed to the browser as a download;
 * nothing sensitive is assembled on the client.
 */
export function ExportPanel({
  types,
  canExport,
  branches = [],
}: {
  types: Array<{ value: string; label: string }>;
  canExport: boolean;
  branches?: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState(types[0]?.value ?? "attendance");

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [branchId, setBranchId] = useState("all");

  const scopeName =
    branchId === "all"
      ? "All branches"
      : (branches.find((b) => b.id === branchId)?.name ?? "All branches");

  return (
    <Card>
      <CardHeader title="Export records" meta="CSV, opens in any spreadsheet" />
      <div className="flex flex-col gap-1">
        <Select
          label="Report"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={types.map((t) => ({ value: t.value, label: t.label }))}
        />
        <Input
          label="From"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input
          label="To"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        {branches.length > 1 && (
          <Select
            label="Location"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            options={[
              { value: "all", label: "All branches" },
              ...branches.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        )}
      </div>

      <p className="mt-3 text-caption text-text-secondary">
        Scope: {scopeName}. Names, dates, times and hours only — no salary
        or bank details.
      </p>

      <div className="mt-4">
        <Button
          loading={pending}
          disabled={!canExport}
          disabledReason={
            canExport
              ? undefined
              : "Your role does not allow exporting. Ask your company owner."
          }
          onClick={() =>
            startTransition(async () => {
              const result = await exportReportAction({
                type: type as "attendance" | "leave" | "tasks",
                from,
                to,
                branchId: branchId === "all" ? undefined : branchId,
              });
              if (!result.ok) {
                show({ variant: "error", message: result.error });
                return;
              }
              // Hand the server-generated file to the browser.
              const blob = new Blob([result.csv], {
                type: "text/csv;charset=utf-8;",
              });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = result.filename;
              link.click();
              URL.revokeObjectURL(url);

              show({
                variant: "success",
                message: `${result.rows} rows exported.`,
              });
              router.refresh();
            })
          }
        >
          Export
        </Button>
      </div>
    </Card>
  );
}
