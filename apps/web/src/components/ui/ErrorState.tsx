import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Error states (component-specifications.md §24).
 * Anatomy: what happened → what to do next → action. Never a raw code
 * alone; an optional support reference renders in mono tertiary text.
 */
export interface ErrorStateProps {
  /** What happened, e.g. "We couldn't load today's attendance." */
  title: string;
  /** What to do next, e.g. "Check your connection and try again." */
  body: string;
  action?: ReactNode;
  /** Support reference id, shown as "REF {id}". */
  referenceId?: string;
  /** Screen-level errors get the illustration frame in error tokens. */
  level?: "region" | "screen";
  className?: string;
}

function ErrorIllustration() {
  return (
    <svg aria-hidden="true" width="96" height="96" viewBox="0 0 96 96" className="mb-4">
      <circle cx="48" cy="48" r="44" fill="var(--fh-color-status-error-bg)" />
      <rect x="22" y="30" width="34" height="12" rx="6" fill="var(--fh-color-status-error-fg)" opacity="0.35" />
      <rect x="34" y="46" width="40" height="12" rx="6" fill="var(--fh-color-status-error-fg)" opacity="0.65" />
      <rect x="46" y="62" width="30" height="12" rx="6" fill="var(--fh-color-status-error-fg)" />
    </svg>
  );
}

export function ErrorState({
  title,
  body,
  action,
  referenceId,
  level = "region",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center px-6 text-center",
        level === "screen" ? "py-16" : "py-10",
        className,
      )}
    >
      {level === "screen" && <ErrorIllustration />}
      <h3 className="font-heading text-h3 text-text-primary">{title}</h3>
      <p className="mt-1 max-w-[44ch] text-secondary text-text-secondary">
        {body}
      </p>
      {action && <div className="mt-4 flex gap-3">{action}</div>}
      {referenceId && (
        <p className="mt-3 font-mono text-mono text-text-tertiary uppercase">
          REF {referenceId}
        </p>
      )}
    </div>
  );
}
