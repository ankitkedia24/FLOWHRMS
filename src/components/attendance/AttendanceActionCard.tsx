"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CloudOff, LogIn, LogOut, MapPinOff, TriangleAlert } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { TextArea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Loading";
import { useToast } from "@/components/ui/Toast";
import { STATUS, statusLate, type Status } from "@/lib/status";
import { cn } from "@/lib/cn";
import {
  checkInButtonLabel,
  checkInIntent,
  computeCheckInState,
  formatDuration,
  formatShiftTime,
  hasUnrecordedCheckOut,
  workedMinutes,
  MAX_OPEN_VISIT_HOURS,
  type AttendanceContext,
} from "@/lib/attendance/policy";
import { checkInAction, checkOutAction } from "@/lib/attendance/actions";
import { useOffline } from "@/lib/offline/OfflineProvider";

/**
 * Attendance action card (component-specifications.md §26) — the signature
 * employee component.
 *
 * Anatomy: live clock → date → location status as TEXT → consequence
 * banner → one full-width 56px action in the thumb zone → shift line →
 * hours. After acting it becomes a warm confirmation (the single warm
 * element on this screen).
 *
 * Rules honoured here:
 * - The consequence is shown BEFORE the tap and is part of the button's
 *   accessible name.
 * - Location status is never an icon alone.
 * - The button is never tappable while its consequence is unknown — the
 *   chip and action show skeletons until location resolves.
 * - The recorded time comes back from the server and is displayed.
 */

interface Props {
  context: AttendanceContext;
  firstName: string;
}

/**
 * How long the card will wait for a position before giving up and letting
 * the person check in anyway. Longer than the browser's own 10s timeout so
 * a slow but working GPS fix is not cut off early.
 */
const GEO_DEADLINE_MS = 15_000;

type GeoState =
  | { phase: "resolving" }
  | { phase: "ready"; coords: { lat: number; lng: number; accuracyM: number | null } }
  | { phase: "denied" }
  | { phase: "not-required" };

export function AttendanceActionCard({ context, firstName }: Props) {
  const { show } = useToast();
  // Connection state and the queue are shared with the offline bar, so
  // the card and the bar can never disagree about whether we are online.
  const { online, enqueue, pending: queued } = useOffline();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState<Date | null>(null);
  const [geo, setGeo] = useState<GeoState>(
    context.locationRequired ? { phase: "resolving" } : { phase: "not-required" },
  );
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState<{
    message: string;
    detail?: string;
  } | null>(null);
  const [today, setToday] = useState(context.today);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  // Live clock: ticks every second, but is NOT announced (aria-live off).
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    const raf = requestAnimationFrame(() => setNow(new Date()));
    return () => {
      clearInterval(id);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Location is requested at tap time in the real flow; we resolve once on
  // mount so the consequence can be shown before the tap, as the spec
  // requires. The permission prompt is the browser's.
  useEffect(() => {
    if (!context.locationRequired) return;
    let cancelled = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const request = requestAnimationFrame(() => {
      if (!("geolocation" in navigator)) {
        setGeo({ phase: "denied" });
        return;
      }

      // `getCurrentPosition`'s own `timeout` does NOT cover the time the
      // browser spends waiting for someone to answer the permission
      // prompt. Leave that prompt unanswered — tap past it, background the
      // app, or have it suppressed by device policy — and NEITHER callback
      // ever fires. The card then sits on `resolving` for good, and since
      // the Check In button only renders once a location assessment
      // exists, the employee is left staring at a grey placeholder where
      // the button should be, with nothing explaining why.
      //
      // So the wait gets a deadline of its own. Falling through to the
      // same state as a refusal is right: not knowing where someone is is
      // exactly what UNCONFIRMED means, and the product already handles
      // it — check in, give a reason, manager approves.
      watchdog = setTimeout(() => {
        if (!cancelled) setGeo((g) => (g.phase === "resolving" ? { phase: "denied" } : g));
      }, GEO_DEADLINE_MS);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (cancelled) return;
          setGeo({
            phase: "ready",
            coords: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracyM: position.coords.accuracy ?? null,
            },
          });
        },
        () => {
          if (!cancelled) setGeo({ phase: "denied" });
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
      );
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(request);
      if (watchdog) clearTimeout(watchdog);
    };
  }, [context.locationRequired]);

  const checkedIn = Boolean(today?.checkInAt);
  const checkedOut = Boolean(today?.checkOutAt);

  const coords = geo.phase === "ready" ? geo.coords : null;

  // The SAME function the server action runs, so the sentence shown before
  // the tap is by construction the sentence that gets recorded (D-011).
  const state =
    geo.phase === "resolving" || !now
      ? null
      : computeCheckInState(context, coords, now);

  const location = state?.location ?? null;
  const lateBy = state?.lateBy ?? 0;
  const intent = checkInIntent({
    checkedIn,
    checkedOut,
    multiplePunchAllowed: context.multiplePunchAllowed,
  });
  // The consequence belongs to a check-in that can actually happen —
  // which now includes returning after a check-out, so the reason box
  // appears for a second visit that starts outside the permitted area.
  const consequence =
    state && (intent === "open-day" || intent === "new-punch")
      ? state.consequence
      : null;

  const reasonMissing = Boolean(consequence?.requiresReason) && !reason.trim();

  const locationStatus: Status | null = !location
    ? null
    : location.outcome === "INSIDE"
      ? { key: "inside", label: location.label, tone: "success" }
      : location.outcome === "OUTSIDE"
        ? { key: "outside", label: location.label, tone: "warning" }
        : location.outcome === "UNCONFIRMED"
          ? { key: "location-off", label: location.label, tone: "info" }
          : null; // NOT_REQUIRED: chip omitted entirely, no placeholder

  function handleCheckIn() {
    if (reasonMissing) {
      reasonRef.current?.focus();
      return;
    }
    startTransition(async () => {
      // Offline: keep it on the device with the time it happened, and
      // confirm locally. The consequence the person just accepted is the
      // one that will be recorded, because the server re-computes from
      // this same capture time.
      if (!online) {
        const queued = await enqueue(
          "checkIn",
          { coords, reason: reason.trim() || undefined },
          new Date(),
        );
        if (!queued) {
          show({
            variant: "error",
            message:
              "This browser can't save your check-in offline. Try again when you have signal.",
          });
          return;
        }
        const at = new Intl.DateTimeFormat("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: context.timezone,
        }).format(new Date());
        setConfirmation({
          message: `Checked in at ${at}`,
          detail:
            "Your check-in is saved on this phone and will be sent when you're back online. Nothing is lost.",
        });
        setToday((prev) => ({
          recordId: prev?.recordId ?? null,
          checkInAt: new Date(),
          checkOutAt: null,
          lateMinutes: lateBy,
          reviewStatus: consequence?.requiresReason ? "PENDING" : "NONE",
          exemptionStatus: "NONE",
          checkInOutcome: location?.outcome ?? null,
          checkInDistanceM: location?.distanceM ?? null,
          offlineCaptured: true,
        }));
        setReason("");
        return;
      }

      const result = await checkInAction({
        coords,
        reason: reason.trim() || undefined,
      });
      if (result.ok) {
        setConfirmation({ message: result.message, detail: result.detail });
        setToday((prev) => ({
          recordId: prev?.recordId ?? null,
          checkInAt: new Date(),
          checkOutAt: null,
          lateMinutes: lateBy,
          reviewStatus: consequence?.requiresReason ? "PENDING" : "NONE",
          exemptionStatus: "NONE",
          checkInOutcome: location?.outcome ?? null,
          checkInDistanceM: location?.distanceM ?? null,
          offlineCaptured: false,
        }));
        setReason("");
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  function handleCheckOut() {
    startTransition(async () => {
      if (!online) {
        const queued = await enqueue("checkOut", { coords }, new Date());
        if (!queued) {
          show({
            variant: "error",
            message:
              "This browser can't save your check-out offline. Try again when you have signal.",
          });
          return;
        }
        const at = new Intl.DateTimeFormat("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: context.timezone,
        }).format(new Date());
        setConfirmation({
          message: `Checked out at ${at}`,
          detail:
            "Saved on this phone and will be sent when you're back online. Nothing is lost.",
        });
        setToday((prev) => (prev ? { ...prev, checkOutAt: new Date() } : prev));
        return;
      }

      const result = await checkOutAction({ coords });
      if (result.ok) {
        setConfirmation({ message: result.message, detail: result.detail });
        setToday((prev) =>
          prev ? { ...prev, checkOutAt: new Date() } : prev,
        );
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  // Summed across the day's pairs, not last-out minus first-in: once
  // someone can leave and come back, the gap between visits is not work.
  // Falls back to the single pair for a day recorded before punches
  // existed, so history keeps reading correctly.
  const pairs =
    !today?.checkInAt
      ? []
      : today.punches?.length
        ? today.punches.map((p) => ({
            checkInAt: new Date(p.checkInAt),
            checkOutAt: p.checkOutAt ? new Date(p.checkOutAt) : null,
          }))
        : [
            {
              checkInAt: new Date(today.checkInAt),
              checkOutAt: today.checkOutAt ? new Date(today.checkOutAt) : null,
            },
          ];

  const elapsedMinutes = now ? workedMinutes(pairs, now) : 0;
  const unrecordedCheckOut = now ? hasUnrecordedCheckOut(pairs, now) : false;

  // Warm confirmation panel — the one warm element on this screen.
  if (confirmation) {
    return (
      <div
        className={cn(
          "rounded-surface-card border border-warm-border bg-warm-subtle p-5",
          "motion-safe:animate-[fh-confirm-pulse_var(--fh-motion-duration-slow)_var(--fh-motion-easing-spring-subtle)]",
        )}
      >
        <p role="status" className="text-h2 font-heading text-warm-text">
          {confirmation.message}
        </p>
        {confirmation.detail && (
          <p className="mt-1 text-body text-warm-text">{confirmation.detail}</p>
        )}
        {/* The chip is evidence, not decoration: it shows while work is
            genuinely still on the device, and disappears once sent. */}
        {(!online || queued.length > 0) && (
          <p className="mt-3 inline-flex items-center gap-2">
            <StatusChip status={STATUS.waitingToSend} size="sm" />
          </p>
        )}
        {checkedIn && !checkedOut && (
          <div className="mt-4 border-t border-warm-border pt-4">
            <p className="text-secondary text-warm-text">
              Working now · {formatDuration(elapsedMinutes)}
            </p>
            <Button
              size="xl"
              className="mt-3"
              loading={pending}
              onClick={handleCheckOut}
              leadingIcon={<LogOut aria-hidden="true" className="size-5" />}
            >
              Check Out
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-surface-card border border-border-default bg-surface-default p-5 shadow-elevation-2">
      {/* Live clock — deliberately not a live region. */}
      <p
        aria-live="off"
        className="font-mono text-data-xl font-semibold text-text-primary tabular-nums"
      >
        {now
          ? new Intl.DateTimeFormat("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
              timeZone: context.timezone,
            }).format(now)
          : "--:--:--"}
      </p>
      <p className="mt-0.5 text-secondary text-text-secondary">
        {now
          ? new Intl.DateTimeFormat("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: context.timezone,
            }).format(now)
          : ""}
      </p>

      {/* Location status as text. Skeleton while unknown — never a
          tappable action whose consequence is unknown. */}
      {context.locationRequired && (
        <div className="mt-4">
          {locationStatus ? (
            <StatusChip status={locationStatus} size="lg" />
          ) : (
            <Skeleton className="h-8 w-56 rounded-chip" />
          )}
        </div>
      )}

      {/* A missing work location is a configuration gap, not "no location
          needed" — say so rather than silently skipping the area check. */}
      {context.branchMissing && (
        <div className="mt-3">
          <Alert variant="warning" title="Your work location isn't set.">
            Ask your manager to set it. You can still check in, and it will
            be sent for approval.
          </Alert>
        </div>
      )}

      {!online && (
        <div className="mt-3">
          <Alert variant="info" title="No internet — working offline">
            Your check-in is saved on this phone and will be sent when
            you&apos;re back online. Nothing is lost.
          </Alert>
        </div>
      )}

      {/* Consequence BEFORE the action. */}
      {consequence && (
        <div className="mt-4">
          <Alert
            variant="consequence"
            title={consequence.sentence}
            live={false}
          >
            {consequence.detail}
          </Alert>
        </div>
      )}

      {consequence?.requiresReason && (
        <div className="mt-3">
          <TextArea
            ref={reasonRef}
            label="Reason"
            required
            placeholder="Tell your manager why you are checking in from here"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="max-w-none"
          />
        </div>
      )}

      {/* Primary action: one per screen, full width, 56px, thumb zone. */}
      <div className="mt-4">
        {!checkedIn ? (
          location ? (
            <Button
              size="xl"
              loading={pending}
              onClick={handleCheckIn}
              disabled={reasonMissing}
              disabledReason={
                reasonMissing
                  ? "Add a reason to send this for approval."
                  : undefined
              }
              leadingIcon={<LogIn aria-hidden="true" className="size-5" />}
              aria-label={
                consequence
                  ? `${checkInButtonLabel(consequence)}. ${consequence.sentence}`
                  : lateBy > 0
                    ? `Check In, will record ${lateBy} minutes late`
                    : "Check In"
              }
            >
              {checkInButtonLabel(consequence)}
            </Button>
          ) : (
            <Skeleton className="h-14 w-full rounded-button-mobile-primary" />
          )
        ) : unrecordedCheckOut ? (
          /* The visit was never closed and is now too old to close as one
             stretch of work. Offering "Check Out" here would be a button
             the server refuses — say what happened and who fixes it. */
          <Alert
            variant="warning"
            title="Your check-out wasn't recorded for that day."
          >
            You checked in more than {MAX_OPEN_VISIT_HOURS} hours ago and
            never checked out, so those hours aren&apos;t counted. Ask your
            manager to correct that day — they can set the time you actually
            left.
          </Alert>
        ) : !checkedOut ? (
          <Button
            size="xl"
            loading={pending}
            onClick={handleCheckOut}
            leadingIcon={<LogOut aria-hidden="true" className="size-5" />}
          >
            Check Out
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-md bg-surface-sunken p-4">
              <p className="text-body text-text-primary">
                Today is complete · {formatDuration(elapsedMinutes)} recorded
              </p>
              {/* Says WHY there is no button, rather than leaving a person
                  who genuinely worked again to conclude the app is broken.
                  edge-cases.md: blocked "with an explanation, not a silent
                  no-op". */}
              {!context.multiplePunchAllowed && (
                <p className="mt-1 text-caption text-text-secondary">
                  Your company records one check-in per day. Ask your manager
                  if you worked again today.
                </p>
              )}
            </div>
            {/* Lunch, a delivery, a second shift — the day re-opens and the
                earlier hours are kept. */}
            {context.multiplePunchAllowed && location && (
              <Button
                size="xl"
                loading={pending}
                onClick={handleCheckIn}
                disabled={reasonMissing}
                disabledReason={
                  reasonMissing
                    ? "Add a reason to send this for approval."
                    : undefined
                }
                leadingIcon={<LogIn aria-hidden="true" className="size-5" />}
              >
                Check in again
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Shift line + status of the existing record. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* A day off is paid whether or not they come in; checking in is
            still allowed, for the days someone is needed anyway. */}
        {context.offToday && !checkedIn && (
          <p className="w-full text-body text-text-secondary">
            {context.offToday.kind === "holiday"
              ? `Today is a holiday — ${context.offToday.name}. Check in only if you're working today.`
              : "Today is your weekly off. Check in only if you're working today."}
          </p>
        )}
        {context.shift && (
          <p className="text-caption text-text-secondary">
            Shift {formatShiftTime(context.shift.startMinutes)} –{" "}
            {formatShiftTime(context.shift.endMinutes)}
          </p>
        )}
        {checkedIn && today && (
          <>
            {today.lateMinutes > 0 && (
              <StatusChip status={statusLate(today.lateMinutes)} size="sm" />
            )}
            {today.reviewStatus === "PENDING" && (
              <StatusChip status={STATUS.pendingReview} size="sm" />
            )}
            {today.reviewStatus === "APPROVED" && (
              <StatusChip status={STATUS.approved} size="sm" />
            )}
          </>
        )}
      </div>

      {/* Said what the product does NOT do: "Turn on location to check in"
          reads as a precondition, and it is not one. Attendance is never
          refused for a missing or wrong location — it is recorded and sent
          for approval. Telling someone otherwise is how a person who is
          genuinely at work decides they cannot mark it. */}
      {geo.phase === "denied" && (
        <p className="mt-3 inline-flex items-start gap-2 text-caption text-text-secondary">
          <MapPinOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Location isn&apos;t available. You can still check in — it goes to
          your manager for approval. Turning location on avoids that.
        </p>
      )}

      <p className="mt-4 border-t border-border-subtle pt-3 text-caption text-text-secondary">
        Your location is captured only when you check in or out, to confirm
        you were at a permitted place of work.
      </p>
    </div>
  );
}
