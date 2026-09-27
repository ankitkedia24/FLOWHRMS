import Link from "next/link";
import { FlowHRMSLockup, FlowHRMSWordmark } from "@/components/brand/FlowHRMSWordmark";

/**
 * Marketing shell (screens M1–M6).
 *
 * Admin surface tokens: this is an owner-facing surface, so it is Disha
 * precision — no warm tokens (brand-guidelines.md §4).
 *
 * Forbidden here and enforced by review: customer names or logos,
 * adoption/accuracy/uptime statistics, compliance or security badges, and
 * any wording implying guaranteed statutory payroll compliance
 * (copy-deck.md §11, decisions D-018 and D-019). Prices are no longer on
 * that list — pricing is set and published; see src/lib/marketing/plans.ts.
 *
 * The homepage is NOT under this layout. It moved to the (home) group with
 * the marketing redesign, which covers the homepage and sign-in only; the
 * pages here keep the product's original design language.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-surface="admin" className="min-h-dvh bg-surface-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface-default focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <header className="border-b border-border-default bg-surface-default">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-5 lg:px-8">
          <Link href="/" aria-label="FlowHRMS home" className="flex items-center">
            <FlowHRMSWordmark height={26} className="md:hidden" />
            <FlowHRMSLockup height={28} className="hidden md:inline-flex" />
          </Link>
          <nav aria-label="Marketing" className="flex items-center gap-1">
            <Link
              href="/product"
              className="hidden rounded-button px-3 py-2 text-label text-text-secondary hover:bg-surface-sunken hover:text-text-primary sm:inline-flex"
            >
              Product
            </Link>
            <Link
              href="/modules"
              className="hidden rounded-button px-3 py-2 text-label text-text-secondary hover:bg-surface-sunken hover:text-text-primary sm:inline-flex"
            >
              Modules
            </Link>
            <Link
              href="/pricing"
              className="hidden rounded-button px-3 py-2 text-label text-text-secondary hover:bg-surface-sunken hover:text-text-primary sm:inline-flex"
            >
              Pricing
            </Link>
            {/* Unlike Product and Pricing, this stays visible on a phone.
                Someone who already has an account is not browsing — they
                are trying to get in, and the header is where they look. */}
            <Link
              href="/sign-in"
              className="inline-flex h-10 items-center rounded-button px-3 font-heading text-label text-text-primary hover:bg-surface-sunken"
            >
              Sign in
            </Link>
            <Link
              href="/start"
              className="inline-flex h-10 items-center rounded-button bg-brand-primary px-4 font-heading text-label text-text-on-primary hover:bg-brand-primary-hover"
            >
              Start free trial
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">{children}</main>

      <footer className="border-t border-border-default bg-surface-default">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-5 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="font-mono text-mono uppercase tracking-micro text-text-tertiary">
              Workforce • Tasks • Attendance • Payroll
            </p>
            <p className="mt-1 text-caption text-text-secondary">
              Designed for Indian SMEs.
            </p>
          </div>
          {/* Navigation lives in the header, in one place. Repeating the
              same three links at the bottom made the page look like it had
              two different menus and left "Sign in" reading as a footer
              item long after it moved up. */}
        </div>
      </footer>
    </div>
  );
}
