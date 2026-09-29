"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { publishExpensesPolicyAction } from "@/lib/expenses/policy-actions";
import {
  RECEIPT_RETENTION_FLOOR_YEARS,
  slugify,
  type ExpenseCategory,
  type ExpensesPolicy,
} from "@/lib/expenses/policy";

/**
 * The expense rules editor (EXPENSES-MODULE.md §8). Every value is the
 * tenant’s; publishing makes a new version and never rewrites a claim
 * already judged by an older one.
 */

interface CategoryDraft extends ExpenseCategory {
  /** Cap as typed, so a half-typed number is not clamped mid-keystroke. */
  capText: string;
}

function toDraft(c: ExpenseCategory): CategoryDraft {
  return { ...c, capText: c.maxClaimAmount == null ? "" : String(c.maxClaimAmount) };
}

export function ExpensesEditor({
  initial,
  published,
}: {
  initial: ExpensesPolicy;
  published: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [deadline, setDeadline] = useState(String(initial.submissionDeadlineDays));
  const [route, setRoute] = useState<ExpensesPolicy["defaultSettlementRoute"]>(
    initial.defaultSettlementRoute,
  );
  const [selfApproval, setSelfApproval] = useState(initial.allowSelfApproval);
  const [retention, setRetention] = useState(String(initial.receiptRetentionYears));
  const [categories, setCategories] = useState<CategoryDraft[]>(initial.categories.map(toDraft));

  const deadlineN = Number(deadline);
  const retentionN = Number(retention);
  const deadlineOk = Number.isInteger(deadlineN) && deadlineN >= 1;
  const retentionOk = Number.isInteger(retentionN) && retentionN >= RECEIPT_RETENTION_FLOOR_YEARS;
  const activeCount = categories.filter((c) => c.isActive && c.name.trim()).length;
  const blocker = !deadlineOk
    ? "The deadline must be at least 1 day."
    : !retentionOk
      ? `Receipts are kept for at least ${RECEIPT_RETENTION_FLOOR_YEARS} years.`
      : activeCount === 0
        ? "Keep at least one category active."
        : null;

  function update(index: number, patch: Partial<CategoryDraft>) {
    setCategories((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addCategory() {
    setCategories((rows) => [
      ...rows,
      {
        key: "",
        name: "",
        receiptRequired: true,
        maxClaimAmount: null,
        isActive: true,
        sortOrder: (rows.at(-1)?.sortOrder ?? 0) + 10,
        capText: "",
      },
    ]);
  }

  function publish() {
    startTransition(async () => {
      const result = await publishExpensesPolicyAction({
        submissionDeadlineDays: deadlineN,
        defaultSettlementRoute: route,
        allowSelfApproval: selfApproval,
        receiptRetentionYears: retentionN,
        categories: categories
          .filter((c) => c.name.trim())
          .map((c) => {
            const cap = Number(c.capText);
            return {
              key: c.key || slugify(c.name),
              name: c.name.trim(),
              receiptRequired: c.receiptRequired,
              maxClaimAmount: c.capText.trim() !== "" && Number.isFinite(cap) && cap > 0 ? cap : null,
              isActive: c.isActive,
              sortOrder: c.sortOrder,
            };
          }),
      });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Claims" />
        <div className="grid gap-1 sm:grid-cols-2">
          <Input
            label="Submission deadline"
            type="number"
            inputMode="numeric"
            min={1}
            suffix="days after the expense"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            helper="Later claims are flagged as late for the approver — never refused."
            error={deadlineOk ? undefined : "At least 1 day."}
          />
          <Input
            label="Keep receipts for"
            type="number"
            inputMode="numeric"
            min={RECEIPT_RETENTION_FLOOR_YEARS}
            suffix="years after settlement"
            value={retention}
            onChange={(event) => setRetention(event.target.value)}
            helper={`At least ${RECEIPT_RETENTION_FLOOR_YEARS} years. Your accountant confirms the legal minimum for your entity; FlowHRMS does not certify it.`}
            error={retentionOk ? undefined : `At least ${RECEIPT_RETENTION_FLOOR_YEARS} years.`}
          />
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Select
            label="Preferred settlement"
            options={[
              { value: "PAYROLL", label: "Through payroll, when Payroll is on" },
              { value: "OUTSIDE", label: "Outside payroll" },
            ]}
            value={route}
            onChange={(event) => setRoute(event.target.value as ExpensesPolicy["defaultSettlementRoute"])}
            helper="Preselected when settling. Without Payroll, outside payroll is the only route."
          />
          <div className="pt-6">
            <Checkbox
              label="Allow approving your own claim"
              helper="Off by default. When on, self-approvals are marked as such on the record."
              checked={selfApproval}
              onChange={(event) => setSelfApproval(event.target.checked)}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Categories"
          meta="What people can claim for, and whether each needs a receipt"
          action={
            <Button size="sm" variant="outline" onClick={addCategory}>
              Add category
            </Button>
          }
        />
        <ul className="flex flex-col divide-y divide-border-subtle">
          {categories.map((c, index) => (
            <li key={c.key || `new-${index}`} className="grid gap-2 py-3 first:pt-0 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
              <Input
                label="Name"
                value={c.name}
                onChange={(event) => update(index, { name: event.target.value })}
                placeholder="Fuel"
              />
              <Input
                label="Cap"
                optional
                type="number"
                inputMode="decimal"
                min={0}
                prefix="₹"
                value={c.capText}
                onChange={(event) => update(index, { capText: event.target.value })}
                className="sm:w-36"
              />
              <div className="pb-1">
                <Checkbox
                  label="Receipt required"
                  checked={c.receiptRequired}
                  onChange={(event) => update(index, { receiptRequired: event.target.checked })}
                />
              </div>
              <div className="pb-1">
                <Checkbox
                  label="Active"
                  checked={c.isActive}
                  onChange={(event) => update(index, { isActive: event.target.checked })}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-caption text-text-secondary">
          Retire a category by unticking Active — old claims keep its name. A cap flags a claim above it; it never refuses one.
        </p>
      </Card>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Button
          size="lg"
          loading={pending}
          disabled={Boolean(blocker)}
          disabledReason={blocker ?? undefined}
          onClick={publish}
        >
          {published ? "Publish new version" : "Publish"}
        </Button>
        <p className="text-caption text-text-secondary">
          Claims already submitted keep the rules that applied when they were sent.
        </p>
      </div>
    </div>
  );
}
