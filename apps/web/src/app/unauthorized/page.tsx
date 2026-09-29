import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "No access" };

/**
 * No-access state (component-specifications.md §22 / §24).
 * Explains who to ask; never a dead end; never reveals whether a record
 * exists. Also shown to authenticated accounts that have no company
 * membership yet — Sign out is their way back.
 */
export default function UnauthorizedPage() {
  return (
    <main
      data-surface="employee"
      className="flex min-h-dvh items-center justify-center px-5"
    >
      <EmptyState
        title="You don't have access to this."
        body="Ask your company owner if you need it. If you signed in with a new account, your company may not have set it up yet."
        action={
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-button bg-brand-primary px-5 font-heading text-label text-text-on-primary hover:bg-brand-primary-hover"
            >
              Go to Home
            </Link>
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                className="inline-flex h-11 items-center rounded-button border-[1.5px] border-border-strong bg-surface-default px-5 font-heading text-label text-text-primary hover:bg-surface-sunken"
              >
                Sign out
              </button>
            </form>
          </div>
        }
      />
    </main>
  );
}
