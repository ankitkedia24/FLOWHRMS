"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * Screen-level error state (component-specifications.md §24).
 * What happened + what to do next + Retry. Never a raw code alone.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <ErrorState
        level="screen"
        title="Something on our side failed."
        body="Nothing you entered was lost. Try again, and if it keeps happening tell your admin."
        referenceId={error.digest}
        action={
          <>
            <Button onClick={reset}>Retry</Button>
            <Button variant="outline" onClick={() => router.push("/")}>
              Go to Home
            </Button>
          </>
        }
      />
    </main>
  );
}
