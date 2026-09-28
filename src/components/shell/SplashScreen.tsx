"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { SPLASH_MAX_SECONDS } from "@/lib/media/bucket";

/**
 * The company's own opening animation, played once when the app opens.
 *
 * - Full screen on every device. When the animation's shape is close to
 *   the screen's it fills edge to edge (a sliver may be trimmed); when it
 *   isn't — an upright video on a wide laptop — it shows whole, with a
 *   blurred copy of itself filling the rest, so nothing is ever cut off.
 * - With sound when the browser allows it. Browsers refuse sound on
 *   anything that starts by itself until the person has tapped the page
 *   (iPhones always refuse), so it then plays silently with a "Tap for
 *   sound" button that restarts it with sound.
 * - At most four seconds of animation, then it fades away. A tap anywhere
 *   else skips it. Once per browser session, per company and animation.
 *   People who ask their device for reduced motion never see it.
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
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [needsTap, setNeedsTap] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const media = useRef<{ w: number; h: number } | null>(null);
  const timers = useRef<number[]>([]);
  const leaveTimer = useRef<number | null>(null);
  const isVideo = mime.startsWith("video/");

  function scheduleLeave(ms: number) {
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(leave, Math.max(0, ms));
  }

  // Fill or fit, from the animation's shape and the screen's.
  function refit() {
    const m = media.current;
    if (!m || !m.w || !m.h) return;
    const ratio = m.w / m.h / (window.innerWidth / window.innerHeight);
    setFit(Math.abs(Math.log(ratio)) < Math.log(1.35) ? "cover" : "contain");
  }

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    };
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
    scheduleLeave(SPLASH_MAX_SECONDS * 1000 - (storageKey ? performance.now() : 0));

    // Try sound. It started muted (the only way it may start by itself);
    // un-muting is allowed only after a tap on this site, so ask and fall
    // back to silent with a "Tap for sound" button.
    const v = video.current;
    if (v) {
      v.muted = false;
      v.play()
        .then(() => {
          // Sound allowed: play it from the start, the full length.
          v.currentTime = 0;
          scheduleLeave(Math.min(SPLASH_MAX_SECONDS, v.duration || SPLASH_MAX_SECONDS) * 1000);
        })
        .catch(() => {
          v.muted = true;
          void v.play().catch(() => undefined);
          setNeedsTap(true);
        });
    }

    window.addEventListener("resize", refit);
    return () => {
      clear();
      window.removeEventListener("resize", refit);
    };
    // Runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function withSound(event: React.MouseEvent) {
    event.stopPropagation();
    const v = video.current;
    if (!v) return;
    v.muted = false;
    v.currentTime = 0;
    void v.play().catch(() => undefined);
    setNeedsTap(false);
    scheduleLeave(Math.min(SPLASH_MAX_SECONDS, v.duration || SPLASH_MAX_SECONDS) * 1000);
  }

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
    video.current?.pause();
    document.getElementById("fh-splash-style")?.remove();
    setPhase("done");
  }

  if (phase === "done") return null;
  const cover = fit === "cover";

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
        className="fh-splash fixed inset-0 z-[100] cursor-pointer items-center justify-center overflow-hidden bg-[#000] transition-opacity duration-300"
        style={{ display: phase === "pending" ? "none" : "flex", opacity: phase === "leaving" ? 0 : 1 }}
        onClick={leave}
        role="presentation"
      >
        {/* When the animation is shown whole, a blurred copy fills the rest of the screen. */}
        {!cover &&
          (isVideo ? (
            <video
              src={src}
              autoPlay
              muted
              playsInline
              aria-hidden="true"
              className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- a GIF must play as-is
            <img src={src} alt="" aria-hidden="true" className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl" />
          ))}

        {isVideo ? (
          <video
            ref={video}
            src={src}
            autoPlay
            muted
            playsInline
            onEnded={leave}
            onLoadedMetadata={(e) => {
              media.current = { w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight };
              refit();
            }}
            className={`relative size-full ${cover ? "object-cover" : "object-contain"}`}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- a GIF must play as-is
          <img
            src={src}
            alt=""
            onLoad={(e) => {
              media.current = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
              refit();
            }}
            className={`relative size-full ${cover ? "object-cover" : "object-contain"}`}
          />
        )}

        {needsTap && (
          <button
            type="button"
            onClick={withSound}
            className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] inline-flex items-center gap-2 rounded-full bg-[rgba(0,0,0,0.55)] px-4 py-2 text-label text-white backdrop-blur-sm"
          >
            <Volume2 className="size-4" aria-hidden="true" />
            Tap for sound
          </button>
        )}
        <span className="absolute bottom-[max(24px,env(safe-area-inset-bottom))] text-caption text-[rgba(255,255,255,0.8)] [text-shadow:0_1px_3px_rgba(0,0,0,.6)]">
          Tap to skip
        </span>
      </div>
    </>
  );
}
