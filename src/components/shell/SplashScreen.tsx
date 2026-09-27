"use client";

import { useEffect, useRef, useState } from "react";
import { SPLASH_MAX_SECONDS } from "@/lib/media/bucket";

/**
 * The company's own opening animation, played once when the app opens.
 *
 * - At most four seconds, whatever the file says — then it fades away.
 * - Once per browser session (per company and per animation), not on every
 *   page: it greets, it does not get in the way.
 * - A tap skips it. People who ask their device for reduced motion never
 *   see it.
 *
 * It has to cover the page from the very first paint, before the app's
 * JavaScript runs, or the app flashes up and is then hidden again. So a
 * tiny inline script decides — from sessionStorage — whether to show it,
 * and the component takes over once it hydrates. `storageKey` null is the
 * settings preview: always shown, no script.
 */
export function SplashScreen({
  src,
  mime,
  storageKey,
}: {
  src: string;
  mime: string;
  storageKey: string | null;
}) {
  const [phase, setPhase] = useState<"pending" | "playing" | "leaving" | "done">(
    storageKey ? "pending" : "playing",
  );
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const clear = () => timers.current.forEach((t) => window.clearTimeout(t));
    let seen = false;
    try {
      seen = storageKey !== null && sessionStorage.getItem(storageKey) === "1";
    } catch {
      /* private mode: just show it */
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) {
      timers.current.push(window.setTimeout(finish, 0));
      return clear;
    }
    timers.current.push(window.setTimeout(() => setPhase("playing"), 0));
    // Counted from when the page started, since the splash has been on
    // screen since the first paint.
    const shownFor = storageKey ? performance.now() : 0;
    timers.current.push(window.setTimeout(leave, Math.max(0, SPLASH_MAX_SECONDS * 1000 - shownFor)));
    return clear;
    // Runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function leave() {
    setPhase((p) => (p === "done" || p === "leaving" ? p : "leaving"));
    timers.current.push(window.setTimeout(finish, 300));
  }

  function finish() {
    try {
      if (storageKey) sessionStorage.setItem(storageKey, "1");
    } catch {
      /* nothing to remember */
    }
    document.getElementById("fh-splash-style")?.remove();
    setPhase("done");
  }

  if (phase === "done") return null;
  const isVideo = mime.startsWith("video/");

  return (
    <>
      {storageKey && (
        <script
          // Before first paint: show the overlay only if it hasn't played this session.
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem(${JSON.stringify(storageKey)})!=="1"&&!matchMedia("(prefers-reduced-motion: reduce)").matches){var s=document.createElement("style");s.id="fh-splash-style";s.textContent=".fh-splash{display:flex!important}";document.head.appendChild(s)}}catch(e){}`,
          }}
        />
      )}
      <div
        className="fh-splash fixed inset-0 z-[100] cursor-pointer items-center justify-center bg-white transition-opacity duration-300"
        style={{ display: phase === "pending" ? "none" : "flex", opacity: phase === "leaving" ? 0 : 1 }}
        onClick={leave}
        role="presentation"
      >
        {isVideo ? (
          <video
            src={src}
            autoPlay
            muted
            playsInline
            onEnded={leave}
            className="max-h-[70dvh] max-w-[86vw] object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- a GIF must play as-is
          <img src={src} alt="" className="max-h-[70dvh] max-w-[86vw] object-contain" />
        )}
        <span className="absolute bottom-[max(24px,env(safe-area-inset-bottom))] text-caption text-text-tertiary">
          Tap to skip
        </span>
      </div>
    </>
  );
}
