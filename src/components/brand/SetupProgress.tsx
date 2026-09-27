"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { FlowacordMark } from "@/components/brand/FlowacordMark";
import { cn } from "@/lib/cn";

/**
 * What someone sees while their company is being created — about 5–10
 * seconds of real work (roles, permissions, modules, the trial).
 *
 * A bare spinner for that long reads as "stuck". Named steps that tick
 * over say something is happening and what. The steps are paced, not
 * reported by the server: the creation is one transaction, so there is no
 * honest mid-point to report. The last step therefore stays "in progress"
 * until the caller replaces this component with the result.
 *
 * The mark itself is never animated (BRAND-GUIDELINES.md: no effects on
 * the mark). A ring turns around it instead, and only when the person has
 * not asked for reduced motion.
 */
export function SetupProgress({
  companyName,
  steps,
  stepMs = 1600,
}: {
  companyName: string;
  steps?: string[];
  stepMs?: number;
}) {
  const list = steps ?? [
    `Creating ${companyName.trim() || "your company"}`,
    "Setting up roles and permissions",
    "Switching on your modules",
    "Preparing your 30-day trial",
  ];
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (current >= list.length - 1) return;
    const timer = setTimeout(() => setCurrent((c) => c + 1), stepMs);
    return () => clearTimeout(timer);
  }, [current, list.length, stepMs]);

  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="relative flex size-24 items-center justify-center">
        <svg
          viewBox="0 0 100 100"
          aria-hidden="true"
          className="absolute inset-0 size-24 motion-safe:animate-spin [animation-duration:1.4s]"
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="6"
            className="stroke-brand-primary-subtle"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="70 213"
            className="stroke-brand-primary"
          />
        </svg>
        <FlowacordMark size={40} />
      </div>

      <h2 className="mt-5 font-heading text-h2 text-text-primary">
        Setting up your company
      </h2>
      <p className="mt-1 text-secondary text-text-secondary">
        This takes a few seconds. Please keep this page open.
      </p>

      <ol className="mt-6 flex w-full max-w-[340px] flex-col gap-3 text-left">
        {list.map((label, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={label} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
                  done && "bg-brand-primary text-text-on-primary",
                  active && "border-2 border-brand-primary",
                  !done && !active && "border-2 border-border-default",
                )}
              >
                {done ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : active ? (
                  <span className="size-2 rounded-full bg-brand-primary motion-safe:animate-pulse" />
                ) : null}
              </span>
              <span
                className={cn(
                  "text-body",
                  done && "text-text-secondary",
                  active && "font-semibold text-text-primary",
                  !done && !active && "text-text-tertiary",
                )}
              >
                {label}
                {active ? "…" : ""}
              </span>
            </li>
          );
        })}
      </ol>

      {/* One announcement per step for screen readers, not a stream. */}
      <p className="sr-only" aria-live="polite">
        {list[current]}
      </p>
    </div>
  );
}
