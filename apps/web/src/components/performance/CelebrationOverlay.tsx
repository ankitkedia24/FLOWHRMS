"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Sparkles } from "lucide-react";
import { markCelebratedAction } from "@/lib/performance/actions";
import type { Celebration } from "@/lib/performance/summary";

/**
 * The full-screen moment for a badge or level (PERFORMANCE-MODULE.md §B):
 * shown once, on the next open after it was earned, then marked celebrated
 * so it can never replay.
 *
 * Confetti is local CSS — pieces are positioned by index, deterministic,
 * no randomness that could differ between renders. Under
 * prefers-reduced-motion the global CSS collapses the animation to its end
 * state (off-screen), so the person still gets the moment, as a still card. The dialog traps focus in the simplest honest way (one
 * button) and Escape dismisses.
 *
 * Several pending moments show one after another rather than stacked:
 * each deserves its second, and a pile of three dialogs deserves nothing.
 */
export function CelebrationOverlay({ celebrations }: { celebrations: Celebration[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const button = useRef<HTMLButtonElement>(null);

  const current = celebrations[index] ?? null;

  useEffect(() => {
    if (!current) return;
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, celebrations.length]);

  if (!current) return null;

  function dismiss() {
    const key = celebrations[index]?.badgeKey;
    if (key) void markCelebratedAction({ badgeKeys: [key] });
    if (index + 1 < celebrations.length) {
      setIndex(index + 1);
    } else {
      setIndex(celebrations.length); // past the end → overlay unmounts
      router.refresh();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        current.kind === "level"
          ? `Level up: ${current.title}`
          : `Badge earned: ${current.title}`
      }
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(18,23,46,.72)] p-6"
    >
      {/* Confetti needs no reduced-motion branch of its own: the global
          reduced-motion CSS collapses every animation to its end state,
          which for these pieces is off-screen — so under reduced motion
          the moment is a still card, exactly as specced. */}
      {(
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 24 }, (_, i) => (
            <span
              key={i}
              className="absolute block h-2.5 w-1.5 rounded-[1px]"
              style={{
                left: `${(i * 41) % 100}%`,
                top: "-3%",
                background:
                  i % 3 === 0
                    ? "var(--fh-color-brand-primary)"
                    : i % 3 === 1
                      ? "var(--fh-color-status-warning-fg)"
                      : "var(--fh-color-status-success-fg)",
                animation: `fh-confetti 2.6s cubic-bezier(.2,.6,.6,1) ${(i % 8) * 0.18}s both`,
                rotate: `${(i * 47) % 360}deg`,
              }}
            />
          ))}
          <style>{`@keyframes fh-confetti { to { transform: translateY(108vh) rotate(540deg); opacity: .7; } }`}</style>
        </div>
      )}

      <div className="relative w-full max-w-[360px] rounded-surface-card bg-surface-default p-8 text-center shadow-elevation-3">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-[color:var(--fh-color-brand-primary-subtle)]">
          {current.kind === "level" ? (
            <Sparkles aria-hidden="true" className="size-8 text-brand-primary" />
          ) : (
            <Award aria-hidden="true" className="size-8 text-brand-primary" />
          )}
        </span>
        <p className="mt-4 text-caption font-semibold uppercase tracking-micro text-text-tertiary">
          {current.kind === "level" ? "Level up" : "Badge earned"}
        </p>
        <h2 className="mt-1 font-heading text-h1 text-text-primary">{current.title}</h2>
        <p className="mt-2 text-body text-text-secondary">
          {current.kind === "level"
            ? "Earned point by point. Levels never reset."
            : "Yours now — it stays on your wall."}
        </p>
        <button
          ref={button}
          type="button"
          onClick={dismiss}
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-button-mobile-primary bg-brand-primary font-heading text-body font-semibold text-text-on-primary hover:bg-brand-primary-hover"
        >
          {index + 1 < celebrations.length ? "Next" : "Nice!"}
        </button>
      </div>
    </div>
  );
}
