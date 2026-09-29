import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Loading states (component-specifications.md §23).
 * - Skeletons mirror the final layout; fixed row counts (3 mobile /
 *   6 desktop) so the page never jumps.
 * - Spinners appear only after 400ms (CSS-delayed fade-in).
 * - Never show a number, hour total or salary in a partial state — always
 *   skeleton until final.
 */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton rounded-md", className)} />;
}

/** A labelled loading region: skeletons + one polite status node. */
export function LoadingRegion({
  label,
  children,
  className,
}: {
  /** e.g. "Loading attendance" */
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div aria-busy="true" className={className}>
      <p role="status" className="sr-only">
        {label}
      </p>
      {children}
    </div>
  );
}

/** Fixed-count skeleton rows: 3 on mobile, 6 from md up. */
export function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-13 w-full", i >= 3 && "hidden md:block")}
        />
      ))}
    </div>
  );
}

/** Spinner: visible only after 400ms of waiting (motion.json rules). */
export function Spinner({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-2 opacity-0",
        "animate-[fh-spinner-appear_1ms_linear_400ms_forwards]",
        className,
      )}
    >
      <LoaderCircle
        aria-hidden="true"
        className="size-5 animate-spin text-brand-primary"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
