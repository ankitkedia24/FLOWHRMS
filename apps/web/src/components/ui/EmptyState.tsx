import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Empty state (component-specifications.md §22).
 * Copy comes verbatim from the approved tables. Every empty region explains
 * itself and offers a next step or a reassurance — never a dead end.
 *
 * Illustration rule: geometric shapes only — circles, rounded rectangles
 * and the three logo bars, in brand tints (admin) or warm tints (employee).
 */
export interface EmptyStateProps {
  title: string;
  body: string;
  action?: ReactNode;
  /** Employee-surface warm illustration tints (one warm element max/screen). */
  warm?: boolean;
  className?: string;
}

function GeometricIllustration({ warm }: { warm: boolean }) {
  // Built strictly from the approved vocabulary: a circle, rounded
  // rectangles and the three stepping logo bars, in
  // brand.primarySubtle/brand.primary (admin) or
  // warm.subtle/warm.accentSoft (employee) — spec §22.
  const circle = warm
    ? "var(--fh-color-warm-subtle)"
    : "var(--fh-color-brand-primary-subtle)";
  const bar = warm
    ? "var(--fh-color-warm-accent-soft)"
    : "var(--fh-color-brand-primary)";
  return (
    <svg
      aria-hidden="true"
      width="96"
      height="96"
      viewBox="0 0 96 96"
      className="mb-4"
    >
      <circle cx="48" cy="48" r="44" fill={circle} />
      <rect x="22" y="30" width="34" height="12" rx="6" fill={bar} opacity="0.35" />
      <rect x="34" y="46" width="40" height="12" rx="6" fill={bar} opacity="0.65" />
      <rect x="46" y="62" width="30" height="12" rx="6" fill={bar} />
    </svg>
  );
}

export function EmptyState({
  title,
  body,
  action,
  warm = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-10 text-center",
        className,
      )}
    >
      <GeometricIllustration warm={warm} />
      <h3 className="font-heading text-h3 text-text-primary">{title}</h3>
      <p className="mt-1 max-w-[40ch] text-secondary text-text-secondary">
        {body}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
