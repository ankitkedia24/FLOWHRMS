"use client";

import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Button (component-specifications.md §1).
 * - One primary per screen or per card.
 * - `warmSuccess` is employee-surface only (never on admin — README §1).
 * - Loading keeps the button width fixed; the control stays focusable.
 * - A disabled button always states its reason (`disabledReason`).
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "outline"
  | "danger"
  | "dangerSubtle"
  | "warmSuccess";

export type ButtonSize = "sm" | "md" | "lg" | "xl";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-primary text-text-on-primary hover:bg-brand-primary-hover active:bg-brand-primary-active",
  secondary:
    "bg-brand-primary-subtle text-brand-primary hover:bg-brand-primary-subtle-hover active:bg-brand-primary-subtle-active",
  tertiary:
    "bg-transparent text-brand-primary hover:bg-surface-sunken active:bg-surface-disabled",
  outline:
    "bg-surface-default text-text-primary border-[1.5px] border-border-strong hover:bg-surface-sunken",
  danger:
    "bg-status-error-fg text-white hover:brightness-[0.92] active:brightness-[0.86]",
  dangerSubtle:
    "bg-status-error-bg text-status-error-text border border-status-error-border hover:brightness-[0.97]",
  warmSuccess:
    "bg-warm-accent text-white hover:brightness-[0.92] active:brightness-[0.86]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-label rounded-button",
  md: "h-11 px-5 text-label rounded-button",
  lg: "h-12 px-6 text-body font-semibold rounded-button",
  xl: "h-14 px-6 text-h3 rounded-button-mobile-primary w-full shadow-primary-action",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Required whenever `disabled` is set — every disabled control states its reason. */
  disabledReason?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      disabledReason,
      leadingIcon,
      trailingIcon,
      className,
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    const reasonId = useId();
    const isDisabled = disabled && !loading;
    const showReason = isDisabled && disabledReason;

    const button = (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        aria-describedby={showReason ? reasonId : undefined}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 font-heading font-semibold whitespace-nowrap select-none",
          "transition-colors duration-[var(--fh-motion-duration-fast)]",
          sizeClasses[size],
          isDisabled
            ? "bg-surface-disabled text-text-disabled cursor-not-allowed shadow-none"
            : variantClasses[variant],
          variant === "danger" &&
            "focus-visible:[box-shadow:var(--fh-shadow-focus-ring-danger)]",
          className,
        )}
        {...rest}
      >
        {/* Loading: label hidden but width preserved — no layout shift. */}
        <span
          className={cn(
            "inline-flex items-center gap-2",
            loading && "invisible",
          )}
        >
          {leadingIcon}
          {children}
          {trailingIcon}
        </span>
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <LoaderCircle
              aria-hidden="true"
              className="size-5 animate-spin"
            />
            <span className="sr-only">Loading</span>
          </span>
        )}
      </button>
    );

    if (!showReason) return button;
    return (
      <span className="inline-flex flex-col gap-1">
        {button}
        <span id={reasonId} className="text-caption text-text-secondary">
          {disabledReason}
        </span>
      </span>
    );
  },
);
