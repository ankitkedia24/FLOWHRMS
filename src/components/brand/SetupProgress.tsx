"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CircleCheck } from "lucide-react";
import { FlowacordMark } from "@/components/brand/FlowacordMark";
import { cn } from "@/lib/cn";

/**
 * What someone sees while their company is being created.
 *
 * The steps are paced, not reported by the server — creation is one
 * transaction with no honest mid-point. So the pace is steady and the
 * ending is always the same, however fast the server is:
 *
 * 1. Every step gets the same unhurried time on screen (`stepMs`). A fast
 *    server never makes steps rush or get skipped; the answer simply waits
 *    until the animation reaches the end.
 * 2. While the work is still running, the last step waits "in progress"
 *    rather than claiming to be finished; once the work is done it takes
 *    its normal time too.
 * 3. When every step is ticked, a "ready" notification shows for
 *    `holdMs`, and only then is `onComplete` called — once.
 *
 * The step timer never restarts because the parent re-rendered: callbacks
 * are read through refs, so a new `onComplete` or `done` arriving mid-step
 * does not reset the clock.
 *
 * The mark itself is never animated (BRAND-GUIDELINES.md: no effects on
 * the mark). A ring turns around it instead, only without reduced motion.
 */
export function SetupProgress({
  companyName,
  steps,
  done = false,
  onComplete,
  stepMs = 1400,
  holdMs = 2200,
  readyTitle,
  readyMessage,
}: {
  companyName: string;
  steps?: string[];
  /** The work has finished: finish the remaining steps at the normal pace, then complete. */
  done?: boolean;
  /** Called once, after every step has ticked and the "ready" notification has shown. */
  onComplete?: () => void;
  stepMs?: number;
  holdMs?: number;
  /** The notification at the end, e.g. "Sharma Traders is ready". */
  readyTitle?: string;
  readyMessage?: string;
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
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const allDone = current >= list.length;
  // On the last step with the work still running: wait there.
  const waiting = !allDone && !done && current >= list.length - 1;

  useEffect(() => {
    if (allDone) {
      const timer = setTimeout(() => {
        if (completed.current) return;
        completed.current = true;
        onCompleteRef.current?.();
      }, holdMs);
      return () => clearTimeout(timer);
    }
    if (waiting) return;
    const timer = setTimeout(() => setCurrent((c) => c + 1), stepMs);
    return () => clearTimeout(timer);
  }, [allDone, current, waiting, stepMs, holdMs]);

  const name = companyName.trim() || "Your company";

  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="relative flex size-24 items-center justify-center">
        <svg
          viewBox="0 0 100 100"
          aria-hidden="true"
          className={cn("absolute inset-0 size-24", !allDone && "motion-safe:animate-spin [animation-duration:1.4s]")}
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
        {allDone ? "Taking you there in a moment…" : "This takes a few seconds. Please keep this page open."}
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

      {allDone && (
        <div
          role="status"
          className="mt-6 flex w-full max-w-[380px] items-start gap-3 rounded-surface-card border border-status-success-border bg-status-success-bg px-4 py-3 text-left motion-safe:animate-[fh-confirm-pulse_300ms_ease-out]"
        >
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-status-success-fg" aria-hidden="true" />
          <div>
            <p className="text-body font-semibold text-status-success-text">{readyTitle ?? `${name} is ready`}</p>
            <p className="text-secondary text-status-success-text">
              {readyMessage ?? "Everything is set up. Opening the next step…"}
            </p>
          </div>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {allDone ? `${readyTitle ?? `${name} is ready`}.` : list[current]}
      </p>
    </div>
  );
}
