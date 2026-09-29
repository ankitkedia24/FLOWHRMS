import type { Status, StatusTone } from "@/lib/status";
import { cn } from "@/lib/cn";

/**
 * Status chip (component-specifications.md §11).
 * Renders a Status { key, label, tone } — the label is always printed, so a
 * colour-only status is impossible by construction (D-005). Chips carry a
 * specific label ("Late 18 min"), are never truncated, and never animate.
 */
const toneClasses: Record<StatusTone, { chip: string; dot: string }> = {
  success: {
    chip: "bg-status-success-bg text-status-success-text border-status-success-border",
    dot: "bg-status-success-fg",
  },
  warning: {
    chip: "bg-status-warning-bg text-status-warning-text border-status-warning-border",
    dot: "bg-status-warning-fg",
  },
  error: {
    chip: "bg-status-error-bg text-status-error-text border-status-error-border",
    dot: "bg-status-error-fg",
  },
  info: {
    chip: "bg-status-info-bg text-status-info-text border-status-info-border",
    dot: "bg-status-info-fg",
  },
  neutral: {
    chip: "bg-status-neutral-bg text-status-neutral-text border-status-neutral-border",
    dot: "bg-status-neutral-fg",
  },
};

const sizeClasses = {
  sm: "h-6 px-2 text-[12px] font-semibold",
  md: "h-7 px-2.5 text-[13px] font-semibold",
  lg: "h-8 px-3 text-label",
} as const;

export interface StatusChipProps {
  status: Status;
  size?: keyof typeof sizeClasses;
  /** Show the tone dot (default true). Decorative — the label carries meaning. */
  dot?: boolean;
  /** Add the 1px tone border for use on white cards. */
  bordered?: boolean;
  className?: string;
}

export function StatusChip({
  status,
  size = "md",
  dot = true,
  bordered = false,
  className,
}: StatusChipProps) {
  const tone = toneClasses[status.tone];
  return (
    <span
      data-status={status.key}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-chip whitespace-nowrap",
        sizeClasses[size],
        tone.chip,
        bordered ? "border" : "border-0",
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-pill", tone.dot)}
        />
      )}
      {status.label}
    </span>
  );
}
