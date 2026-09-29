"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { TextArea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { STATUS } from "@/lib/status";
import { formatRupees } from "@/lib/payroll/engine";
import {
  approvePayrollAction,
  calculatePayrollAction,
} from "@/lib/payroll/actions";

/**
 * Payroll period controls and the approval impact confirm (screen A15).
 *
 * The approval modal follows the impact-confirm order: consequence →
 * what it locks → counts → errors and warnings → required reason →
 * accountant acknowledgement. The primary names the consequence and stays
 * disabled until both are supplied. Approval is a LOCKING action and says so.
 */
export function PayrollControls({
  period,
  periodLabel,
  status,
  canEdit,
  canApprove,
  employeeCount,
  netTotal,
  excluded,
  blocked,
  unreviewedExceptions,
}: {
  period: string;
  periodLabel: string;
  status: "NOT_CALCULATED" | "DRAFT" | "APPROVED";
  canEdit: boolean;
  canApprove: boolean;
  employeeCount: number;
  netTotal: number;
  excluded: string[];
  blocked: Array<{ name: string; reason: string }>;
  unreviewedExceptions: number;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const ready = reason.trim().length > 0 && acknowledged;
  const hasBlockers = blocked.length > 0;

  function calculate() {
    startTransition(async () => {
      const result = await calculatePayrollAction({ period });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  function approve() {
    startTransition(async () => {
      const result = await approvePayrollAction({
        period,
        reason: reason.trim(),
        accountantAcknowledged: acknowledged,
      });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        setConfirming(false);
        setReason("");
        setAcknowledged(false);
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-h2 text-text-primary">
                {periodLabel}
              </h2>
              <StatusChip
                status={
                  status === "APPROVED"
                    ? STATUS.locked
                    : status === "DRAFT"
                      ? STATUS.draft
                      : STATUS.notReady
                }
                size="sm"
              />
            </div>
            <p className="mt-1 text-secondary text-text-secondary">
              {status === "APPROVED"
                ? "Approved and locked. Later changes need an auditable adjustment."
                : status === "DRAFT"
                  ? "Draft — not approved. Review the figures before approving."
                  : "Not yet calculated. Payroll uses approved attendance and leave for the period."}
            </p>
            {status !== "NOT_CALCULATED" && (
              <p className="mt-2 font-mono text-data-lg font-semibold text-text-primary tabular-nums">
                {formatRupees(netTotal)}
                <span className="ml-2 font-body text-secondary font-normal text-text-secondary">
                  net for {employeeCount} employees
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {status !== "APPROVED" && (
              <Button
                variant={status === "DRAFT" ? "outline" : "primary"}
                loading={pending}
                disabled={!canEdit}
                disabledReason={
                  canEdit ? undefined : "You don't have permission to run payroll."
                }
                onClick={calculate}
              >
                {status === "DRAFT" ? "Recalculate" : "Calculate"}
              </Button>
            )}
            {status === "DRAFT" && (
              <Button
                loading={pending}
                disabled={!canApprove || hasBlockers}
                disabledReason={
                  !canApprove
                    ? "You don't have permission to approve payroll."
                    : hasBlockers
                      ? "Fix the blocked employees before approving."
                      : undefined
                }
                onClick={() => setConfirming(true)}
              >
                Review &amp; approve
              </Button>
            )}
          </div>
        </div>
      </Card>

      {hasBlockers && (
        <Alert
          variant="error"
          title={`Payroll can't be approved. ${blocked.length} employee(s) need attention.`}
        >
          {blocked.map((b) => `${b.name}: ${b.reason}`).join(" ")}
        </Alert>
      )}

      {unreviewedExceptions > 0 && status !== "APPROVED" && (
        <Alert
          variant="warning"
          title={`${unreviewedExceptions} attendance exception(s) are still unreviewed.`}
        >
          Their hours are counted as recorded. Reviewing them may change
          these figures.
        </Alert>
      )}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Approve ${periodLabel} payroll?`}
        preventEscClose
        width="review"
        footer={
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setConfirming(false)}
            >
              Keep as draft
            </Button>
            <Button
              size="lg"
              loading={pending}
              disabled={!ready}
              disabledReason={
                !ready
                  ? "Give a reason and confirm the accountant check."
                  : undefined
              }
              onClick={approve}
            >
              Approve and lock payroll
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {/* 1) consequence */}
          <Alert
            variant="warning"
            title={`Approving locks ${periodLabel} payroll for ${employeeCount} employees.`}
          >
            After this, changes need an auditable adjustment.
          </Alert>

          {/* 2) the figures. Stacked on a phone: a lakh-scale rupee amount
              at text-data-lg is about 130px, which is the whole tile. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-surface-sunken p-3">
              <p className="text-caption text-text-secondary">Net payable</p>
              <p className="font-mono text-data-lg font-semibold text-text-primary tabular-nums">
                {formatRupees(netTotal)}
              </p>
            </div>
            <div className="rounded-md bg-surface-sunken p-3">
              <p className="text-caption text-text-secondary">Payslips</p>
              <p className="font-mono text-data-lg font-semibold text-text-primary tabular-nums">
                {employeeCount}
              </p>
            </div>
          </div>

          {/* 3) exclusions, named explicitly */}
          {excluded.length > 0 && (
            <Alert
              variant="error"
              title={`${excluded.length} employee(s) will be left out.`}
            >
              {excluded.join(", ")} — no salary structure.
            </Alert>
          )}

          {/* 4) warnings */}
          {unreviewedExceptions > 0 && (
            <Alert
              variant="warning"
              title={`${unreviewedExceptions} attendance exception(s) unreviewed.`}
            >
              Their hours are counted as recorded. Reviewing them may change
              these payslips.
            </Alert>
          )}

          {/* 5) required reason */}
          <TextArea
            label="Reason"
            required
            helper="Recorded in the activity log."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="max-w-none"
          />

          {/* 6) accountant acknowledgement — never a compliance claim */}
          <Checkbox
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            label="I have checked these figures with our accountant. FlowHRMS does not certify statutory compliance."
          />

          <p className="micro-label text-text-tertiary">
            An audit event will be created
          </p>
        </div>
      </Modal>
    </>
  );
}
