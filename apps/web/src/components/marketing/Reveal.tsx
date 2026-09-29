"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fade-and-rise on scroll (design bundle: 16px, 0.7s, per-element stagger,
 * IntersectionObserver at threshold 0.15).
 *
 * Two rules make this safe rather than clever:
 *
 * 1. It arms itself in an effect, never during render. The server sends
 *    fully visible markup, so if JavaScript never arrives — or the observer
 *    throws — the page reads exactly as it would have. A reveal system that
 *    can hide content permanently is worse than no reveal system.
 *
 * 2. Anything already inside the viewport on mount is never hidden. The
 *    hero would otherwise flash blank on first paint, which is the one
 *    place a visitor is guaranteed to be looking.
 *
 * The armed/shown flags are written straight onto the element rather than
 * held in React state. They exist only to drive two CSS rules, nothing
 * renders from them, and routing them through state would re-render every
 * revealed section twice for no visible difference.
 *
 * Reduced motion skips the whole mechanism: content is simply there.
 */
export function Reveal({
  delay = 0,
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  /** Stagger in ms. The bundle uses 0/80/100/160/200/240. */
  delay?: number;
  as?: "div" | "section" | "header" | "li";
  className?: string;
  children: ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Above the fold on load: leave it alone entirely.
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.setAttribute("data-reveal-armed", "true");
    const show = () => el.setAttribute("data-reveal-shown", "true");

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-reveal-shown", "true");
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);

    // Failsafe. Arming an element hides it, and something has to guarantee
    // it comes back even if the observer never reports — which is not
    // hypothetical: embedded webviews and non-compositing contexts run the
    // constructor happily and then never fire a callback, leaving the page
    // permanently blank below the fold. Four seconds is far longer than a
    // working observer takes and short enough that a broken one costs a
    // pause rather than the content.
    const failsafe = window.setTimeout(show, 4000);

    return () => {
      window.clearTimeout(failsafe);
      io.disconnect();
    };
  }, []);

  return (
    <Tag
      // @ts-expect-error — one ref for a union of intrinsic elements.
      ref={ref}
      data-reveal=""
      style={delay ? ({ "--m-reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
      className={className}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * Fires once when the element first scrolls into view. Used by the evidence
 * panel, whose animation is a short story that should start when it is
 * actually watched rather than having played to an empty room.
 *
 * No reduced-motion branch is needed: the observer still fires, and the CSS
 * collapses every duration to nothing, so the scene simply arrives complete.
 */
export function useSeen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setSeen(true);
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);

    // Same failsafe as Reveal, and it matters more here: this gate decides
    // whether a whole panel RENDERS, so an observer that never fires would
    // leave an empty card rather than an unanimated one.
    const failsafe = window.setTimeout(() => setSeen(true), 4000);

    return () => {
      window.clearTimeout(failsafe);
      io.disconnect();
    };
  }, []);

  return { ref, seen };
}
