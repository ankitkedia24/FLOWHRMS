"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, TextArea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { submitClaimAction } from "@/lib/expenses/actions";
import { RECEIPT_ACCEPT, RECEIPT_MAX_FILES } from "@/lib/expenses/bucket";
import { formatAmount } from "@/lib/expenses/format";
import { daysBetween, isIsoDate } from "@/lib/expenses/state";
import { uploadReceipt } from "@/lib/expenses/upload";

export interface CategoryOption {
  key: string;
  name: string;
  receiptRequired: boolean;
  maxClaimAmount: number | null;
}

/**
 * Submit a claim (EXPENSES-MODULE.md §2, §10.1). Submit-only in E1: no
 * drafts. Warnings — late, over cap — are shown BEFORE sending so the
 * person knows what the approver will see; nothing here refuses them.
 */
export function ClaimForm({
  tenantId,
  categories,
  deadlineDays,
  today,
}: {
  tenantId: string;
  categories: CategoryOption[];
  deadlineDays: number;
  today: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [categoryKey, setCategoryKey] = useState(categories[0]?.key ?? "");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const category = categories.find((c) => c.key === categoryKey) ?? null;
  const parsedAmount = Number(amount);
  const amountOk = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const dateOk = isIsoDate(expenseDate) && expenseDate <= today;
  const late = dateOk ? daysBetween(expenseDate, today) > deadlineDays : false;
  const overCap =
    amountOk && category?.maxClaimAmount != null && parsedAmount > category.maxClaimAmount;
  const needsReceipt = Boolean(category?.receiptRequired) && files.length === 0;

  const blocker = !category
    ? "Choose a category."
    : !amountOk
      ? "Enter the amount."
      : !dateOk
        ? "Choose the date of the expense."
        : !description.trim()
          ? "Say what it was for."
          : needsReceipt
            ? `${category.name} needs a receipt.`
            : null;

  function reset() {
    setAmount("");
    setExpenseDate("");
    setDescription("");
    setFiles([]);
    setOpen(false);
  }

  function submit() {
    if (blocker || !category) return;
    startTransition(async () => {
      const draftId = crypto.randomUUID();
      const receipts: Array<{ path: string; name: string; mime: string; sizeBytes: number }> = [];
      for (const file of files) {
        const uploaded = await uploadReceipt(tenantId, draftId, file);
        if (!uploaded.ok) {
          show({ variant: "error", message: uploaded.error });
          return;
        }
        receipts.push(uploaded);
      }
      const result = await submitClaimAction({
        categoryKey: category.key,
        amount: parsedAmount,
        expenseDate,
        description: description.trim(),
        receipts: receipts as Parameters<typeof submitClaimAction>[0]["receipts"],
      });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        reset();
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  if (!open) {
    return (
      <Button size="xl" onClick={() => setOpen(true)}>
        New claim
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader title="New expense claim" meta="Goes to your approvers" />
      <div className="flex flex-col gap-1">
        <Select
          label="Category"
          options={categories.map((c) => ({ value: c.key, label: c.name }))}
          value={categoryKey}
          onChange={(event) => setCategoryKey(event.target.value)}
          helper={
            category
              ? `${category.receiptRequired ? "Receipt required" : "Receipt optional"}${
                  category.maxClaimAmount != null ? ` · cap ${formatAmount(category.maxClaimAmount)}` : ""
                }`
              : undefined
          }
        />
        <Input
          label="Amount"
          required
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          prefix="₹"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={amount.trim() !== "" && !amountOk ? "Enter an amount above zero." : undefined}
        />
        <Input
          label="Date of expense"
          required
          type="date"
          max={today}
          value={expenseDate}
          onChange={(event) => setExpenseDate(event.target.value)}
          error={expenseDate && !dateOk ? "Choose a date up to today." : undefined}
        />
        <TextArea
          label="What it was for"
          required
          placeholder="Diesel for the site run to Bhiwandi"
          maxLength={300}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="max-w-none"
        />

        <div className="mt-2">
          <label htmlFor="claim-receipts" className="mb-1.5 block text-label text-text-primary">
            Receipt{" "}
            <span className="font-normal text-text-secondary">
              {category?.receiptRequired ? "Required" : "Optional"} · JPG, PNG or PDF · up to{" "}
              {RECEIPT_MAX_FILES} files, 10 MB each
            </span>
          </label>
          <input
            id="claim-receipts"
            type="file"
            multiple
            accept={RECEIPT_ACCEPT}
            capture="environment"
            className="block w-full text-body file:mr-3 file:min-h-11 file:rounded-button file:border-0 file:bg-brand-primary-subtle file:px-4 file:font-heading file:text-label file:text-brand-primary"
            onChange={(event) =>
              setFiles(Array.from(event.target.files ?? []).slice(0, RECEIPT_MAX_FILES))
            }
          />
          {files.length > 0 && (
            <ul className="mt-1 text-caption text-text-secondary">
              {files.map((f) => (
                <li key={`${f.name}-${f.size}`}>
                  {f.name} · {(f.size / 1024).toFixed(0)} KB
                </li>
              ))}
            </ul>
          )}
        </div>

        {(late || overCap) && (
          <div className="mt-2 flex flex-col gap-2">
            {late && (
              <Alert
                variant="consequence"
                title={`This is ${daysBetween(expenseDate, today)} days after the expense — over the ${deadlineDays}-day deadline.`}
              >
                It will be flagged as late for the approver. It can still be approved.
              </Alert>
            )}
            {overCap && category?.maxClaimAmount != null && (
              <Alert
                variant="consequence"
                title={`Above the ${formatAmount(category.maxClaimAmount)} cap for ${category.name}.`}
              >
                It will be flagged for the approver. It can still be approved.
              </Alert>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 md:flex-row">
        <Button
          size="lg"
          loading={pending}
          disabled={Boolean(blocker)}
          disabledReason={blocker ?? undefined}
          onClick={submit}
        >
          Send for approval
        </Button>
        <Button size="lg" variant="outline" onClick={reset}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
