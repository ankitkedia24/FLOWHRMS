"use client";

import Image from "next/image";
import { useRef, useState } from "react";

/**
 * "Who runs on FlowHRMS" — a snap-scrolling rail of five settings.
 *
 * The photographs are generated, not stock: five settings FlowHRMS is actually
 * built for, shot documentary-style. They are stored as WebP at 1280 wide,
 * which is four times the card's CSS width and gives next/image room to
 * resize down per breakpoint.
 *
 * `alt` describes each scene rather than repeating the card's title. These
 * are content images — someone who cannot see them should learn what the
 * setting looks like, not read "Warehouse" twice.
 *
 * To change an image, replace the file in public/marketing/use-cases/ at
 * roughly 1280×730 or wider. Nothing in this component needs editing.
 */

interface UseCase {
  key: string;
  title: string;
  desc: string;
  chip: string;
  photo: string;
  alt: string;
}

const CARD_W = 320;
const GAP = 18;

const CASES: UseCase[] = [
  {
    key: "warehouse",
    title: "Warehouse",
    desc: "Shift check-ins at the gate, task boards per bay, stock-count jobs with photo proof.",
    chip: "✓ Gate check-in · 08:40",
    photo: "/marketing/use-cases/warehouse.webp",
    alt: "A worker carrying a carton down an aisle of stacked steel racking in a wholesale warehouse, morning light behind him.",
  },
  {
    key: "field",
    title: "Field sales",
    desc: "Day plans, visit check-ins and expense notes—synced before the rep is back on the bike.",
    chip: "📍 Visit logged · Malviya Nagar",
    photo: "/marketing/use-cases/field-sales.webp",
    alt: "A field sales representative standing beside his parked motorcycle on a shop-lined street, checking his phone.",
  },
  {
    key: "retail",
    title: "Retail / trading",
    desc: "Counter rosters, store-open checklists, and advances recorded at the desk, not remembered later.",
    chip: "Store opened · 09:00",
    photo: "/marketing/use-cases/retail.webp",
    alt: "A shopkeeper at the wooden counter of a hardware shop, shelves of pipe fittings and hand tools behind him.",
  },
  {
    key: "dispatch",
    title: "Dispatch & delivery",
    desc: "Trip assignments with proof of completion, so every drop has a name and a timestamp.",
    chip: "Trip closed · POD attached",
    photo: "/marketing/use-cases/dispatch.webp",
    alt: "A driver lifting a sealed carton into the back of a delivery van outside a godown at first light, parcels stacked beside him.",
  },
  {
    key: "branch",
    title: "Multi-branch ops",
    desc: "One owner view across branches, with per-branch cut-offs and comparable day summaries.",
    chip: "4 branches · one view",
    photo: "/marketing/use-cases/multi-branch.webp",
    alt: "A business owner at his desk reading a printed record beside an open laptop, ledgers and files stacked around him.",
  },
];

export function UseCases() {
  const rail = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const onScroll = () => {
    const el = rail.current;
    if (!el) return;
    const step = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? CARD_W;
    const i = Math.round(el.scrollLeft / (step + GAP));
    setIndex(Math.max(0, Math.min(CASES.length - 1, i)));
  };

  return (
    <>
      <div ref={rail} onScroll={onScroll} className="m-uc-rail">
        {CASES.map((uc, i) => (
          <article key={uc.key} className="m-uc-card">
            <div className="relative h-[170px] overflow-hidden">
              <div className="m-uc-media absolute inset-0">
                <Image
                  src={uc.photo}
                  alt={uc.alt}
                  fill
                  sizes="(max-width: 767px) 82vw, 320px"
                  className="object-cover"
                  // The first card is the only one visible without scrolling,
                  // so it is the one worth fetching early; the rest would
                  // just compete with the hero for bandwidth.
                  priority={i === 0}
                />
              </div>
              <span className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-[rgba(16,37,63,.85)] px-[11px] py-1.5 text-[11.5px] font-bold text-[color:var(--m-cream)] backdrop-blur-[4px]">
                {uc.chip}
              </span>
            </div>
            <div className="px-5 pb-5 pt-[18px]">
              <h3 className="mb-1.5 font-[family-name:var(--m-font-head)] text-[18px] font-bold">
                {uc.title}
              </h3>
              <p className="text-[13.5px] leading-[1.5] text-[color:var(--m-muted)]">{uc.desc}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 flex justify-center gap-[7px] md:hidden">
        {CASES.map((uc, i) => (
          <span
            key={uc.key}
            aria-hidden="true"
            className="inline-block h-[7px] rounded-full transition-[width,background] duration-[250ms]"
            style={{
              width: i === index ? 22 : 7,
              background: i === index ? "var(--m-red)" : "var(--m-border-strong)",
            }}
          />
        ))}
      </div>
      <p className="sr-only" role="status">
        Card {index + 1} of {CASES.length}
      </p>
    </>
  );
}
