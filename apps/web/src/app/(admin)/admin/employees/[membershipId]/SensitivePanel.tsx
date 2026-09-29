"use client";

import { useState, useTransition } from "react";
import { EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { revealSensitiveAction } from "@/lib/employees/actions";

/**
 * Salary and bank details (Constitution §7).
 *
 * These are never rendered inline "just in case". They need the specific
 * permission AND a deliberate action, and revealing one is recorded in the
 * activity log — which the screen says before you press it.
 */
export function SensitivePanel({
  membershipId,
  canSeeSalary,
  canSeeBank,
}: {
  membershipId: string;
  canSeeSalary: boolean;
  canSeeBank: boolean;
}) {
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useState<
    Record<string, Array<{ label: string; value: string }>>
  >({});

  if (!canSeeSalary && !canSeeBank) return null;

  function reveal(kind: "salary" | "bank") {
    startTransition(async () => {
      const result = await revealSensitiveAction({ membershipId, kind });
      if (result.ok) setShown((prev) => ({ ...prev, [kind]: result.lines }));
      else show({ variant: "error", message: result.error });
    });
  }

  const blocks = [
    canSeeSalary && { kind: "salary" as const, title: "Salary" },
    canSeeBank && { kind: "bank" as const, title: "Bank details" },
  ].filter(Boolean) as Array<{ kind: "salary" | "bank"; title: string }>;

  return (
    <Card>
      <CardHeader
        title="Sensitive information"
        meta="Opening these is recorded in the activity log."
      />
      <div className="flex flex-col gap-4">
        {blocks.map((block) => (
          <div key={block.kind}>
            <p className="flex items-center gap-2 text-label text-text-primary">
              <EyeOff aria-hidden="true" className="size-4" />
              {block.title}
            </p>
            {shown[block.kind] ? (
              <dl className="mt-2 flex flex-col gap-1">
                {shown[block.kind].map((line) => (
                  <div
                    key={line.label}
                    className="flex items-center justify-between gap-3 border-b border-border-subtle pb-1.5 last:border-0"
                  >
                    <dt className="text-secondary text-text-secondary">
                      {line.label}
                    </dt>
                    <dd className="font-mono text-data text-text-primary tabular-nums">
                      {line.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  loading={pending}
                  onClick={() => reveal(block.kind)}
                >
                  Show {block.title.toLowerCase()}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
