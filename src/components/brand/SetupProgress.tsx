"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { FlowacordMark } from "@/components/brand/FlowacordMark";
import { cn } from "@/lib/cn";

/**
 * What someone sees while their company is being created.
 *
 * The steps are paced, not reported by the server — creation is one
 * transaction with no honest mid-point. Two rules keep it from feeling
 * broken:
 *
 * 1. It never cuts away half-way. When the caller says the work is `done`,
 *    the remaining steps still tick off one by one (faster), a short
 *    "All set" moment shows, and only then is `onComplete` called. A fast
 *    server therefore never makes the animation vanish abruptly.
 * 2. While the work is still running, the last step waits "in progress"
 *    rather than claiming to be finished.
 *
 * The mark itself is never animated (BRAND-GUIDELINES.md: no effects on
 * the mark). A ring turns around it instead, only without reduced motion.
 */
export function SetupProgress({
  companyName,
  steps,
  done = false,
  onComplete,
  stepMs = 1300,
  finishStepMs = 450,
  holdMs = 900,
}: {
  companyName: string;
  steps?: string[];
  /** The work has finished: play out the remaining steps, then complete. */
  done?: boolean;
  /** Called once, after every step has ticked and the "All set" moment. */
  onComplete?: () => void;
  stepMs?: number;
  finishStepMs?: number;
  holdMs?: number;
}) {
  const list = steps ?? [
    `Creating ${companyName.trim() || "your company"}`,
    "Setting up roles and permissions",
    "Switching on your modules",
    "Preparing your 30-day trial",
  ];
  // `current` is the step in progress; list.length means every step is done.
  const [current, setCurrent] = useState(0);
  const completed = useRef(false);
  const allDone = current >= list.length;

  useEffect(() => {
    if (allDone) {
      if (completed.current) return;
      const timer = setTimeout(() => {
        completed.current = true;
        onComplete?.();
      }, holdMs);
      return () => clearTimeout(timer);
    }
    // Still working: never tick past the last step on our own.
    if (!done && current >= list.length - 1) return;
    const timer = setTimeout(
      () => setCurrent((c) => c + 1),
      done ? finishStepMs : stepMs,
    );
    return () => clearTimeout(timer);
  }, [allDone, current, done, list.length, stepMs, finishStepMs, holdMs, onComplete]);

  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="relative flex size-24 items-center justify-center">
        <svg
          viewBox="0 0 100 100"
          aria-hidden="true"
          className={cn(
            "absolute inset-0 size-24",
            !allDone && "motion-safe:animate-spin [animation-duration:1.4s]",
          )}
        >
          <circle cx="50" cy="50" r="45" fill="none" strokeWidth="6" className="stroke-brand-primary-subtle" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            // Closes into a full ring when everything is done.
            strokeDasharray={allDone ? "283 0" : "70 213"}
            className="stroke-brand-primary transition-[stroke-dasharray] duration-500"
          />
        </svg>
        <FlowacordMark size={40} />
      </div>

      <h2 className="mt-5 font-heading text-h2 text-text-primary">
        {allDone ? "All set!" : "Setting up your company"}
      </h2>
      <p className="mt-1 text-secondary text-text-secondary">
        {allDone ? "Opening your account…" : "This takes a few seconds. Please keep this page open."}
      </p>

      <ol className="mt-6 flex w-full max-w-[340px] flex-col gap-3 text-left">
        {list.map((label, index) => {
          const isDone = index < current;
          const active = index === current;
          return (
            <li key={label} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
                  isDone && "bg-brand-primary text-text-on-primary",
                  active && "border-2 border-brand-primary",
                  !isDone && !active && "border-2 border-border-default",
                )}
              >
                {isDone ? (
                  <Check className="size-3.5 motion-safe:animate-[fh-confirm-pulse_300ms_ease-out]" strokeWidth={3} />
                ) : active ? (
                  <span className="size-2 rounded-full bg-brand-primary motion-safe:animate-pulse" />
                ) : null}
              </span>
              <span
                className={cn(
                  "text-body transition-colors duration-300",
                  isDone && "text-text-secondary",
                  active && "font-semibold text-text-primary",
                  !isDone && !active && "text-text-tertiary",
                )}
              >
                {label}
                {active ? "…" : ""}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="sr-only" aria-live="polite">
        {allDone ? "All set." : list[current]}
      </p>
    </div>
  );
}
