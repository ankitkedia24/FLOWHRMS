"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
  offlineStorageAvailable,
  listActions,
  putAction,
} from "./store";
import { runSync } from "./sync";
import type { QueuedAction, QueuedKind } from "./queue";

/**
 * Connection state and the queue of work waiting to be sent.
 *
 * Sync is attempted when the connection returns, when the app loads, and
 * when the tab becomes visible again — a phone that regained signal in a
 * pocket should not need the app reopened to catch up.
 */
interface OfflineContextValue {
  online: boolean;
  /** Items waiting to send (excludes ones that failed for good). */
  pending: QueuedAction[];
  /** Items the server refused — the person needs to see these. */
  failed: QueuedAction[];
  storageAvailable: boolean;
  /** Save work for later. Returns false if this browser cannot. */
  enqueue: (
    kind: QueuedKind,
    payload: unknown,
    capturedAt?: Date,
  ) => Promise<boolean>;
  /** Try to send everything now. */
  sync: () => Promise<void>;
  refresh: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function useOffline(): OfflineContextValue {
  const value = useContext(OfflineContext);
  if (!value) {
    throw new Error("useOffline must be used inside OfflineProvider");
  }
  return value;
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { show } = useToast();
  const [online, setOnline] = useState(true);
  const [actions, setActions] = useState<QueuedAction[]>([]);
  const [storageAvailable, setStorageAvailable] = useState(true);

  const refresh = useCallback(async () => {
    if (!offlineStorageAvailable()) return;
    try {
      setActions(await listActions());
    } catch {
      // A browser with IndexedDB blocked: fail quiet here, the flag below
      // is what the UI uses to warn.
    }
  }, []);

  const sync = useCallback(async () => {
    if (!offlineStorageAvailable()) return;
    const summary = await runSync();
    await refresh();
    if (summary.message && summary.variant) {
      // One summary, never one message per item.
      show({ variant: summary.variant, message: summary.message });
    }
    if (summary.sent > 0) router.refresh();
  }, [refresh, router, show]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setStorageAvailable(offlineStorageAvailable());
      setOnline(navigator.onLine);
      void refresh();
      if (navigator.onLine) void sync();
    });

    const goOnline = () => {
      setOnline(true);
      void sync();
    };
    const goOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void sync();
      }
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, sync]);

  const enqueue = useCallback(
    async (kind: QueuedKind, payload: unknown, capturedAt?: Date) => {
      if (!offlineStorageAvailable()) return false;
      try {
        await putAction({
          id: crypto.randomUUID(),
          kind,
          payload,
          capturedAt: (capturedAt ?? new Date()).toISOString(),
          attempts: 0,
        });
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [refresh],
  );

  return (
    <OfflineContext.Provider
      value={{
        online,
        pending: actions.filter((a) => !a.failedPermanently),
        failed: actions.filter((a) => a.failedPermanently),
        storageAvailable,
        enqueue,
        sync,
        refresh,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}
