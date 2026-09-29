"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input, TextArea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

/**
 * Impact confirm modal (component-specifications.md §18, the FlowHRMS
 * signature). Content order is fixed:
 *   1) plain consequence sentence
 *   2) what stops working
 *   3) affected employee / admin counts
 *   4) data-retention reassurance
 *   5) required reason
 *   6) typed confirmation, and the primary names the consequence
 *
 * It is never shortened on mobile.
 */
export interface ImpactConfirmProps {
  open: boolean;
  onClose: () => void;
  moduleName: string;
  /** Token the operator must type, e.g. "ATTENDANCE". */
  typedConfirm: string;
  sentence: string;
  stops: string[];
  affectedEmployees: number;
  affectedAdmins: number;
  retention: string;
  pending: boolean;
  onConfirm: (input: { reason: string; typedConfirm: string }) => void;
}

export function ImpactConfirm({
  open,
  onClose,
  moduleName,
  typedConfirm,
  sentence,
  stops,
  affectedEmployees,
  affectedAdmins,
  retention,
  pending,
  onConfirm,
}: ImpactConfirmProps) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");

  const ready = reason.trim().length > 0 && typed.trim() === typedConfirm;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Turn off ${moduleName}?`}
      preventEscClose
      width="review"
      footer={
        <>
          <Button variant="outline" size="lg" onClick={onClose}>
            Keep {moduleName} on
          </Button>
          <Button
            variant="danger"
            size="lg"
            loading={pending}
            disabled={!ready}
            disabledReason={
              !ready
                ? `Type ${typedConfirm} and give a reason to continue.`
                : undefined
            }
            onClick={() => onConfirm({ reason: reason.trim(), typedConfirm: typed.trim() })}
          >
            Turn off {moduleName}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* 1) consequence */}
        <Alert variant="warning" title={sentence} />

        {/* 2) what stops */}
        <section>
          <h3 className="micro-label mb-2 text-text-tertiary">
            What stops immediately
          </h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-text-primary">
            {stops.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {/* 3) affected counts */}
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-surface-sunken p-3">
            <p className="text-caption text-text-secondary">
              Employees affected
            </p>
            <p className="font-mono text-data-lg font-semibold text-text-primary tabular-nums">
              {affectedEmployees}
            </p>
          </div>
          <div className="rounded-md bg-surface-sunken p-3">
            <p className="text-caption text-text-secondary">
              Admin users affected
            </p>
            <p className="font-mono text-data-lg font-semibold text-text-primary tabular-nums">
              {affectedAdmins}
            </p>
          </div>
        </section>

        {/* 4) retention reassurance */}
        <p className="text-body text-text-primary">{retention}</p>

        {/* 5) required reason */}
        <TextArea
          label="Reason"
          required
          helper="Recorded in the activity log."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="max-w-none"
        />

        {/* 6) typed confirmation */}
        <Input
          label={`Type ${typedConfirm} to confirm`}
          required
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="max-w-none"
          autoComplete="off"
        />

        <p className="micro-label text-text-tertiary">
          An audit event will be created
        </p>
      </div>
    </Modal>
  );
}
