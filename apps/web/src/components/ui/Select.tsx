"use client";

import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Select (component-specifications.md §5).
 *
 * Phase 1 ships the native `<select>` styled to spec — the spec permits it
 * for ≤5 short, neutral options, which covers every Phase 1 screen. The
 * searchable listbox/bottom-sheet variant (mandatory above 8 options)
 * arrives with the first data-heavy module screens; tracked in DECISIONS.md.
 */
export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  helper?: string;
  error?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
  /** Mark optional where a form mixes required and optional fields. */
  optional?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      label,
      helper,
      error,
      required,
      optional,
      options,
      placeholder,
      className,
      ...rest
    },
    ref,
  ) {
    const uid = useId();
    const fieldId = `select-${uid}`;
    const descId = `select-desc-${uid}`;

    return (
      <div className="flex w-full max-w-[480px] flex-col">
        <label htmlFor={fieldId} className="mb-1.5 text-label text-text-primary">
          {label}
          {required && (
            <span className="ml-1 font-normal text-text-secondary">
              · Required
            </span>
          )}
          {!required && optional && (
            <span className="ml-1 font-normal text-text-secondary">
              · Optional
            </span>
          )}
        </label>
        <div className="relative">
          <select
            ref={ref}
            id={fieldId}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || helper ? descId : undefined}
            className={cn(
              "w-full appearance-none rounded-input border-[1.5px] bg-surface-default pr-10 text-body text-text-primary",
              "px-4 py-3 lg:px-3 lg:py-2",
              "disabled:bg-surface-disabled disabled:text-text-disabled disabled:cursor-not-allowed",
              error
                ? "border-status-error-fg"
                : "border-border-default hover:border-border-strong",
              "focus:border-border-focus focus:outline-none focus:[box-shadow:var(--fh-shadow-focus-ring)]",
              className,
            )}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-text-secondary"
          />
        </div>
        <div className="mt-0.5 flex min-h-5 items-center">
          {(error || helper) && (
            <p
              id={descId}
              className={cn(
                "text-caption",
                error ? "text-status-error-text" : "text-text-secondary",
              )}
            >
              {error ?? helper}
            </p>
          )}
        </div>
      </div>
    );
  },
);
