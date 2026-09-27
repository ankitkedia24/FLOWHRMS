import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { marketingFontVariables } from "../marketing-fonts";
import "@/styles/marketing.css";
import { FlowHRMSLockup } from "@/components/brand/FlowHRMSWordmark";

/**
 * The homepage shell.
 *
 * Its own route group rather than a change to (marketing): the redesign
 * covers the homepage and sign-in, and the other marketing pages —
 * /product, /modules, /pricing, /demo — still speak the product's original
 * design language. Rewriting the shared layout would have wrapped them in
 * a header they were never designed for, which reads worse than a page
 * that is simply the older design throughout.
 *
 * `data-surface="marketing"` is the quarantine boundary: every rule in
 * marketing.css hangs off it, so the palette and typography here can never
 * reach the admin or employee surfaces.
 */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-surface="marketing" className={`${marketingFontVariables} min-h-dvh overflow-x-clip`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-[color:var(--m-navy)]"
      >
        Skip to content
      </a>

      <MarketingNav />

      <main id="main">{children}</main>

      <footer className="bg-[color:var(--m-navy-deep)] px-7 py-9 text-[color:var(--m-on-navy)]">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-5 text-[13px]">
          <div className="flex flex-col gap-2">
            <FlowHRMSLockup height={22} tone="dark" />
            <span className="font-[family-name:var(--m-font-head)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--m-on-navy-2)]">
              Align. Accelerate. Grow.
            </span>
          </div>
          <div className="flex flex-wrap gap-6">
            <Link href="/#how" className="text-[color:var(--m-on-navy)] hover:text-[color:var(--m-cream)]">
              Product
            </Link>
            <Link
              href="/#usecases"
              className="text-[color:var(--m-on-navy)] hover:text-[color:var(--m-cream)]"
            >
              Modules
            </Link>
            <Link
              href="/start"
              className="text-[color:var(--m-on-navy)] hover:text-[color:var(--m-cream)]"
            >
              Start free trial
            </Link>
          </div>
          <div className="flex flex-col gap-1 text-[color:var(--m-on-navy-2)] sm:text-right">
            <span>© Flowacord · Made for Indian SMEs · Phone-first</span>
            <span>
              <a href="mailto:help@flowacord.com" className="hover:text-[color:var(--m-cream)]">
                help@flowacord.com
              </a>
              {" · "}
              <a href="tel:+918908888880" className="hover:text-[color:var(--m-cream)]">
                +91 89088 88880
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
