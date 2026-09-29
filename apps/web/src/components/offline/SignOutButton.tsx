"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useOffline } from "@/lib/offline/OfflineProvider";
import { clearActions } from "@/lib/offline/store";
import { describeQueue } from "@/lib/offline/queue";

/**
 * Sign out, but never silently discard work.
 *
 * Queued items belong to this person's session — the next person to sign
 * in on this phone must not inherit them, and they cannot be sent after
 * the session ends. So signing out with unsent work asks first and says
 * exactly what would be lost, rather than dropping it quietly.
 */
export function SignOutButton() {
  const { online, pending, sync } = useOffline();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const waiting = describeQueue(pending.length);

  if (!waiting) {
    return (
      <form action="/auth/sign-out" method="post">
        <Button type="submit" variant="outline" size="lg" className="w-full">
          Sign out
        </Button>
      </form>
    );
  }

  if (!confirming) {
    return (
      <div>
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => setConfirming(true)}
        >
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Alert variant="warning" title={`${waiting}`}>
        {online
          ? "Send it before signing out, or it will be lost — it can't be sent once you sign out."
          : "It can't be sent while you're offline, and it will be lost if you sign out now. Reconnect first if you can."}
      </Alert>

      {online && (
        <Button
          size="lg"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await sync();
            setBusy(false);
          }}
        >
          Send now
        </Button>
      )}

      <form
        action="/auth/sign-out"
        method="post"
        onSubmit={() => {
          // Cleared only after the person has been told and chosen.
          void clearActions();
        }}
      >
        <Button
          type="submit"
          variant="dangerSubtle"
          size="lg"
          className="w-full"
        >
          Sign out and discard
        </Button>
      </form>

      <Button variant="outline" size="lg" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}
