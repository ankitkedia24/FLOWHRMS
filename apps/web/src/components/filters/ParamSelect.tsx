"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui/Select";

/**
 * A filter whose choice lives in the URL (`?dept=<id>`, `?month=2026-09`),
 * like BranchFilter: shareable, deep-linkable, and `replace` so Back does
 * not walk through every choice tried. The server re-checks the value
 * before it reaches a query.
 */
export function ParamSelect({
  param,
  label,
  options,
  selected,
  allLabel,
  className = "w-full sm:w-56",
}: {
  param: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string | null;
  /** Offers "all" (no parameter) as the first choice. */
  allLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <div className={className}>
      <Select
        label={label}
        value={selected ?? "all"}
        disabled={pending}
        options={[...(allLabel ? [{ value: "all", label: allLabel }] : []), ...options]}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          if (event.target.value === "all") params.delete(param);
          else params.set(param, event.target.value);
          const query = params.toString();
          startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
        }}
      />
    </div>
  );
}
