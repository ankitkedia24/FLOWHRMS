"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { chooseVehicleAction, setPersonVehicleAction } from "@/lib/field-visits/conveyance-actions";

/**
 * The vehicle travel allowance is paid for (FIELD-VISITS-MODULE.md §7).
 * The person chooses once; after that an admin changes it — `membershipId`
 * set means this is the admin doing so.
 */
export function VehicleChooser({
  vehicles,
  current,
  membershipId,
}: {
  vehicles: Array<{ key: string; name: string; ratePerKm: number }>;
  current: string | null;
  membershipId?: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState(current ?? "");

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="w-full sm:w-72">
        <Select
          label="Vehicle"
          placeholder="Choose a vehicle"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          options={vehicles.map((v) => ({ value: v.key, label: `${v.name} · ₹${v.ratePerKm.toFixed(2)} per km` }))}
        />
      </div>
      <Button
        loading={pending}
        disabled={!key || key === current}
        disabledReason={!key ? "Choose a vehicle." : "That's the vehicle already set."}
        onClick={() =>
          startTransition(async () => {
            const result = membershipId
              ? await setPersonVehicleAction({ membershipId, vehicleKey: key })
              : await chooseVehicleAction({ vehicleKey: key });
            if (result.ok) {
              show({ variant: "success", message: result.detail ? `${result.message} ${result.detail}` : result.message });
              router.refresh();
            } else {
              show({ variant: "error", message: result.error });
            }
          })
        }
      >
        {membershipId ? "Change vehicle" : "Save my vehicle"}
      </Button>
    </div>
  );
}
