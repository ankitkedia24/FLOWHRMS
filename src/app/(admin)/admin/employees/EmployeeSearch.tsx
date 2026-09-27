"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";

/**
 * Directory search (component-specifications.md §4).
 * - Searches name AND phone number: SME admins look people up by phone.
 * - Debounced 250 ms, minimum 2 characters.
 * - The query lives in the URL so a filtered list can be shared.
 * - The result count is announced politely by the page.
 */
export function EmployeeSearch({
  initialQuery,
  showInactive,
  resultCount,
}: {
  initialQuery: string;
  showInactive: boolean;
  resultCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(initialQuery);

  useEffect(() => {
    if (value === initialQuery) return;
    // Below 2 characters we clear rather than search, per the spec.
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim().length >= 2) params.set("q", value.trim());
      else params.delete("q");
      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [value, initialQuery, pathname, router, searchParams]);

  function toggleInactive(checked: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (checked) params.set("status", "all");
    else params.delete("status");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-6">
      <div className="md:w-80">
        <Input
          label="Search"
          type="search"
          role="searchbox"
          placeholder="Search employee or phone…"
          autoComplete="off"
          prefix={<Search aria-hidden="true" className="size-4" />}
          helper="Name, phone number or employee code."
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <div className="pb-1">
        <Checkbox
          checked={showInactive}
          onChange={(e) => toggleInactive(e.target.checked)}
          label="Include people who have left"
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {resultCount} {resultCount === 1 ? "person" : "people"} found
      </p>
    </div>
  );
}
