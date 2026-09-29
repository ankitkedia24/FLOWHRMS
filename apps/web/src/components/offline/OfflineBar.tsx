"use client";

import { CloudOff, TriangleAlert } from "lucide-react";
import { useOffline } from "@/lib/offline/OfflineProvider";
import { describeQueue } from "@/lib/offline/queue";

/**
 * The offline bar (empty-loading-error-states.md §5).
 *
 * Persistent and NOT dismissible while offline — a dismissible warning
 * about lost connectivity is a warning the person will miss. It also
 * reports what is still waiting, so "Waiting to send" is never a claim
 * without evidence.
 */
export function OfflineBar() {
  const { online, pending, failed, storageAvailable } = useOffline();

  // A browser that cannot store anything must say so BEFORE someone
  // relies on it, not after their work is lost.
  if (!storageAvailable) {
    return (
      <div
        role="status"
        className="flex items-start gap-2 border-b border-status-warning-border bg-status-warning-bg px-5 py-2.5"
      >
        <TriangleAlert
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-status-warning-fg"
        />
        <p className="text-secondary text-status-warning-text">
          This browser can&apos;t save work offline. Stay connected while you
          check in or send proof.
        </p>
      </div>
    );
  }

  if (failed.length > 0) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 border-b border-status-error-border bg-status-error-bg px-5 py-2.5"
      >
        <TriangleAlert
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-status-error-fg"
        />
        <p className="text-secondary text-status-error-text">
          {failed.length === 1
            ? "1 item couldn't be sent."
            : `${failed.length} items couldn't be sent.`}{" "}
          {failed[0]?.lastError ?? "Try again, or tell your manager."}
        </p>
      </div>
    );
  }

  if (online) {
    // Connected but still catching up — say so rather than showing nothing.
    const waiting = describeQueue(pending.length);
    if (!waiting) return null;
    return (
      <div
        role="status"
        className="flex items-center gap-2 border-b border-status-info-border bg-status-info-bg px-5 py-2.5"
      >
        <CloudOff
          aria-hidden="true"
          className="size-4 shrink-0 text-status-info-fg"
        />
        <p className="text-secondary text-status-info-text">
          Sending… {waiting}
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-status-info-border bg-status-info-bg px-5 py-2.5"
    >
      <CloudOff
        aria-hidden="true"
        className="size-4 shrink-0 text-status-info-fg"
      />
      <p className="text-secondary text-status-info-text">
        No internet — working offline.
        {pending.length > 0 && ` ${describeQueue(pending.length)}`} Nothing is
        lost.
      </p>
    </div>
  );
}

/**
 * The admin counterpart. Approvals, payroll and configuration are
 * deliberately NOT queued — FlowHRMS will not accept a decision it cannot
 * guarantee — so the admin shell says so plainly instead.
 */
export function AdminOfflineBar() {
  const { online } = useOffline();
  if (online) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2 border-b border-status-warning-border bg-status-warning-bg px-5 py-2.5 lg:px-8"
    >
      <CloudOff
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-status-warning-fg"
      />
      <p className="text-secondary text-status-warning-text">
        No internet. Approvals, payroll and settings need a connection —
        they are not saved for later, so nothing is decided by accident.
      </p>
    </div>
  );
}
