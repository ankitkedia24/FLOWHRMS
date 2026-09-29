"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { saveSellerAction } from "@/lib/billing/platform-actions";
import type { SellerSettings } from "@/lib/billing/seller";

export function SellerForm({ seller, states }: { seller: SellerSettings; states: string[] }) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState<SellerSettings>(seller);
  const set = (k: keyof SellerSettings) => (value: string) => setV((s) => ({ ...s, [k]: value }));

  return (
    <div className="flex flex-col gap-3">
      <Input label="Legal name" helper="As on the GST registration" value={v.legalName} onChange={(e) => set("legalName")(e.target.value)} />
      <Input label="Trade name" optional value={v.tradeName} onChange={(e) => set("tradeName")(e.target.value)} />
      <Input
        label="GSTIN"
        value={v.gstin}
        maxLength={15}
        onChange={(e) => set("gstin")(e.target.value.toUpperCase())}
      />
      <Input label="Address" value={v.address} onChange={(e) => set("address")(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="City" value={v.city} onChange={(e) => set("city")(e.target.value)} />
        <Input
          label="Pincode"
          inputMode="numeric"
          value={v.pincode}
          onChange={(e) => set("pincode")(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
      </div>
      <Select
        label="State"
        helper="Must match the GSTIN. Decides CGST+SGST (same state) or IGST."
        value={v.state}
        placeholder="Choose the state"
        onChange={(e) => set("state")(e.target.value)}
        options={states.map((s) => ({ value: s, label: s }))}
      />
      <Input
        label="SAC code"
        helper="For the subscription service. Confirm with your CA."
        inputMode="numeric"
        value={v.sac}
        onChange={(e) => set("sac")(e.target.value.replace(/\D/g, "").slice(0, 8))}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Billing email" type="email" value={v.email} onChange={(e) => set("email")(e.target.value)} />
        <Input label="Billing phone" value={v.phone} onChange={(e) => set("phone")(e.target.value)} />
      </div>
      <div>
        <Button
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await saveSellerAction({ ...v });
              show({ variant: r.ok ? "success" : "error", message: r.ok ? r.message : r.error });
              if (r.ok) router.refresh();
            })
          }
        >
          Save invoice details
        </Button>
      </div>
    </div>
  );
}
