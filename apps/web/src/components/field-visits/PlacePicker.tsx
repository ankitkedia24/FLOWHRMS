"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, Check, MapPin, MapPinOff, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Input, TextArea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { fitImage } from "@/lib/media/upload";
import type { PhotoRule, PlaceWord } from "@/lib/field-visits/policy";
import { capitalise, withArticle } from "@/lib/field-visits/policy";
import { formatDistance, nearestFirst, NOTE_MAX, PLACE_NAME_MAX, tidyPlaceName } from "@/lib/field-visits/state";
import type { TapCoords } from "@/lib/field-visits/spot";

/**
 * "Reached a {place}" (FIELD-VISITS-MODULE.md §6): pick a saved place
 * (nearest first), save a new one at this spot, or name somewhere just
 * this once — an event, a bank, a supplier. Purpose, note and photo as the
 * company's rules say. The tap itself happens in the card.
 */

export interface PickedPlace {
  place: { kind: "saved"; placeId: string } | { kind: "new"; name: string } | { kind: "once"; name: string };
  placeName: string;
  purposeKey?: string;
  note?: string;
  photo: Blob | null;
}

type Choice = { kind: "saved"; id: string } | { kind: "new" } | { kind: "once" } | null;

export function PlacePicker({
  open,
  onClose,
  onPick,
  pending,
  word,
  places,
  purposes,
  photoRule,
  spot,
  locating,
  locationAllowed,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (picked: PickedPlace) => void;
  pending: boolean;
  word: PlaceWord;
  places: Array<{ id: string; name: string; address: string | null; lat: number; lng: number }>;
  purposes: Array<{ key: string; name: string }>;
  photoRule: PhotoRule;
  spot: TapCoords | null;
  locating: boolean;
  locationAllowed: boolean;
}) {
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState<Choice>(null);
  const [purposeKey, setPurposeKey] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const typed = tidyPlaceName(query);
  const matches = useMemo(() => {
    const words = typed.toLowerCase().split(" ").filter(Boolean);
    const found = places.filter((p) => {
      const hay = `${p.name} ${p.address ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    return nearestFirst(found, spot).slice(0, 25);
  }, [places, typed, spot]);
  const exact = places.some((p) => p.name.toLowerCase() === typed.toLowerCase());

  const chosenName =
    choice?.kind === "saved" ? places.find((p) => p.id === choice.id)?.name ?? "" : choice ? typed : "";
  const photoMissing = photoRule === "REQUIRED" && !photo;
  const blocker = !choice
    ? `Choose the ${word.singular}, or type its name.`
    : choice.kind !== "saved" && !typed
      ? `Type the name of the ${word.singular}.`
      : photoMissing
        ? "Add a photo — your company asks for one."
        : null;

  async function takePhoto(file: File | undefined) {
    setPhotoError(null);
    if (!file) return;
    try {
      const blob = await fitImage(file, 1280, "image/jpeg");
      setPhoto((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { blob, url: URL.createObjectURL(blob) };
      });
    } catch {
      setPhotoError("That photo couldn't be read. Take it again.");
    }
  }

  function submit() {
    if (blocker || !choice) return;
    onPick({
      place:
        choice.kind === "saved"
          ? { kind: "saved", placeId: choice.id }
          : { kind: choice.kind, name: typed },
      placeName: chosenName,
      purposeKey: purposeKey ?? undefined,
      note: note.trim() || undefined,
      photo: photo?.blob ?? null,
    });
  }

  const locationLine = !locationAllowed
    ? "Location is off at visit taps, so distances aren't shown."
    : locating
      ? "Finding your location…"
      : spot
        ? `Location found${spot.accuracyM ? `, within ${Math.round(spot.accuracyM)} m` : ""}.`
        : "Location isn't available. You can still start the visit.";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Reached ${withArticle(word.singular)}`}
      footer={
        <Button
          size="lg"
          loading={pending}
          disabled={Boolean(blocker)}
          disabledReason={blocker ?? undefined}
          onClick={submit}
          className="w-full md:w-auto"
        >
          {chosenName ? `Start visit at ${chosenName}` : "Start visit"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p
          className={cn(
            "inline-flex items-center gap-2 self-start rounded-chip px-3 py-1 text-caption",
            spot ? "bg-[color:var(--fh-color-status-success-bg)] text-status-success-fg" : "bg-surface-sunken text-text-secondary",
          )}
        >
          {spot ? <MapPin aria-hidden="true" className="size-4" /> : <MapPinOff aria-hidden="true" className="size-4" />}
          {locationLine}
        </p>

        <Input
          label={`Search ${word.plural}`}
          value={query}
          maxLength={PLACE_NAME_MAX}
          onChange={(e) => {
            setQuery(e.target.value);
            if (choice?.kind !== "saved") setChoice(null);
          }}
          autoComplete="off"
        />

        <div role="radiogroup" aria-label={capitalise(word.plural)} className="flex flex-col gap-2">
          {matches.map((p) => {
            const on = choice?.kind === "saved" && choice.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setChoice({ kind: "saved", id: p.id })}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md border-[1.5px] px-3 py-2.5 text-left",
                  on ? "border-brand-primary bg-brand-primary-subtle" : "border-border-default hover:border-border-strong",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-body font-semibold text-text-primary">{p.name}</span>
                  {p.address && <span className="block truncate text-caption text-text-secondary">{p.address}</span>}
                </span>
                <span className="shrink-0 text-caption text-text-secondary">
                  {p.distanceM === null ? "" : formatDistance(p.distanceM)}
                </span>
              </button>
            );
          })}

          {places.length === 0 && !typed && (
            <p className="text-secondary text-text-secondary">
              No saved {word.plural} yet. Type the name of this one.
            </p>
          )}

          {typed && !exact && (
            <>
              <button
                type="button"
                role="radio"
                aria-checked={choice?.kind === "new"}
                disabled={!spot}
                onClick={() => setChoice({ kind: "new" })}
                className={cn(
                  "flex items-start gap-2 rounded-md border-[1.5px] px-3 py-2.5 text-left disabled:opacity-60",
                  choice?.kind === "new" ? "border-brand-primary bg-brand-primary-subtle" : "border-border-default hover:border-border-strong",
                )}
              >
                <Plus aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-primary" />
                <span>
                  <span className="block text-body text-text-primary">
                    Save “{typed}” as a new {word.singular} here
                  </span>
                  <span className="block text-caption text-text-secondary">
                    {spot
                      ? `It's added to your company's ${word.plural}, at this spot.`
                      : "Needs your location, which isn't available."}
                  </span>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={choice?.kind === "once"}
                onClick={() => setChoice({ kind: "once" })}
                className={cn(
                  "flex items-start gap-2 rounded-md border-[1.5px] px-3 py-2.5 text-left",
                  choice?.kind === "once" ? "border-brand-primary bg-brand-primary-subtle" : "border-border-default hover:border-border-strong",
                )}
              >
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-primary" />
                <span>
                  <span className="block text-body text-text-primary">“{typed}” — just this once</span>
                  <span className="block text-caption text-text-secondary">
                    An event, a bank, a meeting: recorded for this visit, not saved to the list.
                  </span>
                </span>
              </button>
            </>
          )}
        </div>

        {purposes.length > 0 && (
          <div>
            <p className="mb-2 text-label text-text-primary">
              Purpose <span className="text-text-secondary">· Optional</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {purposes.map((p) => {
                const on = purposeKey === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPurposeKey(on ? null : p.key)}
                    className={cn(
                      "rounded-chip border-[1.5px] px-3 py-1 text-label",
                      on ? "border-brand-primary bg-brand-primary-subtle text-text-primary" : "border-border-default text-text-secondary",
                    )}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <TextArea
          label="Note"
          optional
          rows={2}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {photoRule !== "OFF" && (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                void takePhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {photo ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the photo just taken */}
                <img src={photo.url} alt="Visit photo" className="size-20 rounded-md object-cover" />
                <Button
                  variant="outline"
                  size="sm"
                  leadingIcon={<X aria-hidden="true" className="size-4" />}
                  onClick={() => {
                    URL.revokeObjectURL(photo.url);
                    setPhoto(null);
                  }}
                >
                  Remove photo
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-md border border-dashed border-border-strong px-3 py-3 text-label text-text-secondary"
              >
                <Camera aria-hidden="true" className="size-5" />
                {photoRule === "REQUIRED" ? "Add a photo (your company asks for one)" : "Add a photo · Optional"}
              </button>
            )}
            {photoError && <p className="mt-1 text-caption text-status-error-text">{photoError}</p>}
          </div>
        )}
      </div>
    </Drawer>
  );
}
