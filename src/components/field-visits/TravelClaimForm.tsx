"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input, TextArea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { claimTravelAction } from "@/lib/field-visits/conveyance-actions";
import { checkClaimedKm, travelAmount } from "@/lib/field-visits/state";

/**
 * Claim a month's travel (FIELD-VISITS-MODULE.md §7). The recorded
 * kilometres are the claim; a different figure needs a reason, and the
 * approver sees both.
 */
export function TravelClaimForm({
  month,
  monthLabel,
  recordedKm,
  ratePerKm,
  vehicleName,
}: {
  month: string;
  monthLabel: string;
  recordedKm: number;
  ratePerKm: number;
  vehicleName: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [changing, setChanging] = useState(recordedKm === 0);
  const [kmText, setKmText] = useState(recordedKm === 0 ? "" : String(recordedKm));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const km = changing ? Number(kmText) : recordedKm;
  const check = checkClaimedKm(recordedKm, km, reason);
  // The amount follows the kilometres as typed; the reason is checked on sending.
  const amount = Number.isFinite(km) && km > 0 ? travelAmount(Math.round(km * 10) / 10, ratePerKm) : null;
  const money = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-body">
        <dt className="text-text-secondary">Recorded</dt>
        <dd className="text-right font-mono tabular-nums text-text-primary">{recordedKm} km</dd>
        <dt className="text-text-secondary">Rate</dt>
        <dd className="text-right text-text-primary">
          ₹{ratePerKm.toFixed(2)} per km · {vehicleName}
        </dd>
        <dt className="border-t border-border-subtle pt-2 font-semibold text-text-primary">Amount</dt>
        <dd className="border-t border-border-subtle pt-2 text-right font-mono font-semibold tabular-nums text-text-primary">
          {amount === null ? "—" : money(amount)}
        </dd>
      </dl>

      {recordedKm > 0 && (
        <Checkbox
          label="Claim a different number of kilometres"
          helper="For a detour or a stretch without location. Your approver sees both figures and your reason."
          checked={changing}
          onChange={(e) => {
            setChanging(e.target.checked);
            setKmText(String(recordedKm));
            setError(null);
          }}
        />
      )}
      {changing && (
        <div className="grid gap-1 sm:grid-cols-[12rem_1fr]">
          <Input
            label="Kilometres"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            suffix="km"
            value={kmText}
            onChange={(e) => {
              setKmText(e.target.value);
              setError(null);
            }}
          />
          <TextArea
            label="Why"
            rows={2}
            maxLength={300}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            helper={recordedKm === 0 ? "No distance was recorded this month — say why, and how you worked out the kilometres." : undefined}
          />
        </div>
      )}
      {error && <p className="text-caption text-status-error-text">{error}</p>}

      <Button
        size="lg"
        loading={pending}
        className="self-start"
        onClick={() => {
          if (!check.ok) {
            setError(check.error);
            return;
          }
          startTransition(async () => {
            const result = await claimTravelAction({ month, claimedKm: check.km, reason: reason.trim() || undefined });
            if (result.ok) {
              show({ variant: "success", message: result.detail ? `${result.message} ${result.detail}` : result.message });
              router.push(result.claimId ? `/expenses/${result.claimId}` : "/expenses");
            } else {
              setError(result.error);
            }
          });
        }}
      >
        Claim travel for {monthLabel}
      </Button>
    </div>
  );
}
