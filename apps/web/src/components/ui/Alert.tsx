import type { ReactNode } from "react";
import {
  CircleCheck,
  CircleX,
  Info,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Alert / warning banner (component-specifications.md §21).
 * One banner maximum per region, placed inside the card or above the form
 * it concerns. The `consequence` variant states a payroll/attendance
 * effect before submit and is never dismissible.
 */
export type AlertVariant =
  | "info"
  | "warning"
  | "error"
  | "success"
  | "consequence";

const variantStyles: Record<
  AlertVariant,
  { container: string; icon: ReactNode }
> = {
  info: {
    container:
      "border-status-info-border bg-status-info-bg text-status-info-text border-l-status-info-fg",
    icon: <Info aria-hidden="true" className="size-5 shrink-0" />,
  },
  warning: {
    container:
      "border-status-warning-border bg-status-warning-bg text-status-warning-text border-l-status-warning-fg",
    icon: <TriangleAlert aria-hidden="true" className="size-5 shrink-0" />,
  },
  error: {
    container:
      "border-status-error-border bg-status-error-bg text-status-error-text border-l-status-error-fg",
    icon: <CircleX aria-hidden="true" className="size-5 shrink-0" />,
  },
  success: {
    container:
      "border-status-success-border bg-status-success-bg text-status-success-text border-l-status-success-fg",
    icon: <CircleCheck aria-hidden="true" className="size-5 shrink-0" />,
  },
  consequence: {
    container:
      "border-status-warning-border bg-status-warning-bg text-status-warning-text border-l-status-warning-fg",
    icon: <TriangleAlert aria-hidden="true" className="size-5 shrink-0" />,
  },
};

export interface AlertProps {
  variant: AlertVariant;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  /** Set when the banner appears in response to a user action. */
  live?: boolean;
  className?: string;
}

export function Alert({
  variant,
  title,
  children,
  action,
  live = false,
  className,
}: AlertProps) {
  const style = variantStyles[variant];
  return (
    <div
      role={live ? "alert" : undefined}
      className={cn(
        "flex gap-3 rounded-md border border-l-[3px] p-4",
        style.container,
        className,
      )}
    >
      {style.icon}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-label">{title}</p>
        {children && <div className="text-secondary">{children}</div>}
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  );
}
