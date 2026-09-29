"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui/Select";
import type { BranchOption } from "@/lib/branches/filter";

/**
 * "All branches ▾" — the location filter from the approved admin designs.
 *
 * The selection lives in the URL (`?branch=<id>`) so a filtered queue can
 * be shared and deep-linked, matching the pattern already used by the
 * payroll period. `replace` rather than `push`, so Back does not walk
 * through every filter state the viewer tried.
 *
 * Renders nothing for a single-location company — a filter with one
 * option is noise.
 */
export function BranchFilter({
  options,
  selected,
  label = "Location",
}: {
  options: BranchOption[];
  selected: string | null;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (options.length < 2) return null;

  return (
    // The Select fills its container, so the container carries the width.
    <div className="w-full sm:w-56">
      <Select
        label={label}
        value={selected ?? "all"}
        disabled={pending}
        options={[
          { value: "all", label: "All branches" },
          ...options.map((option) => ({
            value: option.id,
            label: option.name,
          })),
        ]}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          if (event.target.value === "all") params.delete("branch");
          else params.set("branch", event.target.value);
          const query = params.toString();
          startTransition(() => {
            router.replace(query ? `${pathname}?${query}` : pathname);
          });
        }}
      />
    </div>
  );
}
