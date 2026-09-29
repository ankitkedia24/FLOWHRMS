import Link from "next/link";
import { Reveal } from "./Reveal";

/**
 * The closing call to action.
 *
 * The backdrop is a 10×4 grid where every third cell breathes amber at a
 * staggered offset — barely visible (peak opacity 0.055) and deliberately
 * so. It should register as texture rather than as something happening.
 *
 * Delays are derived from the cell index rather than randomised, because a
 * random value would differ between the server and the browser and produce
 * a hydration mismatch for pure decoration.
 */
const CELLS = Array.from({ length: 40 }, (_, i) => ({
  glow: i % 3 === 1,
  delay: ((i * 7) % 13) + (i % 5) * 1.7,
}));

export function CtaBand() {
  return (
    <section
      id="demo-cta"
      className="relative overflow-hidden bg-[color:var(--m-navy)] px-7 py-[110px]"
      aria-labelledby="cta-heading"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 grid grid-cols-10 grid-rows-4"
      >
        {CELLS.map((cell, i) => (
          <span
            key={i}
            className="border border-[rgba(245,245,245,.04)] bg-[color:var(--m-amber)] opacity-0"
            style={
              cell.glow
                ? { animation: `m-cell-glow 13s ease-in-out ${cell.delay}s infinite` }
                : undefined
            }
          />
        ))}
      </div>

      <div className="relative mx-auto max-w-[760px] text-center">
        <Reveal>
          <h2
            id="cta-heading"
            className="m-h2 mb-[18px] text-[clamp(34px,4vw,54px)] leading-[1.08] text-[color:var(--m-cream)]"
          >
            See your own team&apos;s day in one place.
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="mx-auto mb-[34px] max-w-[48ch] text-[18px] leading-[1.55] text-[color:var(--m-on-navy-2)]">
            Set up your company in minutes and try it with your own team — every feature, free for 30 days.
          </p>
        </Reveal>
        <Reveal delay={200}>
          <Link
            href="/start"
            className="m-btn-primary m-btn-on-navy px-9 py-[17px] text-[17px] font-bold shadow-[0_4px_14px_rgba(240,78,48,.4)]"
          >
            Start free trial
          </Link>
          <div className="mt-4 text-[13px] text-[color:var(--m-on-navy)]">
            30 days free. No card, no call, no setup fee.
          </div>
        </Reveal>
      </div>
    </section>
  );
}
