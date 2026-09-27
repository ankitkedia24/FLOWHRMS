"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FlowHRMSLockup, FlowHRMSWordmark } from "@/components/brand/FlowHRMSWordmark";

/**
 * The marketing header: fixed, translucent, shrinking on scroll, with a
 * slide-in drawer under 768px.
 *
 * Desktop and mobile are BOTH rendered and switched with CSS breakpoints
 * rather than a JavaScript width check. A width check has to guess during
 * server rendering, and whatever it guesses is wrong for half the visitors
 * — which is a hydration mismatch on the most-visited page in the product.
 * The media query costs nothing and cannot disagree with itself.
 */

/**
 * Rooted at "/" rather than bare fragments: this header now sits above
 * /demo as well as the homepage, and a bare "#pricing" over there scrolls
 * to nothing. "/#pricing" goes home and lands on the section from either.
 */
const LINKS = [
  { href: "/#how", label: "Product" },
  { href: "/#usecases", label: "Modules" },
  { href: "/#pricing", label: "Pricing" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Send focus back where it came from, or the drawer's closure strands
    // a keyboard user at the top of the document.
    opener.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    // The page behind a full-height drawer must not scroll under it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  return (
    <>
      <nav className="m-nav" data-scrolled={scrolled ? "true" : "false"} aria-label="Main">
        <Link href="/" className="flex items-center" aria-label="FlowHRMS home">
          <FlowHRMSWordmark height={28} className="md:hidden" />
          <FlowHRMSLockup height={28} className="hidden md:inline-flex" />
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="m-nav-link">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/sign-in"
            className="px-3.5 py-2.5 text-[14.5px] font-semibold text-[color:var(--m-navy)] hover:text-[color:var(--m-red)]"
          >
            Sign in
          </Link>
          <Link
            href="/start"
            className="rounded-[12px] bg-[color:var(--m-red)] px-5 py-[11px] text-[14.5px] font-semibold text-white shadow-[0_2px_6px_rgba(240,78,48,.3)] transition-[transform,background] duration-[180ms] hover:-translate-y-0.5 hover:bg-[color:var(--m-red-hover)] hover:text-white"
          >
            Start free trial
          </Link>
        </div>

        <div className="flex items-center gap-2.5 md:hidden">
          <Link
            href="/start"
            className="whitespace-nowrap rounded-[11px] bg-[color:var(--m-red)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Free trial
          </Link>
          <button
            ref={opener}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="flex size-11 flex-col items-center justify-center gap-1 rounded-[11px] border border-[color:var(--m-border-strong)] bg-white"
          >
            <span className="block h-0.5 w-[18px] bg-[color:var(--m-navy)]" />
            <span className="block h-0.5 w-[18px] bg-[color:var(--m-navy)]" />
            <span className="block h-0.5 w-[18px] bg-[color:var(--m-navy)]" />
          </button>
        </div>
      </nav>

      {open && (
        <>
          <div
            onClick={close}
            className="fixed inset-0 z-[70] bg-[rgba(16,37,63,.45)]"
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-y-0 right-0 z-[71] flex w-[min(320px,85vw)] flex-col gap-2 bg-[color:var(--m-navy)] p-6 text-[color:var(--m-cream)]"
          >
            <div className="mb-5 flex items-center justify-between">
              <FlowHRMSWordmark height={24} tone="dark" />
              <button
                ref={closeButton}
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="size-11 rounded-[11px] border border-[rgba(245,245,245,.25)] text-lg text-[color:var(--m-cream)]"
              >
                ✕
              </button>
            </div>
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={close} className="m-drawer-link">
                {l.label}
              </Link>
            ))}
            <Link href="/sign-in" onClick={close} className="m-drawer-link border-b-0">
              Sign in
            </Link>
            <Link
              href="/start"
              onClick={close}
              className="mt-auto rounded-[12px] bg-[color:var(--m-red)] p-[15px] text-center font-semibold text-white"
            >
              Start free trial
            </Link>
          </div>
        </>
      )}
    </>
  );
}
