"use client";

import { useSeen } from "./Reveal";

/**
 * "Evidence, not surveillance" — the section that states the product's
 * central promise, and then demonstrates it.
 *
 * The left card animates one walk to a branch, one pin, one recorded
 * event, and then shows the manager's view of that same event: a single
 * row. The point is the gap between the two — there isn't one. That is
 * the argument, and it is made by showing rather than asserting
 * (Constitution §7; D-018).
 *
 * The right column names what FlowHRMS does NOT do, in the same visual weight
 * as what it does. Continuous tracking is struck through and labelled
 * "Not built. Not toggleable. Not ours." — a promise that would be worth
 * nothing if it were a toggle someone could find later.
 *
 * The animation waits until the panel is actually on screen, because a
 * three-second sequence that played to an empty viewport has told nobody
 * anything.
 */
export function Evidence() {
  const { ref, seen } = useSeen<HTMLDivElement>();

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-stretch gap-6">
      <div
        ref={ref}
        className="min-h-[280px] rounded-2xl border border-[rgba(245,245,245,.12)] bg-[rgba(245,245,245,.04)] p-[26px]"
      >
        <div className="mb-5 text-xs font-bold tracking-[0.1em] text-[color:var(--m-on-navy-2)]">
          WHAT ACTUALLY HAPPENS
        </div>

        {seen && (
          <>
            <div className="relative h-[110px]">
              <div className="absolute left-[6%] right-[30%] top-16 border-t-2 border-dashed border-[rgba(245,245,245,.18)]" />
              <span
                className="absolute top-[57px] z-[2] size-3.5 rounded-full border-2 border-[color:var(--m-navy)] bg-[color:var(--m-amber)] shadow-[0_0_0_2px_#CEB4F5]"
                style={{ animation: "m-ev-walk 2.4s cubic-bezier(.4,.7,.3,1) .3s both" }}
              />
              <div className="absolute left-[52%] top-9 h-[42px] w-[34px] -translate-x-1/2 rounded-t-md border border-[rgba(245,245,245,.25)] bg-[rgba(245,245,245,.1)]" />
              <span
                className="absolute left-[52%] top-3.5 size-[13px] -translate-x-1/2 rounded-full border-2 border-white bg-[color:var(--m-red)]"
                style={{ animation: "m-pin-pop .5s ease 2.7s both" }}
              />
              <span
                className="absolute left-[52%] top-[88px] -translate-x-1/2 whitespace-nowrap rounded-full bg-[rgba(47,158,111,.18)] px-[11px] py-[5px] text-[11.5px] font-bold text-[color:var(--m-green-on-dark)]"
                style={{ animation: "m-seq-in .4s ease 3s both" }}
              >
                ✓ Check-in recorded · 09:12
              </span>
              <span className="absolute left-[6%] top-[88px] text-[11.5px] font-semibold text-[color:var(--m-on-navy)]">
                Employee walks to branch
              </span>
            </div>

            <div
              className="mt-4 border-t border-[rgba(245,245,245,.1)] pt-4"
              style={{ animation: "m-seq-in .4s ease 3.4s both" }}
            >
              <div className="mb-2.5 text-xs font-bold tracking-[0.1em] text-[color:var(--m-on-navy-2)]">
                WHAT THE MANAGER SEES
              </div>
              <div className="flex items-center gap-2.5 rounded-[10px] border border-[rgba(245,245,245,.12)] bg-[rgba(245,245,245,.06)] px-3.5 py-[11px] text-[13px] text-[color:var(--m-cream)]">
                <span className="size-2 flex-none rounded-full bg-[color:var(--m-green)]" />
                <span className="font-semibold">Ramesh · Jaipur warehouse</span>
                <span className="m-num ml-auto text-[color:var(--m-on-navy-2)]">09:12</span>
              </div>
              <div className="mt-2.5 text-xs text-[color:var(--m-on-navy)]">
                The same recorded event. Nothing in between.
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col justify-center gap-4">
        <div className="flex items-center gap-4 rounded-[14px] border border-[rgba(245,245,245,.1)] bg-[rgba(245,245,245,.03)] px-[22px] py-5 opacity-60">
          <span className="relative h-6 w-10 flex-none rounded-full bg-[rgba(245,245,245,.12)]">
            <span className="absolute left-[3px] top-[3px] size-[18px] rounded-full bg-[color:var(--m-on-navy)]" />
          </span>
          <div>
            <div className="text-[15px] font-bold text-[color:var(--m-on-navy-2)] line-through decoration-[color:var(--m-red)] decoration-2">
              Continuous tracking
            </div>
            <div className="mt-0.5 text-[12.5px] text-[color:var(--m-on-navy)]">
              Not built. Not toggleable. Not ours.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-[14px] border border-[rgba(47,158,111,.4)] bg-[rgba(47,158,111,.08)] px-[22px] py-5">
          <span className="relative h-6 w-10 flex-none rounded-full bg-[color:var(--m-green)]">
            <span className="absolute right-[3px] top-[3px] size-[18px] rounded-full bg-white" />
          </span>
          <div>
            <div className="text-[15px] font-bold text-[color:var(--m-cream)]">
              Check-in confirmation
            </div>
            <div className="mt-0.5 text-[12.5px] text-[color:var(--m-on-navy-2)]">
              One pin at check-in, one at check-out. That&apos;s the whole story.
            </div>
          </div>
        </div>

        <div className="px-1 text-[13.5px] leading-[1.55] text-[color:var(--m-on-navy)]">
          Teams adopt tools they trust. FlowHRMS records evidence of work done—it doesn&apos;t follow
          people around.
        </div>
      </div>
    </div>
  );
}
