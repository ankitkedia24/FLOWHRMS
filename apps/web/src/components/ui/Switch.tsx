"use client";

import { useId } from "react";
import { LoaderCircle, Lock } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Switch (component-specifications.md §9; states in component-states.md).
 *
 * Critical rules:
 * - The state is ALWAYS shown as a word: "Enabled" / "Disabled".
 * - Governed switches never flip optimistically: while `pending`, the knob
 *   is replaced by a spinner and the word becomes "Saving…". The visual
 *   state only changes when the server confirms (the caller flips
 *   `checked` after success and reverts on failure with a plain reason).
 * - Locked switches state who can change them.
 */
export interface SwitchProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
  /** Accessible object name, e.g. "Attendance module". */
  label: string;
  description?: string;
  /** Governed: server round-trip in flight. */
  pending?: boolean;
  /** Locked: no permission. Shows the lock and the reason; not operable. */
  locked?: boolean;
  /** Reason shown when locked or disabled — required by the a11y standard. */
  disabledReason?: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  pending = false,
  locked = false,
  disabledReason,
  disabled = false,
  className,
}: SwitchProps) {
  const uid = useId();
  const inert = disabled || locked || pending;
  const stateWord = pending ? "Saving…" : checked ? "Enabled" : "Disabled";

  return (
    <div
      className={cn(
        "flex min-h-14 w-full items-center justify-between gap-4 py-2",
        className,
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span
          id={`switch-label-${uid}`}
          className="text-body font-medium text-text-primary"
        >
          {label}
        </span>
        {description && (
          <span className="text-secondary text-text-secondary">
            {description}
          </span>
        )}
        {(locked || disabled) && disabledReason && (
          <span
            id={`switch-reason-${uid}`}
            className="mt-0.5 inline-flex items-center gap-1 text-caption text-text-secondary"
          >
            {locked && <Lock aria-hidden="true" className="size-3.5" />}
            {disabledReason}
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-2.5">
        <span
          className={cn(
            "text-label",
            checked && !pending ? "text-text-primary" : "text-text-secondary",
          )}
          aria-hidden="true"
        >
          {stateWord}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-busy={pending || undefined}
          aria-disabled={inert || undefined}
          aria-labelledby={`switch-label-${uid}`}
          aria-describedby={
            (locked || disabled) && disabledReason
              ? `switch-reason-${uid}`
              : undefined
          }
          onClick={() => {
            if (!inert) onChange?.(!checked);
          }}
          className={cn(
            "relative inline-flex h-[26px] w-11 items-center rounded-pill transition-colors duration-[var(--fh-motion-duration-fast)] lg:h-6 lg:w-10",
            checked ? "bg-brand-primary" : "bg-border-strong",
            !inert && !checked && "hover:bg-border-strong-hover",
            inert && "cursor-not-allowed",
            (disabled || locked) && "opacity-60",
          )}
        >
          <span className="sr-only">
            {label}, {stateWord}
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "absolute flex size-[22px] items-center justify-center rounded-pill bg-white shadow-elevation-1 transition-transform duration-[var(--fh-motion-duration-fast)] lg:size-5",
              checked
                ? "translate-x-[20px] lg:translate-x-[18px]"
                : "translate-x-0.5",
            )}
          >
            {pending && (
              <LoaderCircle className="size-4 animate-spin text-brand-primary" />
            )}
          </span>
        </button>
      </span>
    </div>
  );
}
