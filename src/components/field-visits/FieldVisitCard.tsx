"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Footprints, MapPin, Route } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { STATUS, type Status } from "@/lib/status";
import { formatClockTime } from "@/lib/attendance/policy";
import { useOffline } from "@/lib/offline/OfflineProvider";
import type { FieldTapPayload } from "@/lib/offline/sync";
import { uploadMedia } from "@/lib/media/upload";
import { setVisitLocationConsentAction } from "@/lib/consent/actions";
import { arriveAction, backAtOfficeAction, goingOutAction, leaveAction } from "@/lib/field-visits/actions";
import type { FieldHome } from "@/lib/field-visits/service";
import { withArticle } from "@/lib/field-visits/policy";
import { formatDistance, formatStay, NOTE_MAX, type FieldPhase } from "@/lib/field-visits/state";
import { captureSpot, type TapCoords } from "@/lib/field-visits/spot";
import { PlacePicker, type PickedPlace } from "./PlacePicker";

/**
 * Field visits on the home screen (FIELD-VISITS-MODULE.md §3): one step
 * at a time — Going out, Reached, End visit, Back at office. Location is
 * asked for at the tap and never in between. Offline, the tap is kept on
 * the phone with its own time and sent later, like a check-in.
 */

interface Local {
  phase: FieldPhase;
  tripStartedAt: string | null;
  approval: NonNullable<FieldHome["trip"]>["approval"] | null;
  approvalReason: string | null;
  lastPlaceName: string | null;
  visit: { placeName: string; arrivedAt: string; purposeName: string | null; note: string | null } | null;
}

function fromServer(home: FieldHome): Local {
  return {
    phase: home.phase,
    tripStartedAt: home.trip?.startedAt ?? null,
    approval: home.trip?.approval ?? null,
    approvalReason: home.trip?.approvalReason ?? null,
    lastPlaceName: home.trip?.lastPlaceName ?? null,
    visit: home.visit
      ? {
          placeName: home.visit.placeName,
          arrivedAt: home.visit.arrivedAt,
          purposeName: home.visit.purposeName,
          note: home.visit.note,
        }
      : null,
  };
}

function serverKey(home: FieldHome): string {
  return [home.phase, home.trip?.id, home.trip?.approval, home.visit?.id].join("|");
}

const APPROVAL_STATUS: Record<string, Status | undefined> = {
  PENDING: { key: "trip-pending", label: "Waiting for approval", tone: "neutral" },
  APPROVED: STATUS.approved,
  DECLINED: { key: "trip-declined", label: "Declined", tone: "error" },
};

export function FieldVisitCard({ home }: { home: FieldHome }) {
  const router = useRouter();
  const { show } = useToast();
  const { online, enqueue } = useOffline();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState<Local>(() => fromServer(home));
  const [seen, setSeen] = useState(() => serverKey(home));
  const [note, setNote] = useState(home.visit?.note ?? "");
  const [confirmation, setConfirmation] = useState<{ message: string; detail?: string } | null>(null);
  /** Set by our own tap, so the refresh it causes keeps its confirmation. */
  const [ownChange, setOwnChange] = useState(false);
  const [picker, setPicker] = useState<{ open: boolean; round: number }>({ open: false, round: 0 });
  const [spot, setSpot] = useState<TapCoords | null>(null);
  const [locating, setLocating] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  // The server's answer wins whenever it changes (after a tap, a sync or
  // a refresh); what the phone shows in between is only a stand-in.
  const key = serverKey(home);
  if (key !== seen) {
    setSeen(key);
    setLocal(fromServer(home));
    setNote(home.visit?.note ?? "");
    // Changed by something else — a check-out, another phone: an old
    // confirmation would now describe the wrong state.
    if (!ownChange) setConfirmation(null);
    setOwnChange(false);
  }

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = requestAnimationFrame(tick);
    const id = setInterval(tick, 30_000);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(id);
    };
  }, []);

  const word = home.word;
  const tz = home.timezone;
  const time = (iso: string) => formatClockTime(new Date(iso), tz);
  const since = (iso: string) =>
    now === null ? "" : ` · ${formatStay((now - new Date(iso).getTime()) / 60_000)}`;

  async function where(): Promise<TapCoords | null> {
    return home.locationAllowed ? captureSpot() : null;
  }

  function nowLabel() {
    return formatClockTime(new Date(), tz);
  }

  /** Online: the server records and the page refreshes. Offline: queue and show it here. */
  async function tap(
    payload: FieldTapPayload,
    online_: () => Promise<{ ok: true; message: string; detail?: string } | { ok: false; error: string }>,
    offline: { message: string; next: Partial<Local> },
  ) {
    if (!online) {
      const queued = await enqueue("fieldTap", payload, new Date());
      if (!queued) {
        show({ variant: "error", message: "This browser can't save the tap offline. Try again when you have signal." });
        return;
      }
      setLocal((l) => ({ ...l, ...offline.next }));
      setConfirmation({
        message: offline.message,
        detail: "Saved on this phone and sent when you're back online. Nothing is lost.",
      });
      return;
    }
    const result = await online_();
    if (result.ok) {
      setConfirmation({ message: result.message, detail: result.detail });
      setOwnChange(true);
      router.refresh();
    } else {
      show({ variant: "error", message: result.error });
    }
  }

  function goingOut() {
    startTransition(async () => {
      const coords = await where();
      const at = new Date().toISOString();
      await tap({ tap: "GOING_OUT", coords }, () => goingOutAction({ coords }), {
        message: `Out since ${nowLabel()}`,
        next: { phase: "OUT", tripStartedAt: at, approval: "PENDING", lastPlaceName: null, visit: null },
      });
    });
  }

  function openPicker() {
    setPicker((p) => ({ open: true, round: p.round + 1 }));
    setSpot(null);
    if (!home.locationAllowed) return;
    setLocating(true);
    void captureSpot().then((coords) => {
      setSpot(coords);
      setLocating(false);
    });
  }

  function arrive(picked: PickedPlace) {
    startTransition(async () => {
      // A fresh fix at the moment of arrival if the one from opening the
      // sheet is missing.
      const coords = spot ?? (await where());
      const arriveData = {
        place: picked.place,
        purposeKey: picked.purposeKey,
        note: picked.note,
      };
      const at = new Date().toISOString();
      await tap(
        {
          tap: "ARRIVE",
          coords,
          arrive: arriveData,
          photo: picked.photo ? { tenantId: home.tenantId, type: "image/jpeg", blob: picked.photo } : undefined,
        },
        async () => {
          let photoPath: string | undefined;
          if (picked.photo) {
            const uploaded = await uploadMedia(home.tenantId, "visits", picked.photo, "jpg");
            if (!uploaded.ok) return { ok: false as const, error: uploaded.error };
            photoPath = uploaded.path;
          }
          return arriveAction({ coords, ...arriveData, photoPath });
        },
        {
          message: `At ${picked.placeName} since ${nowLabel()}`,
          next: {
            phase: "AT_PLACE",
            tripStartedAt: local.tripStartedAt ?? at,
            visit: {
              placeName: picked.placeName,
              arrivedAt: at,
              purposeName: home.purposes.find((p) => p.key === picked.purposeKey)?.name ?? null,
              note: picked.note ?? null,
            },
          },
        },
      );
      setPicker((p) => ({ ...p, open: false }));
    });
  }

  function endVisit() {
    startTransition(async () => {
      const coords = await where();
      const text = note.trim();
      const name = local.visit?.placeName ?? "";
      await tap({ tap: "LEAVE", coords, note: text }, () => leaveAction({ coords, note: text }), {
        message: `Left ${name} at ${nowLabel()}`,
        next: { phase: "OUT", lastPlaceName: name, visit: null },
      });
    });
  }

  function backAtOffice() {
    startTransition(async () => {
      const coords = await where();
      await tap({ tap: "BACK", coords }, () => backAtOfficeAction({ coords }), {
        message: `Back at office at ${nowLabel()}`,
        next: { phase: "AT_OFFICE", tripStartedAt: null, approval: null, lastPlaceName: null, visit: null },
      });
    });
  }

  function shareLocation() {
    startTransition(async () => {
      const result = await setVisitLocationConsentAction({ granted: true });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  const approval = local.approval ? APPROVAL_STATUS[local.approval] : undefined;
  const today = home.today;

  return (
    <div className="rounded-surface-card border border-border-default bg-surface-default p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-h3 text-text-primary">Field visits</h2>
        <Link href="/field-visits" className="text-label text-brand-primary underline-offset-2 hover:underline">
          My day
        </Link>
      </div>

      {confirmation && (
        <div className="mt-3 rounded-md border border-warm-border bg-warm-subtle px-4 py-3">
          <p role="status" className="text-body font-semibold text-warm-text">
            {confirmation.message}
          </p>
          {confirmation.detail && <p className="mt-0.5 text-secondary text-warm-text">{confirmation.detail}</p>}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {local.phase === "NOT_CHECKED_IN" && (
          <p className="text-secondary text-text-secondary">
            Check in first — a trip is part of your working day.
          </p>
        )}

        {local.phase === "AT_OFFICE" && (
          <>
            <p className="inline-flex items-center gap-2 text-secondary text-text-secondary">
              <Building2 aria-hidden="true" className="size-4" /> At the office
            </p>
            <Button
              size="xl"
              loading={pending}
              onClick={goingOut}
              leadingIcon={<Footprints aria-hidden="true" className="size-5" />}
            >
              Going out
            </Button>
            <Button variant="outline" size="lg" disabled={pending} disabledReason="Recording…" onClick={openPicker}>
              Reached {withArticle(word.singular)}
            </Button>
          </>
        )}

        {local.phase === "OUT" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="inline-flex items-center gap-2 text-body text-text-primary">
                <Route aria-hidden="true" className="size-4 text-brand-primary" />
                Out since {local.tripStartedAt ? time(local.tripStartedAt) : "—"}
                {local.tripStartedAt ? since(local.tripStartedAt) : ""}
              </p>
              {approval && <StatusChip status={approval} size="sm" />}
            </div>
            {local.lastPlaceName && (
              <p className="text-caption text-text-secondary">Last at {local.lastPlaceName}</p>
            )}
            <Button
              size="xl"
              loading={pending}
              onClick={openPicker}
              leadingIcon={<MapPin aria-hidden="true" className="size-5" />}
            >
              Reached {withArticle(word.singular)}
            </Button>
            <Button variant="outline" size="lg" disabled={pending} disabledReason="Recording…" onClick={backAtOffice}>
              Back at office
            </Button>
          </>
        )}

        {local.phase === "AT_PLACE" && local.visit && (
          <>
            <div className="rounded-md border border-status-success-border bg-[color:var(--fh-color-status-success-bg)] px-4 py-3">
              <p className="inline-flex items-center gap-2 text-body font-semibold text-status-success-fg">
                <MapPin aria-hidden="true" className="size-4" /> At {local.visit.placeName}
              </p>
              <p className="text-caption text-status-success-fg">
                Since {time(local.visit.arrivedAt)}
                {since(local.visit.arrivedAt)}
                {local.visit.purposeName ? ` · ${local.visit.purposeName}` : ""}
              </p>
            </div>
            {approval && (
              <div>
                <StatusChip status={approval} size="sm" />
              </div>
            )}
            <TextArea
              label="Note"
              optional
              rows={2}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="max-w-none"
            />
            <Button size="xl" loading={pending} onClick={endVisit}>
              End visit
            </Button>
          </>
        )}

        {local.approval === "DECLINED" && local.approvalReason && (
          <Alert variant="warning" title="Your manager declined this trip.">
            {local.approvalReason} It won&apos;t count towards travel allowance.
          </Alert>
        )}
      </div>

      {today.visits > 0 && (
        <p className="mt-3 text-caption text-text-secondary">
          Today: {today.visits} visit{today.visits === 1 ? "" : "s"}
          {today.metres > 0 ? ` · ${today.estimated ? "about " : ""}${formatDistance(today.metres)}` : ""}
        </p>
      )}

      {home.locationAllowed ? (
        <p className="mt-4 border-t border-border-subtle pt-3 text-caption text-text-secondary">
          Your location is saved only when you tap — never in between.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-3">
          <p className="text-caption text-text-secondary">
            You haven&apos;t agreed to share location at visit taps, so your visits are recorded
            without it and travel distance can&apos;t be worked out.
          </p>
          <Button variant="tertiary" size="sm" loading={pending} onClick={shareLocation} className="self-start">
            Share location at visit taps
          </Button>
        </div>
      )}

      <PlacePicker
        key={picker.round}
        open={picker.open}
        onClose={() => setPicker((p) => ({ ...p, open: false }))}
        onPick={arrive}
        pending={pending}
        word={word}
        places={home.places}
        purposes={home.purposes}
        photoRule={home.photo}
        spot={spot}
        locating={locating}
        locationAllowed={home.locationAllowed}
      />
    </div>
  );
}
