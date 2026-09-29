import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { ToastProvider } from "@/components/ui/Toast";
import { FlowHRMSWordmark } from "@/components/brand/FlowHRMSWordmark";

/**
 * The operator's surface — the only one in FlowHRMS that shows more than one
 * company at a time.
 *
 * It deliberately does NOT reuse the admin shell. That shell puts a single
 * tenant's name in the top bar as a multi-tenant safety cue, and wearing it
 * here would say the opposite of the truth. This band says whose screen you
 * are on, permanently, so "which company am I looking at?" is never a
 * question you answer from memory.
 */
export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePlatformAdmin();

  return (
    <div data-surface="admin" className="min-h-dvh bg-surface-canvas">
      <ToastProvider>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface-default focus:px-3 focus:py-2"
        >
          Skip to content
        </a>

        {/* Not decoration. Every other screen in FlowHRMS belongs to exactly one
            company; this one does not, and it should be impossible to
            forget that. */}
        <div className="bg-text-primary px-5 py-2 text-center lg:px-8">
          <p className="micro-label text-surface-default">
            Platform operations · every company · signed in as{" "}
            {session.user.displayName}
          </p>
        </div>

        <header className="border-b border-border-default bg-surface-default">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 lg:px-8">
            <FlowHRMSWordmark height={24} />
            <nav aria-label="Platform" className="flex flex-wrap gap-1">
              <Link
                href="/platform"
                className="inline-flex min-h-11 items-center rounded-button px-3 text-label text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
              >
                Companies
              </Link>
              <Link
                href="/platform/enquiries"
                className="inline-flex min-h-11 items-center rounded-button px-3 text-label text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
              >
                Enquiries
              </Link>
              <Link
                href="/platform/new"
                className="inline-flex min-h-11 items-center rounded-button px-3 text-label text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
              >
                Add a company
              </Link>
              {/* DPDP: proof of consent, rights requests, and the texts. */}
              <Link
                href="/platform/consents"
                className="inline-flex min-h-11 items-center rounded-button px-3 text-label text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
              >
                Consents
              </Link>
              <Link
                href="/platform/data-requests"
                className="inline-flex min-h-11 items-center rounded-button px-3 text-label text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
              >
                Data requests
              </Link>
              <Link
                href="/platform/notices"
                className="inline-flex min-h-11 items-center rounded-button px-3 text-label text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
              >
                Notices
              </Link>
              {/* Money in: plan prices and modules, invoices and payments. */}
              <Link
                href="/platform/plans"
                className="inline-flex min-h-11 items-center rounded-button px-3 text-label text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
              >
                Plans
              </Link>
              <Link
                href="/platform/billing"
                className="inline-flex min-h-11 items-center rounded-button px-3 text-label text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
              >
                Billing
              </Link>
              <Link
                href="/platform/settings"
                className="inline-flex min-h-11 items-center rounded-button px-3 text-label text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
              >
                Settings
              </Link>
            </nav>
            <div className="ms-auto flex items-center gap-2">
              <Link
                href="/"
                className="inline-flex min-h-11 items-center rounded-button px-3 text-label text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
              >
                My workspace
              </Link>
              <Link
                href="/account"
                className="inline-flex min-h-11 items-center rounded-button px-3 text-label text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
              >
                Account
              </Link>
              <form action="/auth/sign-out" method="post">
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center rounded-button px-3 text-label text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>

        <main
          id="main"
          className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-5 lg:px-8"
        >
          {children}
        </main>
      </ToastProvider>
    </div>
  );
}
