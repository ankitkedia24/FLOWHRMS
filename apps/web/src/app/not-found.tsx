import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

/** 404 state — explains itself and offers a way back. */
export default function NotFoundPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <EmptyState
        title="This page doesn't exist."
        body="Check the link, or go back to your home screen."
        action={
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-button bg-brand-primary px-5 font-heading text-label text-text-on-primary hover:bg-brand-primary-hover"
          >
            Go to Home
          </Link>
        }
      />
    </main>
  );
}
