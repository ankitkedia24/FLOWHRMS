"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { useActionQueue } from "@/lib/actions/ActionQueueProvider";
import { soundSupported } from "@/lib/actions/chime";
import { cn } from "@/lib/cn";

/**
 * The bell, and the control for the sound.
 *
 * The badge counts **decisions waiting** first and unread notices second,
 * because they are different things: one is work, the other is news. When
 * both exist the badge shows the decisions and the accessible name says
 * both, so a screen-reader user is not given the smaller truth.
 *
 * The sound toggle lives here rather than in Settings on purpose — the
 * moment someone wants to turn a sound off is the moment it just went off,
 * and making them hunt through Settings for it is how a product earns
 * having its notifications disabled at the OS level instead.
 */
export function NotificationBell({
  initialUnread = 0,
}: {
  initialUnread?: number;
}) {
  const { tiles, unread, soundOn, toggleSound } = useActionQueue();
  const pathname = usePathname();
  const onNotifications = pathname === "/notifications";

  // Whether audio exists is only knowable in the browser, and answering
  // it during render made the server and client disagree — a hydration
  // failure on every page with a top bar. Both now render WITHOUT the
  // button first; it appears a frame after mount where supported. The
  // deferred set (inside rAF) keeps this out of the render-cascade trap.
  const [hasAudio, setHasAudio] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setHasAudio(soundSupported()));
    return () => cancelAnimationFrame(id);
  }, []);

  const decisions = tiles.length;
  // Before the first poll returns, the server-rendered count is the truth.
  const notices = unread || initialUnread;
  const badge = decisions > 0 ? decisions : notices;

  const label =
    decisions > 0 && notices > 0
      ? `Notifications: ${decisions} waiting for a decision, ${notices} unread`
      : decisions > 0
        ? `Notifications: ${decisions} waiting for a decision`
        : notices > 0
          ? `Notifications, ${notices} unread`
          : "Notifications";

  return (
    <div className="flex items-center gap-1">
      {hasAudio && (
        <IconButton
          // Kept short deliberately: the tooltip is centred on the button,
          // and this button sits at the right edge of a 375px screen, so a
          // long label renders off-screen. The icon already carries the
          // current state; the label says what pressing it does.
          label={soundOn ? "Turn sound off" : "Turn sound on"}
          onClick={toggleSound}
        >
          {soundOn ? <Volume2 /> : <VolumeX />}
        </IconButton>
      )}

      {/* On /notifications this link goes nowhere, which reads as a broken
          button — it was reported as one. It now says "you are here"
          instead: the same answer a nav item gives, in colour AND in the
          accessible name, never colour alone. */}
      <Link
        href="/notifications"
        aria-label={onNotifications ? `${label} — you are here` : label}
        aria-current={onNotifications ? "page" : undefined}
        className={cn(
          "relative inline-flex size-11 items-center justify-center rounded-button",
          "focus-visible:outline-none focus-visible:[box-shadow:var(--fh-shadow-focus-ring)]",
          onNotifications
            ? "bg-brand-primary-subtle text-brand-primary"
            : "text-text-secondary hover:bg-surface-sunken",
        )}
      >
        <Bell aria-hidden="true" />
        {badge > 0 && (
          <span
            aria-hidden="true"
            className={
              decisions > 0
                ? "absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-status-warning-fg px-1 font-mono text-[10px] font-semibold text-white"
                : "absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-brand-primary px-1 font-mono text-[10px] font-semibold text-text-on-primary"
            }
          >
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </Link>
    </div>
  );
}
