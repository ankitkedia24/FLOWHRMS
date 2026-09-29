"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { Table } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { bulkSetSalariesAction } from "@/lib/payroll/structure-actions";

/**
 * Everyone's pay on one screen, one number each.
 *
 * A blank input means "leave them as they are" — only filled rows are
 * saved, together, effective from one shared date. This is the whole
 * payroll setup for a simple-mode company.
 */

export interface BulkRow {
  membershipId: string;
  name: string;
  /** Formatted current pay, e.g. "₹18,000" — or null when none is set. */
  currentPay: string | null;
  /** The latest structure exists but is not the simple/pack shape. */
  isCustomShape: boolean;
}

export function BulkSalariesTable({ rows }: { rows: BulkRow[] }) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const filled = rows.filter((row) => {
    const raw = values[row.membershipId];
    return raw != null && raw.trim() !== "" && Number(raw) > 0;
  });

  function submit() {
    startTransition(async () => {
      const result = await bulkSetSalariesAction({
        effectiveFrom,
        rows: filled.map((row) => ({
          membershipId: row.membershipId,
          monthlySalary: Number(values[row.membershipId]),
        })),
      });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        setValues({});
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  // No `id`: the Table renders the mobile cards AND the desktop table into
  // the DOM (visibility is CSS), so an id here would exist twice on the
  // page. The accessible name is the aria-label, identical in both places.
  function salaryInput(row: BulkRow) {
    return (
      <input
        type="number"
        inputMode="numeric"
        min={0}
        placeholder={row.currentPay ? "" : "0"}
        aria-label={`Monthly salary for ${row.name}`}
        value={values[row.membershipId] ?? ""}
        onChange={(e) =>
          setValues((prev) => ({ ...prev, [row.membershipId]: e.target.value }))
        }
        className="h-11 w-32 rounded-input border-[1.5px] border-border-default bg-surface-default px-3 text-right font-mono text-data text-text-primary tabular-nums hover:border-border-strong"
      />
    );
  }

  function currentPayCell(row: BulkRow) {
    if (row.isCustomShape) {
      return (
        <StatusChip
          status={{ key: "custom-pay", label: "Custom", tone: "info" }}
          size="sm"
        />
      );
    }
    return row.currentPay ?? "—";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-[240px]">
        <Input
          label="Effective from"
          type="date"
          required
          helper="Applies to every salary you save below."
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
        />
      </div>

      <Table
        caption="Monthly salary per employee"
        rows={rows}
        rowKey={(row) => row.membershipId}
        columns={[
          {
            key: "employee",
            header: "Employee",
            rowHeader: true,
            render: (row) => row.name,
          },
          {
            key: "current",
            header: "Current pay",
            numeric: true,
            render: (row) => currentPayCell(row),
          },
          {
            key: "salary",
            header: "New monthly salary (₹)",
            numeric: true,
            render: (row) => salaryInput(row),
          },
        ]}
        renderMobileCard={(row) => (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-body font-semibold text-text-primary">
                {row.name}
              </p>
              <p className="text-caption text-text-secondary">
                {row.isCustomShape ? "Custom pay" : (row.currentPay ?? "No salary set")}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-secondary text-text-secondary">
                New monthly salary
              </span>
              {salaryInput(row)}
            </div>
          </Card>
        )}
      />

      <div>
        <Button
          size="lg"
          loading={pending}
          disabled={!effectiveFrom || filled.length === 0}
          disabledReason={
            !effectiveFrom
              ? "Pick the date these salaries start from."
              : filled.length === 0
                ? "Enter at least one salary. Blank rows are left unchanged."
                : undefined
          }
          onClick={submit}
        >
          {filled.length > 1
            ? `Save ${filled.length} salaries`
            : "Save salary"}
        </Button>
        <p className="mt-2 text-caption text-text-secondary">
          Blank rows are left unchanged. Earlier salaries are kept as
          history, never overwritten.
        </p>
      </div>
    </div>
  );
}
