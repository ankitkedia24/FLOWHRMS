"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
} from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Checkbox (component-specifications.md §7).
 * Native input; the whole row is the hit target (≥48px on mobile);
 * indeterminate exposed via aria-checked="mixed".
 */
export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  label: string;
  helper?: string;
  indeterminate?: boolean;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    { label, helper, indeterminate = false, error, className, ...rest },
    ref,
  ) {
    const uid = useId();
    const innerRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    return (
      <label
        htmlFor={`checkbox-${uid}`}
        className={cn(
          "group flex min-h-12 w-full cursor-pointer items-start gap-3 py-2 lg:min-h-10",
          "has-[input:disabled]:cursor-not-allowed",
          className,
        )}
      >
        <span className="relative mt-0.5 inline-flex shrink-0">
          <input
            ref={(node) => {
              innerRef.current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) ref.current = node;
            }}
            id={`checkbox-${uid}`}
            type="checkbox"
            aria-describedby={helper ? `checkbox-helper-${uid}` : undefined}
            aria-invalid={error ? true : undefined}
            className={cn(
              "peer size-[22px] appearance-none rounded-xs border-[1.5px] bg-surface-default lg:size-[18px]",
              error ? "border-status-error-fg" : "border-border-strong",
              "checked:border-brand-primary checked:bg-brand-primary",
              "indeterminate:border-brand-primary indeterminate:bg-brand-primary",
              "disabled:border-border-default disabled:bg-surface-disabled",
            )}
            {...rest}
          />
          <Check
            aria-hidden="true"
            strokeWidth={3}
            className="pointer-events-none absolute inset-0 m-auto hidden size-3.5 text-text-on-primary peer-checked:block peer-indeterminate:hidden"
          />
          <Minus
            aria-hidden="true"
            strokeWidth={3}
            className="pointer-events-none absolute inset-0 m-auto hidden size-3.5 text-text-on-primary peer-indeterminate:block"
          />
        </span>
        <span className="flex flex-col">
          <span className="text-body text-text-primary group-has-[input:disabled]:text-text-disabled">
            {label}
          </span>
          {helper && (
            <span
              id={`checkbox-helper-${uid}`}
              className="text-secondary text-text-secondary"
            >
              {helper}
            </span>
          )}
          {error && (
            <span className="text-caption text-status-error-text">{error}</span>
          )}
        </span>
      </label>
    );
  },
);
