"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { ImpactConfirm } from "@/components/modules/ImpactConfirm";
import { setFeatureEnabledAction, setModuleEnabledAction } from "@/lib/modules/actions";
import type { ModuleKey } from "@/lib/catalog";

/**
 * Governed module switch (decision D-013).
 *
 * The switch NEVER flips optimistically:
 * - turning off opens the impact confirm first;
 * - while the server call is in flight the knob shows a spinner and the
 *   state word becomes "Saving…";
 * - on success the page revalidates and the switch renders the server's
 *   truth; on failure it stays as it was, with a plain reason in a toast.
 */
export function ModuleSwitch({
  moduleKey,
  moduleName,
  enabled,
  core = false,
  locked = false,
  lockedReason,
  impact,
  affectedEmployees,
  affectedAdmins,
}: {
  moduleKey: ModuleKey;
  moduleName: string;
  enabled: boolean;
  core?: boolean;
  locked?: boolean;
  lockedReason?: string;
  impact: {
    sentence: string;
    stops: string[];
    retention: string;
    typedConfirm: string;
  };
  affectedEmployees: number;
  affectedAdmins: number;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (core) {
    return (
      <Switch
        checked
        label={`${moduleName} module`}
        locked
        disabledReason="Core platform capability — always on."
      />
    );
  }

  function apply(next: boolean, reason?: string, typedConfirm?: string) {
    startTransition(async () => {
      const result = await setModuleEnabledAction({
        moduleKey,
        enabled: next,
        reason,
        typedConfirm,
      });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        setConfirming(false);
        router.refresh(); // switch re-renders from server truth
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  return (
    <>
      <Switch
        checked={enabled}
        pending={pending}
        locked={locked}
        disabledReason={lockedReason}
        label={`${moduleName} module`}
        onChange={(next) => {
          if (next) apply(true);
          else setConfirming(true);
        }}
      />

      <ImpactConfirm
        open={confirming}
        onClose={() => setConfirming(false)}
        moduleName={moduleName}
        typedConfirm={impact.typedConfirm}
        sentence={impact.sentence}
        stops={impact.stops}
        retention={impact.retention}
        affectedEmployees={affectedEmployees}
        affectedAdmins={affectedAdmins}
        pending={pending}
        onConfirm={({ reason, typedConfirm }) =>
          apply(false, reason, typedConfirm)
        }
      />
    </>
  );
}

/** Feature-level switch inside a module card. */
export function FeatureSwitch({
  moduleKey,
  featureKey,
  featureName,
  enabled,
}: {
  moduleKey: ModuleKey;
  featureKey: string;
  featureName: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Switch
      checked={enabled}
      pending={pending}
      label={featureName}
      className="min-h-11 py-1"
      onChange={(next) =>
        startTransition(async () => {
          const result = await setFeatureEnabledAction({
            moduleKey,
            featureKey,
            enabled: next,
          });
          if (result.ok) {
            show({ variant: "success", message: result.message });
            router.refresh();
          } else {
            show({ variant: "error", message: result.error });
          }
        })
      }
    />
  );
}
