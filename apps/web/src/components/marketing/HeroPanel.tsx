"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The hero's product composition: a live-looking operations card with a
 * phone check-in card overlapping its corner.
 *
 * Everything animated here starts from the value the server rendered, so
 * hydration has nothing to disagree about; the motion is layered on
 * afterwards in effects. Under reduced motion the counter lands on its
 * final value immediately and the rotations never start — no ticking
 * numbers, no moving feed.
 *
 * The figures are illustrative and named as a fictional cluster. They are
 * a picture of the product, not a claim about a customer (D-018: no
 * adoption or accuracy statistics on marketing).
 */

const SEED_FEED = [
  { n: "Sunita checked in", p: "Karol Bagh store", t: "09:02" },
  { n: "Arjun completed task", p: "Dispatch bay 2", t: "08:58" },
  { n: "Imran checked in", p: "Sector 62 field", t: "08:51" },
];

const POOL = [
  { n: "Ramesh checked in", p: "Jaipur warehouse", t: "09:12" },
  { n: "Kavya completed task", p: "Bhiwandi warehouse", t: "09:15" },
  { n: "Deepak checked in", p: "Karol Bagh store", t: "09:18" },
  { n: "Manoj started trip", p: "Dispatch bay 2", t: "09:21" },
  { n: "Leave approved", p: "Priya S. · 2 days", t: "09:24" },
  { n: "Vikram checked in", p: "Sector 62 field", t: "09:27" },
];

const PRESENT_FROM = 128;
const PRESENT_TO = 142;

export function HeroPanel() {
  const [present, setPresent] = useState(PRESENT_FROM);
  const [approved, setApproved] = useState(false);
  const [feed, setFeed] = useState(SEED_FEED);
  const poolIndex = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Land on the final figure without counting to it. Scheduled rather
      // than set inline: a synchronous setState in an effect body cascades
      // an extra render, and this is the same result one tick later.
      const jump = setTimeout(() => setPresent(PRESENT_TO), 0);
      return () => clearTimeout(jump);
    }

    const tick = setInterval(() => {
      setPresent((p) => {
        if (p >= PRESENT_TO) {
          clearInterval(tick);
          return PRESENT_TO;
        }
        return p + 1;
      });
    }, 80);

    const rotate = setInterval(() => {
      const next = POOL[poolIndex.current++ % POOL.length];
      setFeed((rows) => [next, ...rows].slice(0, 3));
    }, 6000);

    const chip = setInterval(() => setApproved((v) => !v), 5500);

    return () => {
      clearInterval(tick);
      clearInterval(rotate);
      clearInterval(chip);
    };
  }, []);

  return (
    <div className="relative pl-4 pb-[118px]">
      <div className="m-card px-[22px] pt-[22px] pb-[18px]">
        <div className="mb-[18px] flex items-center justify-between">
          <div className="font-[family-name:var(--m-font-head)] text-[15px] font-bold">
            Today · Jaipur cluster
          </div>
          <div className="flex items-center gap-[7px] text-xs font-semibold text-[color:var(--m-green)]">
            <span className="m-live-dot" />
            LIVE
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          <div className="m-tile">
            <div className="m-tile-label mb-1.5">Present today</div>
            <div className="m-stat">
              {present}
              <span className="text-[15px] font-semibold text-[color:var(--m-muted-2)]"> / 160</span>
            </div>
            <div className="m-bar">
              <span className="w-[89%] bg-[color:var(--m-green)]" />
            </div>
          </div>

          <div className="m-tile flex items-center gap-3">
            <svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="26" fill="none" stroke="var(--m-border-inner)" strokeWidth="7" />
              <circle
                cx="32"
                cy="32"
                r="26"
                transform="rotate(-90 32 32)"
                fill="none"
                stroke="var(--m-red)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="163"
                strokeDashoffset="49"
                style={{ animation: "m-ring-fill 1.6s ease-out both" }}
              />
            </svg>
            <div>
              <div className="m-stat">28</div>
              <div className="m-tile-label">Tasks in progress</div>
            </div>
          </div>

          <div className="m-tile">
            <div className="m-tile-label mb-1.5">Leave requests</div>
            <div className="m-stat">6</div>
            <div className="mt-2 flex items-center gap-1.5 text-[11.5px] font-semibold">
              <span className="text-[color:var(--m-muted)]">Priya S. · 2 days</span>
              {approved ? (
                <span className="rounded-full bg-[rgba(47,158,111,.14)] px-2 py-[3px] text-[color:var(--m-green-text)]">
                  Approved ✓
                </span>
              ) : (
                <span className="rounded-full bg-[rgba(245,185,64,.2)] px-2 py-[3px] text-[color:var(--m-amber-text)]">
                  Pending
                </span>
              )}
            </div>
          </div>

          <div className="m-tile">
            <div className="m-tile-label mb-1.5">Payroll cut-off</div>
            <div className="m-stat">
              6 <span className="text-[15px] font-semibold text-[color:var(--m-muted-2)]">days</span>
            </div>
            <div className="m-bar">
              <span className="w-[72%] bg-[color:var(--m-amber)]" />
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex items-stretch gap-3.5">
          <div className="min-w-0 flex-1 rounded-xl border border-[color:var(--m-border-inner)] px-3.5 py-3">
            <div className="m-tile-label mb-2">Live check-ins</div>
            <div className="flex flex-col gap-[7px]">
              {feed.map((row, i) => (
                <div
                  key={`${row.n}-${row.t}-${i}`}
                  className="flex min-w-0 items-center gap-2 text-[12.5px]"
                  style={i === 0 ? { animation: "m-seq-in .45s cubic-bezier(.2,.9,.3,1) both" } : undefined}
                >
                  <span className="size-[7px] flex-none rounded-full bg-[color:var(--m-green)]" />
                  <span className="truncate font-semibold">{row.n}</span>
                  <span className="truncate text-[color:var(--m-muted-2)]">{row.p}</span>
                  <span className="m-num ml-auto flex-none text-[color:var(--m-muted-2)]">{row.t}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="m-mapgrid-tight relative w-[104px] flex-none overflow-hidden rounded-xl border border-[color:var(--m-border-inner)]">
            <span className="absolute left-1/2 top-[44%] -m-[5px] size-2.5 rounded-full border-2 border-white bg-[color:var(--m-red)] shadow-[0_1px_4px_rgba(16,37,63,.3)]" />
            <span
              className="absolute left-1/2 top-[44%] -m-[5px] size-2.5 rounded-full bg-[color:var(--m-red)]"
              style={{ animation: "m-pulse-ring 3s ease-out infinite" }}
            />
            <span className="absolute inset-x-0 bottom-1.5 text-center text-[10px] font-semibold text-[color:var(--m-muted-2)]">
              Jaipur whse
            </span>
          </div>
        </div>
      </div>

      <div className="absolute -left-1.5 -bottom-6 z-[2] w-[190px] rounded-[20px] border border-[color:var(--m-border)] bg-white p-4 shadow-[0_20px_48px_rgba(16,37,63,.18)]">
        <div className="mb-3 flex justify-between text-[10.5px] font-semibold text-[color:var(--m-muted-2)]">
          <span>FlowHRMS · Field</span>
          <span className="m-num">09:12</span>
        </div>
        <div className="mb-0.5 font-[family-name:var(--m-font-head)] text-[15px] font-bold">
          Namaste, Ramesh
        </div>
        <div className="mb-3 text-[11.5px] text-[color:var(--m-muted)]">Shift A · Jaipur warehouse</div>
        <div className="rounded-xl bg-[color:var(--m-green)] p-[13px] text-center text-sm font-bold text-white shadow-[0_3px_8px_rgba(47,158,111,.35)]">
          ✓ Checked in
        </div>
        <div className="mt-[11px] flex items-center gap-1.5 text-[10.5px] text-[color:var(--m-muted-2)]">
          <span className="size-[7px] flex-none rounded-full bg-[color:var(--m-red)]" />
          Location verified at check-in only
        </div>
      </div>
    </div>
  );
}
