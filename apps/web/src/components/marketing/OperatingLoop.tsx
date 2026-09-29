"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "Five things that decide your day" — five tiles, each swapping a scene in
 * the panel beside them. Under 768px the same five become an accordion.
 *
 * Both arrangements are rendered and switched with CSS, not a JavaScript
 * width check, for the reason given in MarketingNav: a guessed width is a
 * hydration mismatch. They share one component so the copy exists once.
 *
 * The scenes are drawn with borders, dots and rules — no icon library, no
 * chart library, no images. Each is a small illustration of a real screen,
 * which is the trust argument marketing is allowed to make (D-018: show
 * the product, not badges or statistics).
 */

interface Tile {
  label: string;
  desc: string;
  dot: string;
  chip: string;
}

const TILES: Tile[] = [
  {
    label: "Attendance",
    desc: "Phone check-in at the branch. Who reached, who is late, who is absent—settled by 9:30 without a single call.",
    dot: "var(--m-red)",
    chip: "Checked in · 09:12",
  },
  {
    label: "Task ownership",
    desc: 'Every job has one name on it and gets closed with a photo or a note. No more "I thought he was doing it".',
    dot: "var(--m-amber)",
    chip: "Task closed · photo attached",
  },
  {
    label: "Leave approval",
    desc: "Requests go straight to the right manager with dates and cover options. Approve or decline in one tap.",
    dot: "var(--m-green)",
    chip: "Approved ✓",
  },
  {
    label: "Payroll visibility",
    desc: "Days present, overtime and advances add themselves up through the month. Cut-off day stops being a fire drill.",
    dot: "var(--m-navy)",
    chip: "₹4,82,600 this cycle",
  },
  {
    label: "Accountability",
    desc: "Every check-in, task and advance is timestamped and attributed. Month-end disputes become a scroll, not an argument.",
    dot: "var(--m-red)",
    chip: "Audit trail · 4 events",
  },
];

const PAY_TOTAL = 482_600;

export function OperatingLoop() {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(0);
  const [payTotal, setPayTotal] = useState(0);
  const frame = useRef(0);
  const settle = useRef(0);

  const countPay = useCallback(() => {
    cancelAnimationFrame(frame.current);
    clearTimeout(settle.current);

    // Whatever happens, the figure ends up correct. A count-up driven by
    // requestAnimationFrame shows ₹0 for as long as frames do not arrive,
    // and frames do not arrive in a backgrounded tab or a non-compositing
    // webview — leaving a wrong number under the words "This cycle so far",
    // which is exactly the kind of animated money figure D-017 warns about.
    settle.current = window.setTimeout(() => setPayTotal(PAY_TOTAL), 1400);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPayTotal(PAY_TOTAL);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 1100);
      setPayTotal(Math.round(PAY_TOTAL * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, []);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(settle.current);
    },
    [],
  );

  const activate = (i: number) => {
    if (i === active) return;
    setActive(i);
    if (i === 3) countPay();
  };

  return (
    <>
      {/* Desktop: tab list + sticky scene panel */}
      <div className="hidden grid-cols-[minmax(280px,360px)_1fr] items-start gap-6 md:grid">
        <div className="flex flex-col gap-2.5" role="tablist" aria-label="Product areas">
          {TILES.map((tile, i) => (
            <button
              key={tile.label}
              type="button"
              role="tab"
              aria-selected={active === i}
              onClick={() => activate(i)}
              onMouseEnter={() => activate(i)}
              onFocus={() => activate(i)}
              className="m-loop-tile"
              data-active={active === i}
            >
              <div className="flex items-center gap-3">
                <span className="m-loop-num">0{i + 1}</span>
                <span className="m-loop-label">{tile.label}</span>
              </div>
              {active === i && (
                <div
                  className="ml-[33px] mt-2 text-[13.5px] leading-[1.5] text-[color:var(--m-muted)]"
                  style={{ animation: "m-seq-in .35s ease both" }}
                >
                  {tile.desc}
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="m-panel">
          {active === 0 && <SceneAttendance />}
          {active === 1 && <SceneTasks />}
          {active === 2 && <SceneLeave />}
          {active === 3 && <ScenePayroll total={payTotal} />}
          {active === 4 && <SceneAudit />}
        </div>
      </div>

      {/* Mobile: accordion, one open at a time */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {TILES.map((tile, i) => (
          <div
            key={tile.label}
            className="overflow-hidden rounded-[14px] border bg-white"
            style={{ borderColor: open === i ? "var(--m-red)" : "var(--m-border)" }}
          >
            <button
              type="button"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? -1 : i)}
              className="flex min-h-[52px] w-full items-center gap-3 px-[18px] py-[17px] text-left"
            >
              <span
                className="font-[family-name:var(--m-font-head)] text-[13px] font-extrabold"
                style={{ color: open === i ? "var(--m-red)" : "var(--m-muted-2)" }}
              >
                0{i + 1}
              </span>
              <span className="flex-1 font-[family-name:var(--m-font-head)] text-[16.5px] font-bold text-[color:var(--m-navy)]">
                {tile.label}
              </span>
              <span aria-hidden="true" className="text-[13px] text-[color:var(--m-muted-2)]">
                {open === i ? "▲" : "▼"}
              </span>
            </button>
            {open === i && (
              <div className="px-[18px] pb-[18px]" style={{ animation: "m-seq-in .35s ease both" }}>
                <div className="mb-3.5 text-[13.5px] leading-[1.5] text-[color:var(--m-muted)]">
                  {tile.desc}
                </div>
                <div className="m-mapgrid relative h-[150px] overflow-hidden rounded-xl border border-[color:var(--m-border-inner)]">
                  <span
                    className="absolute left-[46%] top-[42%] -m-[5px] size-[11px] rounded-full border-2 border-white shadow-[0_1px_5px_rgba(16,37,63,.3)]"
                    style={{ background: tile.dot, animation: "m-pin-pop .5s ease .2s both" }}
                  />
                  <span
                    className="absolute left-[46%] top-[42%] -m-[5px] size-[11px] rounded-full"
                    style={{ background: tile.dot, animation: "m-pulse-ring 2.8s ease-out .5s infinite" }}
                  />
                  <span
                    className="absolute left-[46%] top-[42%] translate-x-[-50%] translate-y-4 whitespace-nowrap rounded-lg bg-[color:var(--m-navy)] px-[9px] py-1 text-[11px] font-semibold text-white"
                    style={{ animation: "m-seq-in .4s ease .6s both" }}
                  >
                    {tile.chip}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------- scenes */

function SceneHead({ children }: { children: React.ReactNode }) {
  return <div className="m-h3 mb-4">{children}</div>;
}

function SceneNote({ children }: { children: React.ReactNode }) {
  return <div className="mt-3.5 text-[13.5px] text-[color:var(--m-muted)]">{children}</div>;
}

function SceneAttendance() {
  return (
    <div className="m-scene">
      <SceneHead>Who reached, where, and when</SceneHead>
      <div className="m-mapgrid relative h-[230px] overflow-hidden rounded-xl border border-[color:var(--m-border-inner)]">
        <span
          className="absolute left-[38%] top-[46%] -m-1.5 size-3 rounded-full border-2 border-white bg-[color:var(--m-red)] shadow-[0_1px_5px_rgba(16,37,63,.3)]"
          style={{ animation: "m-pin-pop .5s ease .3s both" }}
        />
        <span
          className="absolute left-[38%] top-[46%] -m-1.5 size-3 rounded-full bg-[color:var(--m-red)]"
          style={{ animation: "m-pulse-ring 2.8s ease-out .6s infinite" }}
        />
        <span
          className="absolute left-[38%] top-[46%] translate-x-[-50%] translate-y-[18px] whitespace-nowrap rounded-lg bg-[color:var(--m-navy)] px-2.5 py-[5px] text-[11.5px] font-semibold text-white"
          style={{ animation: "m-seq-in .4s ease .7s both" }}
        >
          Ramesh · checked in 09:12
        </span>
        <span
          className="absolute right-[12%] top-[26%] size-[9px] rounded-full border-2 border-white bg-[color:var(--m-green)]"
          style={{ animation: "m-pin-pop .5s ease 1s both" }}
        />
        <span
          className="absolute bottom-[22%] left-[18%] size-[9px] rounded-full border-2 border-white bg-[color:var(--m-green)]"
          style={{ animation: "m-pin-pop .5s ease 1.3s both" }}
        />
      </div>
      <SceneNote>Roll call finishes itself. Late arrivals and no-shows surface by 9:30, per branch.</SceneNote>
    </div>
  );
}

function SceneTasks() {
  return (
    <div className="m-scene">
      <SceneHead>Every task has one owner</SceneHead>
      <div className="grid h-[230px] grid-cols-2 gap-4">
        <div className="relative rounded-xl border border-dashed border-[color:var(--m-border-strong)] p-3">
          <div className="mb-2.5 text-[11.5px] font-bold tracking-[0.08em] text-[color:var(--m-muted-2)]">
            TO DO
          </div>
          <div className="mb-2 rounded-[10px] border border-[color:var(--m-border-inner)] bg-[color:var(--m-cream)] px-3 py-2.5 text-[12.5px] font-semibold">
            Unload truck 4 <span className="font-medium text-[color:var(--m-muted-2)]">· Manoj</span>
          </div>
          <div className="mb-2 rounded-[10px] border border-[color:var(--m-border-inner)] bg-[color:var(--m-cream)] px-3 py-2.5 text-[12.5px] font-semibold">
            Stock count · Bay 2 <span className="font-medium text-[color:var(--m-muted-2)]">· Kavya</span>
          </div>
          <div
            className="relative z-[2] rounded-[10px] border border-[color:var(--m-red)] bg-white px-3 py-2.5 text-[12.5px] font-semibold shadow-[0_6px_16px_rgba(240,78,48,.18)]"
            style={{ animation: "m-task-move 2.6s cubic-bezier(.3,.8,.3,1) .6s both" }}
          >
            Dispatch order #2214 <span className="font-medium text-[color:var(--m-muted-2)]">· Arjun</span>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-[#B9DECB] bg-[rgba(47,158,111,.04)] p-3">
          <div className="mb-2.5 text-[11.5px] font-bold tracking-[0.08em] text-[color:var(--m-green)]">
            DONE ✓
          </div>
          <div className="mb-2 rounded-[10px] border border-[#D3E9DD] bg-white px-3 py-2.5 text-[12.5px] font-semibold text-[color:var(--m-green-text)]">
            Gate register · 08:40
          </div>
          <div className="rounded-[10px] border border-[#D3E9DD] bg-white px-3 py-2.5 text-[12.5px] font-semibold text-[color:var(--m-green-text)]">
            Invoice photos · 08:55
          </div>
        </div>
      </div>
      <SceneNote>
        Assigned by name, closed with proof. &ldquo;I thought he was doing it&rdquo; ends here.
      </SceneNote>
    </div>
  );
}

function SceneLeave() {
  return (
    <div className="m-scene">
      <SceneHead>Leave asked, seen, decided</SceneHead>
      <div className="relative flex h-[230px] items-center justify-between gap-5 px-2">
        <div
          className="z-[2] rounded-xl border border-[color:var(--m-border)] bg-white px-4 py-3.5 shadow-[0_8px_20px_rgba(16,37,63,.1)]"
          style={{ animation: "m-leave-go 2.4s cubic-bezier(.3,.8,.3,1) .5s both" }}
        >
          <div className="text-[13px] font-bold">Priya S.</div>
          <div className="my-0.5 mb-2 text-xs text-[color:var(--m-muted)]">2 days · family function</div>
          <span
            className="relative inline-block rounded-full bg-[rgba(245,185,64,.22)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--m-amber-text)]"
            style={{ animation: "m-chip-out 2.4s .5s both" }}
          >
            Pending
          </span>
          <span
            className="absolute -ml-16 inline-block rounded-full bg-[rgba(47,158,111,.16)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--m-green-text)]"
            style={{ animation: "m-chip-in 2.4s .5s both" }}
          >
            Approved ✓
          </span>
        </div>
        <div className="-mx-2.5 flex-1 border-t-2 border-dashed border-[color:var(--m-border-strong)]" />
        <div className="flex-none rounded-xl bg-[color:var(--m-navy)] px-4 py-3.5 text-[color:var(--m-cream)]">
          <div className="mb-1 text-[11px] font-semibold text-[color:var(--m-on-navy-2)]">MANAGER</div>
          <div className="text-[13px] font-bold">Sanjay D.</div>
          <div className="mt-0.5 text-xs text-[color:var(--m-on-navy-2)]">Decides on the spot</div>
        </div>
      </div>
      <SceneNote>No chits, no missed calls. Requests reach the right manager with cover suggestions.</SceneNote>
    </div>
  );
}

function ScenePayroll({ total }: { total: number }) {
  const rows = [
    { label: "Days present × rate", value: "₹4,26,000", delay: "0.2s", tint: false },
    { label: "Overtime hours", value: "₹68,400", delay: "0.45s", tint: false },
    { label: "Advances deducted", value: "− ₹11,800", delay: "0.7s", tint: true },
  ];
  return (
    <div className="m-scene">
      <SceneHead>Payroll inputs, already added up</SceneHead>
      <div className="flex h-[230px] max-w-[420px] flex-col justify-center gap-2.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex justify-between rounded-[10px] border border-[color:var(--m-border-inner)] px-4 py-3 text-[13.5px]"
            style={{ animation: `m-seq-in .4s ease ${r.delay} both` }}
          >
            <span className="font-semibold text-[color:var(--m-muted)]">{r.label}</span>
            <span
              className="m-num font-bold"
              style={r.tint ? { color: "var(--m-red-deep)" } : undefined}
            >
              {r.value}
            </span>
          </div>
        ))}
        <div
          className="flex justify-between rounded-[10px] bg-[color:var(--m-navy)] px-4 py-3.5 text-[14.5px] text-[color:var(--m-cream)]"
          style={{ animation: "m-seq-in .4s ease .95s both" }}
        >
          <span className="font-semibold">This cycle so far</span>
          <span className="m-num font-[family-name:var(--m-font-head)] font-extrabold">
            ₹{total.toLocaleString("en-IN")}
          </span>
        </div>
      </div>
      <SceneNote>
        Attendance, overtime and advances flow straight into cut-off. No last-night Excel.
      </SceneNote>
    </div>
  );
}

function SceneAudit() {
  const events = [
    { time: "09:12 · Checked in", sub: "Jaipur warehouse · Ramesh", dot: "var(--m-green)", delay: "0.15s" },
    { time: "11:40 · Task closed with photo", sub: "Dispatch order #2214 · Arjun", dot: "var(--m-amber)", delay: "0.55s" },
    { time: "14:05 · Advance recorded", sub: "₹2,000 · approved by Sanjay", dot: "var(--m-red)", delay: "0.95s" },
    { time: "18:31 · Checked out", sub: "Day summary sent to owner", dot: "var(--m-navy)", delay: "1.35s" },
  ];
  return (
    <div className="m-scene">
      <SceneHead>A record nobody argues with</SceneHead>
      <div className="flex h-[230px] max-w-[440px] flex-col justify-center">
        {events.map((e, i) => (
          <div
            key={e.time}
            className="flex gap-3.5"
            style={{ animation: `m-seq-in .45s ease ${e.delay} both` }}
          >
            <div className="flex flex-col items-center">
              <span
                className="size-[11px] rounded-full border-2 border-white"
                style={{ background: e.dot, boxShadow: `0 0 0 1px ${e.dot}` }}
              />
              {i < events.length - 1 && <span className="w-0.5 flex-1 bg-[color:var(--m-border-inner)]" />}
            </div>
            <div className={i < events.length - 1 ? "pb-[18px]" : undefined}>
              <div className="text-[13px] font-bold">{e.time}</div>
              <div className="text-xs text-[color:var(--m-muted-2)]">{e.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <SceneNote>
        Every event is timestamped and attributed. Month-end disputes become a scroll, not a
        shouting match.
      </SceneNote>
    </div>
  );
}
