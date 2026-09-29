"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Icon button (component-specifications.md §2).
 * - `label` is mandatory: it becomes the aria-label AND the visible tooltip
 *   (shown on hover and keyboard focus).
 * - Never used for a decision — Approve/Reject always carry text.
 */
export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: "ghost" | "filled" | "dangerGhost" | "inverse";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const variantClasses = {
  ghost:
    "text-text-secondary hover:text-text-primary hover:bg-surface-sunken",
  filled:
    "bg-surface-sunken text-text-secondary hover:text-text-primary",
  dangerGhost: "text-status-error-fg hover:bg-status-error-bg",
  inverse:
    "text-text-inverse hover:bg-white/10",
} as const;

const sizeClasses = {
  sm: "size-8", // dense table rows only, row height ≥48px
  md: "size-10", // desktop default
  lg: "size-12", // mobile
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, variant = "ghost", size = "md", className, children, type = "button", ...rest },
    ref,
  ) {
    return (
      <span className="group/icon-button relative inline-flex">
        <button
          ref={ref}
          type={type}
          aria-label={label}
          className={cn(
            "inline-flex items-center justify-center rounded-md",
            "transition-colors duration-[var(--fh-motion-duration-fast)]",
            sizeClasses[size],
            variantClasses[variant],
            "disabled:bg-surface-disabled disabled:text-text-disabled disabled:cursor-not-allowed",
            className,
          )}
          {...rest}
        >
          <span aria-hidden="true" className="[&>svg]:size-6">
            {children}
          </span>
        </button>
        {/* Tooltip: appears on hover AND keyboard focus, matching aria-label. */}
        <span
          role="presentation"
          className={cn(
            "pointer-events-none absolute -top-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap",
            "max-w-[60vw] overflow-hidden text-ellipsis",
            "rounded-md bg-surface-inverse px-2 py-1 text-caption text-text-inverse shadow-elevation-3",
            "opacity-0 transition-opacity duration-[var(--fh-motion-duration-fast)]",
            "group-hover/icon-button:opacity-100 group-focus-within/icon-button:opacity-100",
          )}
        >
          {label}
        </span>
      </span>
    );
  },
);
