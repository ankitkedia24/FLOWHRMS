"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, Check, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useActionQueue } from "@/lib/actions/ActionQueueProvider";
import { approveFromTileAction, snoozeTileAction } from "@/lib/actions/tile-actions";
import { APPROVE_INLINE, openLabel } from "@/lib/actions/kinds";
import { snoozeOptions } from "@/lib/actions/snooze";
import type { ActionTile } from "@/lib/actions/service";

/**
 * The decision tile.
 *
 * Anchored above the bottom navigation on a phone and bottom-right on
 * desktop. Deliberately NOT a modal: a modal blocks the screen, and someone
 * being asked to approve a leave request is usually in the middle of doing
 * something else. It is dismissible for now (snooze), never dismissible
 * forever — the only way a tile leaves permanently is a decision.
 *
 * One at a time. A stack of eleven tiles is a list, and a list belongs on
 * the review screen where there is room to compare. The count says how many
 * are behind this one.
 */
export function ActionTiles() {
  const { tiles, timezone, serverNow, dismiss, refresh } = useActionQueue();
  const [snoozing, setSnoozing] = useState(false);

  if (tiles.length === 0) return null;
  const tile = tiles[0];

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--fh-layout-bottom-nav-height,64px)+12px)] z-40 flex justify-center px-4 lg:bottom-6 lg:right-6 lg:left-auto lg:justify-end lg:px-0"
      role="region"
      aria-label="Decisions waiting for you"
    >
      <TileCard
        key={tile.id}
        tile={tile}
        remaining={tiles.length - 1}
        timezone={timezone}
        serverNow={serverNow}
        snoozing={snoozing}
        onSnoozing={setSnoozing}
        onGone={(id) => {
          dismiss(id);
          void refresh();
        }}
      />
    </div>
  );
}

function TileCard({
  tile,
  remaining,
  timezone,
  serverNow,
  snoozing,
  onSnoozing,
  onGone,
}: {
  tile: ActionTile;
  remaining: number;
  timezone: string;
  serverNow: Date;
  snoozing: boolean;
  onSnoozing: (value: boolean) => void;
  onGone: (id: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const inline = APPROVE_INLINE[tile.kind];

  const options = snoozeOptions(serverNow, timezone);

  return (
    <div
      className="pointer-events-auto w-full max-w-[420px] rounded-surface-card border border-border-strong bg-surface-default p-4 shadow-elevation-3"
      role="group"
      aria-labelledby={`tile-title-${tile.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            id={`tile-title-${tile.id}`}
            className="text-body font-semibold text-text-primary"
          >
            {tile.title}
          </p>
          {tile.body && (
            <p className="mt-0.5 text-secondary text-text-secondary">{tile.body}</p>
          )}
          <p className="mt-1 text-caption text-text-tertiary">{tile.reason}</p>
        </div>
        {remaining > 0 && (
          <span className="shrink-0 rounded-pill bg-surface-sunken px-2 py-1 font-mono text-[11px] text-text-secondary tabular-nums">
            +{remaining}
          </span>
        )}
      </div>

      {snoozing ? (
        <div className="mt-4">
          <p className="text-label text-text-primary">Ask me again in…</p>
          <div className="mt-2 flex flex-col gap-2">
            {options.map((option) => (
              <Button
                key={option.key}
                variant="outline"
                size="sm"
                loading={pending}
                className="justify-start"
                onClick={() =>
                  startTransition(async () => {
                    const result = await snoozeTileAction({
                      actionRequestId: tile.id,
                      optionKey: option.key,
                    });
                    toast.show({
                      variant: result.ok ? "neutral" : "error",
                      message: result.ok ? result.message : result.error,
                    });
                    onSnoozing(false);
                    if (result.ok) onGone(tile.id);
                  })
                }
              >
                {option.label}
              </Button>
            ))}
            <Button
              variant="tertiary"
              size="sm"
              className="justify-start"
              onClick={() => onSnoozing(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {inline.allowed && (
            <Button
              size="sm"
              loading={pending}
              leadingIcon={<Check aria-hidden="true" />}
              onClick={() =>
                startTransition(async () => {
                  const result = await approveFromTileAction({
                    actionRequestId: tile.id,
                  });
                  toast.show({
                    variant: result.ok ? "success" : "error",
                    message: result.ok ? result.message : result.error,
                  });
                  if (result.ok) {
                    onGone(tile.id);
                    router.refresh();
                  }
                })
              }
            >
              Approve
            </Button>
          )}
          <Button
            variant={inline.allowed ? "outline" : "primary"}
            size="sm"
            trailingIcon={<ChevronRight aria-hidden="true" />}
            onClick={() => router.push(tile.href)}
            aria-label={
              inline.allowed
                ? `${openLabel(tile.kind)} — ${tile.title}`
                : `${openLabel(tile.kind)} — ${tile.title}. ${inline.because ?? ""}`
            }
          >
            {openLabel(tile.kind)}
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            leadingIcon={<AlarmClock aria-hidden="true" />}
            onClick={() => onSnoozing(true)}
          >
            Snooze
          </Button>
        </div>
      )}

      {!inline.allowed && inline.because && !snoozing && (
        <p className="mt-2 text-caption text-text-tertiary">{inline.because}</p>
      )}

      {tile.snoozeCount >= 3 && !snoozing && (
        <p className="mt-2 flex items-center gap-1 text-caption text-status-warning-text">
          <X className="size-3.5" aria-hidden="true" />
          Snoozed {tile.snoozeCount} times.
        </p>
      )}
    </div>
  );
}
