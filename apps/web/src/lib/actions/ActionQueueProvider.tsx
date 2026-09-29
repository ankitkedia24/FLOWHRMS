"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { pollActionTilesAction } from "./tile-actions";
import {
  playChime,
  setSoundEnabled,
  soundEnabled,
  soundServerSnapshot,
  subscribeSound,
  unlockAudio,
} from "./chime";
import type { ActionTile } from "./service";

/**
 * Keeps the action queue current and tells the shell when something new
 * arrives.
 *
 * **Polling, not sockets.** RLS denies the anon key everything by design
 * (OPERATIONS.md), so Supabase Realtime would need a hole opened in it for
 * a convenience feature. A 30-second poll against a server action is worth
 * far less than that hole.
 *
 * The poll pauses while the tab is hidden and runs once on return: a phone
 * in a pocket should not spend the shift waking its radio.
 */

interface ActionQueue {
  tiles: ActionTile[];
  unread: number;
  timezone: string;
  serverNow: Date;
  loading: boolean;
  soundOn: boolean;
  toggleSound: () => void;
  refresh: () => Promise<void>;
  /** Drop a tile locally the moment it is decided, before the next poll. */
  dismiss: (id: string) => void;
}

const Ctx = createContext<ActionQueue | null>(null);

export function useActionQueue(): ActionQueue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActionQueue must be used inside ActionQueueProvider");
  return ctx;
}

const POLL_MS = 30_000;

export function ActionQueueProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  /** False for signed-out or fixture sessions — then this does nothing. */
  enabled: boolean;
}) {
  const [tiles, setTiles] = useState<ActionTile[]>([]);
  const [unread, setUnread] = useState(0);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [serverNow, setServerNow] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const soundOn = useSyncExternalStore(
    subscribeSound,
    soundEnabled,
    soundServerSnapshot,
  );

  // Which tiles we have already chimed for, so a repeat poll is silent.
  const announced = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const result = await pollActionTilesAction();
      setTiles(result.tiles);
      setUnread(result.unread);
      setTimezone(result.timezone);
      setServerNow(new Date(result.serverNow));

      const fresh = result.tiles.filter((t) => !announced.current.has(t.id));
      for (const t of result.tiles) announced.current.add(t.id);

      // Silent on the very first load: arriving at a screen with four things
      // already waiting is not an event, and chiming at it trains people to
      // ignore the sound.
      if (!firstLoad.current && fresh.length > 0) playChime();
      firstLoad.current = false;
    } catch {
      // A failed poll is not worth interrupting anyone over; the next one
      // will pick it up, and nothing is lost because nothing is stored here.
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    // Deferred by a frame: calling it in the effect body would set state
    // during the same commit and cascade a render.
    const first = window.requestAnimationFrame(() => void refresh());

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.cancelAnimationFrame(first);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, refresh]);

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundEnabled(next);
    if (next) {
      // We are inside a click, which is the only moment audio can be
      // unlocked. Play once so the person hears what they just turned on.
      unlockAudio();
      window.setTimeout(playChime, 60);
    }
  }, [soundOn]);

  const dismiss = useCallback((id: string) => {
    setTiles((current) => current.filter((t) => t.id !== id));
  }, []);

  return (
    <Ctx.Provider
      value={{
        tiles,
        unread,
        timezone,
        serverNow,
        loading,
        soundOn,
        toggleSound,
        refresh,
        dismiss,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
