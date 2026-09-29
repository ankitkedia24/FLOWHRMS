"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { setMonthlySalaryAction } from "@/lib/payroll/structure-actions";

/**
 * Set someone's pay from their own profile — where an owner actually
 * thinks about a person, rather than on a payroll configuration screen.
 *
 * Deliberately does NOT show the current salary: reading pay is a separate,
 * audited act (the reveal in SensitivePanel writes employee.salary_viewed),
 * and this card must not become an unaudited way around that.
 */
export function SetSalaryCard({
  membershipId,
  employeeName,
  isCustomSetup,
}: {
  membershipId: string;
  employeeName: string;
  isCustomSetup: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [salary, setSalary] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");

  if (isCustomSetup) {
    return (
      <Card>
        <CardHeader title="Salary" />
        <p className="text-secondary text-text-secondary">
          This company uses custom pay items, so salaries are set item by
          item on the{" "}
          <Link
            href="/admin/payroll/salaries"
            className="text-brand-primary underline-offset-2 hover:underline"
          >
            Salaries page
          </Link>
          .
        </p>
      </Card>
    );
  }

  function submit() {
    startTransition(async () => {
      const result = await setMonthlySalaryAction({
        membershipId,
        monthlySalary: Number(salary),
        effectiveFrom,
      });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        setSalary("");
        setEffectiveFrom("");
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Salary"
        meta={`What ${employeeName.split(/\s+/)[0]} is paid per month, reduced for unpaid days.`}
      />
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-3">
        <div className="sm:w-48">
          <Input
            label="Monthly salary"
            type="number"
            inputMode="numeric"
            required
            prefix="₹"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
          />
        </div>
        <div className="sm:w-48">
          <Input
            label="Effective from"
            type="date"
            required
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </div>
        <div className="pb-1">
          <Button
            loading={pending}
            disabled={!effectiveFrom || Number(salary) <= 0}
            disabledReason={
              Number(salary) <= 0
                ? "Enter the monthly salary."
                : !effectiveFrom
                  ? "Pick the date it starts from."
                  : undefined
            }
            onClick={submit}
          >
            Save salary
          </Button>
        </div>
      </div>
      <p className="mt-2 text-caption text-text-secondary">
        Earlier salaries are kept as history. Saving is recorded in the
        activity log.
      </p>
    </Card>
  );
}
