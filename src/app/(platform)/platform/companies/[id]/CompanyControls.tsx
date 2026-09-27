"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import {
  convertToPaidAction,
  endTrialAction,
  extendTrialAction,
  setCompanyModuleAction,
  verifyOwnerEmailAction,
} from "@/lib/platform/company-actions";

type Result = { ok: true; message: string } | { ok: false; error: string };

function useRun() {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<Result>, after?: () => void) {
    startTransition(async () => {
      const r = await action();
      show({ variant: r.ok ? "success" : "error", message: r.ok ? r.message : r.error });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  }
  return { pending, run };
}

export function TrialControls({
  tenantId,
  plan,
}: {
  tenantId: string;
  plan: "TRIAL" | "PAID" | "INTERNAL";
}) {
  const { pending, run } = useRun();
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-label text-text-primary">
          {plan === "TRIAL" ? "Extend the trial" : "Put on a trial"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[7, 15, 30].map((days) => (
            <Button key={days} size="sm" variant="outline" loading={pending} onClick={() => run(() => extendTrialAction({ tenantId, days }))}>
              +{days} days
            </Button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Input label="Or until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          <Button size="sm" variant="outline" loading={pending} disabled={!until} onClick={() => run(() => extendTrialAction({ tenantId, until }), () => setUntil(""))}>
            Set end date
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-border-subtle pt-4">
        {plan !== "PAID" && (
          <Button size="sm" loading={pending} onClick={() => run(() => convertToPaidAction({ tenantId }))}>
            Convert to paid plan
          </Button>
        )}
        {plan === "TRIAL" && (
          <>
            <Input label="Reason to end the trial now" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button size="sm" variant="dangerSubtle" loading={pending} disabled={!reason.trim()} onClick={() => run(() => endTrialAction({ tenantId, reason }), () => setReason(""))}>
              End trial now
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function ModuleControls({
  tenantId,
  modules,
}: {
  tenantId: string;
  modules: Array<{ key: string; name: string; category: string; enabled: boolean; allowed: boolean }>;
}) {
  const { pending, run } = useRun();
  return (
    <ul className="flex flex-col">
      {modules.map((m) => (
        <li key={m.key} className="flex items-center justify-between gap-3 border-b border-border-subtle py-2.5 last:border-0">
          <div className="min-w-0">
            <p className="text-body text-text-primary">{m.name}</p>
            <p className="text-caption text-text-secondary">
              {m.enabled ? "Included — on" : m.allowed ? "Included — switched off by the company" : "Not in plan"}
              {m.category === "OPTIONAL" ? " · optional module" : ""}
            </p>
          </div>
          <Switch
            label={`${m.name} for this company`}
            checked={m.enabled}
            disabled={pending}
            onChange={(next) => run(() => setCompanyModuleAction({ tenantId, moduleKey: m.key, enabled: next }))}
          />
        </li>
      ))}
    </ul>
  );
}

export function VerifyEmailControl({ tenantId }: { tenantId: string }) {
  const { pending, run } = useRun();
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Input
        label="Confirmed the owner's email another way?"
        placeholder="Spoke to them on +91…, they confirmed the address"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button size="sm" variant="outline" loading={pending} disabled={!reason.trim()} onClick={() => run(() => verifyOwnerEmailAction({ tenantId, reason }))}>
        Mark email confirmed
      </Button>
    </div>
  );
}
