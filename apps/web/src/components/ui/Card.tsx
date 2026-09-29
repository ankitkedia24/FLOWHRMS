import type { HTMLAttributes, ReactNode } from "react";
import type { StatusTone } from "@/lib/status";
import { cn } from "@/lib/cn";

/**
 * Card (component-specifications.md §13).
 * Radius follows the surface family via `rounded-surface-card`
 * (admin 12px / employee 16px) — no per-component variant flag.
 * The warm variant is for employee positive moments only.
 */
const statusBorder: Record<StatusTone, string> = {
  success: "border-l-2 border-l-status-success-fg",
  warning: "border-l-2 border-l-status-warning-fg",
  error: "border-l-2 border-l-status-error-fg",
  info: "border-l-2 border-l-status-info-fg",
  neutral: "border-l-2 border-l-status-neutral-fg",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Status-led card: 2px left border in the tone colour (plus a chip in content). */
  statusTone?: StatusTone;
  /** Warm card — employee positive moments only (max one per screen). */
  warm?: boolean;
  /** Remove padding (for tables and lists that manage their own). */
  flush?: boolean;
  children: ReactNode;
}

export function Card({
  statusTone,
  warm = false,
  flush = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-surface-card border shadow-elevation-1",
        warm
          ? "border-warm-border bg-warm-subtle"
          : "border-border-default bg-surface-default",
        statusTone && statusBorder[statusTone],
        !flush && "p-5",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  meta,
  action,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h3 className="font-heading text-h3 text-text-primary">{title}</h3>
        {meta && (
          <p className="mt-0.5 text-secondary text-text-secondary">{meta}</p>
        )}
      </div>
      {action}
    </div>
  );
}
