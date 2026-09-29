"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Road distances are worked out just after a page is sent. When some are
 * still coming, look again once, a little later, so they appear without
 * anyone reloading. Once only: a road that can't be found stays an
 * estimate, and asking every few seconds would not change that.
 */
export function RefreshSoon({ afterMs = 8_000 }: { afterMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setTimeout(() => router.refresh(), afterMs);
    return () => window.clearTimeout(id);
  }, [router, afterMs]);
  return null;
}
