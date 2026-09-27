import Link from "next/link";
import { FlowHRMSLockup } from "@/components/brand/FlowHRMSWordmark";
import { CONTROLLER } from "@/lib/consent/documents";

/**
 * Terms, Privacy Policy and the consent notices. Public, plain and
 * printable: these are read before signing up and may be produced as
 * evidence, so nothing here depends on being signed in.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-surface="employee" className="min-h-dvh bg-surface-canvas">
      <header className="border-b border-border-default bg-surface-default">
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-4 px-5 py-4">
          <Link href="/" aria-label="FlowHRMS home">
            <FlowHRMSLockup height={26} />
          </Link>
          <nav aria-label="Legal" className="flex flex-wrap gap-4 text-label">
            <Link href="/terms" className="text-brand-primary underline-offset-2 hover:underline">
              Terms
            </Link>
            <Link href="/privacy" className="text-brand-primary underline-offset-2 hover:underline">
              Privacy
            </Link>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[860px] px-5 py-8 print:py-0">
        {children}
      </main>
      <footer className="mx-auto max-w-[860px] px-5 pb-10 text-caption text-text-tertiary">
        {CONTROLLER.name} · {CONTROLLER.email} · {CONTROLLER.phone}
      </footer>
    </div>
  );
}
