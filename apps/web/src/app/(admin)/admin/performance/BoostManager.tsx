"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createBoostAction, deleteBoostAction } from "@/lib/performance/actions";

interface BoostRow {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

/**
 * Double-points windows (PERFORMANCE-MODULE.md §C): declare a date range,
 * every point in it counts twice, the Home widget announces it. Removing
 * a window never claws back points already paid — history is history.
 */
export function BoostManager({ boosts }: { boosts: BoostRow[] }) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function create() {
    startTransition(async () => {
      const result = await createBoostAction({ name, startDate, endDate });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        setName("");
        setStartDate("");
        setEndDate("");
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  function remove(boostId: string) {
    startTransition(async () => {
      const result = await deleteBoostAction({ boostId });
      show(result.ok
        ? { variant: "success", message: result.message }
        : { variant: "error", message: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {boosts.length > 0 && (
        <ul className="flex flex-col divide-y divide-border-subtle">
          {boosts.map((boost) => (
            <li
              key={boost.id}
              className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-body font-semibold text-text-primary">
                  ×2 — {boost.name}
                  {boost.active && (
                    <span className="ml-2 rounded-pill bg-[color:var(--fh-color-status-warning-bg)] px-2 py-0.5 text-caption font-semibold text-status-warning-fg">
                      live now
                    </span>
                  )}
                </p>
                <p className="text-caption text-text-secondary">
                  {boost.startDate} to {boost.endDate}
                </p>
              </div>
              <Button variant="secondary" size="sm" loading={pending} onClick={() => remove(boost.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          label="Why"
          placeholder="Festival rush"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="From"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input label="To" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
      <div>
        <Button loading={pending} onClick={create}>
          Declare double points
        </Button>
        <p className="mt-2 text-caption text-text-secondary">
          Every point in the window counts twice, and the ledger line says so. Removing a window
          never takes back points already paid.
        </p>
      </div>
    </div>
  );
}
