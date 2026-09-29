"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

/**
 * Inputs (component-specifications.md §3).
 * - Label above the field, never floating; placeholder is an example only.
 * - The error/helper line is reserved (fixed height) so validation never
 *   shifts layout.
 * - "Required" is written as a word, not an asterisk alone.
 */

interface FieldChromeProps {
  label: string;
  required?: boolean;
  optional?: boolean;
  helper?: string;
  error?: string;
  fieldId: string;
  helperId: string;
  errorId: string;
  children: ReactNode;
}

function FieldChrome({
  label,
  required,
  optional,
  helper,
  error,
  fieldId,
  helperId,
  errorId,
  children,
}: FieldChromeProps) {
  return (
    <div className="flex w-full max-w-[480px] flex-col">
      <label
        htmlFor={fieldId}
        className="mb-1.5 text-label text-text-primary"
      >
        {label}
        {required && (
          <span className="ml-1 font-normal text-text-secondary">
            · Required
          </span>
        )}
        {optional && (
          <span className="ml-1 font-normal text-text-secondary">
            · Optional
          </span>
        )}
      </label>
      {children}
      {/* Reserved line: exactly one of error/helper renders; height fixed. */}
      <div className="mt-0.5 flex min-h-5 items-center">
        {error ? (
          <p id={errorId} className="text-caption text-status-error-text">
            {error}
          </p>
        ) : helper ? (
          <p id={helperId} className="text-caption text-text-secondary">
            {helper}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const fieldClasses = (error?: string) =>
  cn(
    "w-full rounded-input border-[1.5px] bg-surface-default text-body text-text-primary",
    "placeholder:text-text-tertiary",
    "px-4 py-3 lg:px-3 lg:py-2",
    "transition-colors duration-[var(--fh-motion-duration-fast)]",
    "read-only:border-0 read-only:bg-surface-sunken",
    "disabled:bg-surface-disabled disabled:text-text-disabled disabled:cursor-not-allowed",
    error
      ? "border-status-error-fg"
      : "border-border-default hover:border-border-strong",
    "focus:border-border-focus focus:outline-none focus:[box-shadow:var(--fh-shadow-focus-ring)]",
  );

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "prefix"> {
  label: string;
  helper?: string;
  error?: string;
  optional?: boolean;
  /** Leading affix, e.g. the +91 phone prefix chip or ₹. */
  prefix?: ReactNode;
  /** Trailing affix, e.g. a unit like "minutes" or "metres". */
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, required, optional, prefix, suffix, className, ...rest },
  ref,
) {
  const uid = useId();
  const fieldId = `field-${uid}`;
  const helperId = `helper-${uid}`;
  const errorId = `error-${uid}`;

  return (
    <FieldChrome
      label={label}
      required={required}
      optional={optional}
      helper={helper}
      error={error}
      fieldId={fieldId}
      helperId={helperId}
      errorId={errorId}
    >
      <div className="flex gap-2">
        {prefix && (
          <span className="inline-flex items-center rounded-input border-[1.5px] border-border-default bg-surface-sunken px-3 font-mono text-data text-text-secondary">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : helper ? helperId : undefined}
          className={cn(fieldClasses(error), className)}
          {...rest}
        />
        {suffix && (
          <span className="inline-flex items-center rounded-input border-[1.5px] border-border-default bg-surface-sunken px-3 text-secondary text-text-secondary">
            {suffix}
          </span>
        )}
      </div>
    </FieldChrome>
  );
});

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  helper?: string;
  error?: string;
  optional?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea(
    { label, helper, error, required, optional, className, rows = 3, ...rest },
    ref,
  ) {
    const uid = useId();
    const fieldId = `field-${uid}`;
    const helperId = `helper-${uid}`;
    const errorId = `error-${uid}`;

    return (
      <FieldChrome
        label={label}
        required={required}
        optional={optional}
        helper={helper}
        error={error}
        fieldId={fieldId}
        helperId={helperId}
        errorId={errorId}
      >
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : helper ? helperId : undefined}
          className={cn(fieldClasses(error), "resize-y", className)}
          {...rest}
        />
      </FieldChrome>
    );
  },
);
