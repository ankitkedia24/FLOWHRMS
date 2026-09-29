"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { LocationPicker, type PickedLocation } from "@/components/maps/LocationPicker";
import { editPlaceAction, mergePlacesAction, setPlaceActiveAction } from "@/lib/field-visits/admin-actions";
import { PLACE_NAME_MAX } from "@/lib/field-visits/state";

/**
 * The company's saved places (FIELD-VISITS-MODULE.md §6): rename one, put
 * its pin where it really is, merge two entries for the same place, or
 * retire one. Visits already made keep the name they were recorded with.
 */

export interface PlaceItem {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  isActive: boolean;
  visits: number;
  lastVisit: string | null;
}

type Open = { kind: "edit"; place: PlaceItem } | { kind: "merge"; place: PlaceItem } | null;

export function PlacesManager({
  places,
  word,
  farFlagMeters,
}: {
  places: PlaceItem[];
  word: { singular: string; plural: string };
  farFlagMeters: number;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Open>(null);
  const [name, setName] = useState("");
  const [spot, setSpot] = useState<PickedLocation>({ address: "", lat: null, lng: null });
  const [intoId, setIntoId] = useState("");
  /** The row an action is running for, so only its button shows it. */
  const [busyId, setBusyId] = useState<string | null>(null);

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return places.filter((p) => words.every((w) => `${p.name} ${p.address ?? ""}`.toLowerCase().includes(w)));
  }, [places, query]);

  function run(
    action: () => Promise<{ ok: true; message: string; detail?: string } | { ok: false; error: string }>,
    placeId: string | null = null,
  ) {
    setBusyId(placeId);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        show({ variant: "success", message: result.detail ? `${result.message} ${result.detail}` : result.message });
        setOpen(null);
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  function startEdit(place: PlaceItem) {
    setName(place.name);
    setSpot({ address: place.address ?? "", lat: place.lat, lng: place.lng });
    setOpen({ kind: "edit", place });
  }

  function startMerge(place: PlaceItem) {
    setIntoId("");
    setOpen({ kind: "merge", place });
  }

  const others = open?.kind === "merge" ? places.filter((p) => p.isActive && p.id !== open.place.id) : [];
  const editBlocker = !name.trim() ? "Give the place a name." : spot.lat == null || spot.lng == null ? "Set where it is." : null;

  return (
    <div className="flex flex-col gap-4">
      <Input
        label={`Search ${word.plural}`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-md"
      />

      {shown.length === 0 ? (
        <Card flush>
          <EmptyState
            title={places.length === 0 ? `No saved ${word.plural} yet.` : "Nothing matches that."}
            body={`${word.plural[0]?.toUpperCase()}${word.plural.slice(1)} are saved from the phone, the first time someone visits one.`}
          />
        </Card>
      ) : (
        <Card flush>
          <ul className="divide-y divide-border-subtle">
            {shown.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-body font-semibold text-text-primary">
                    <span className="truncate">{p.name}</span>
                    {!p.isActive && <StatusChip status={{ key: "retired", label: "Retired", tone: "neutral" }} size="sm" />}
                  </p>
                  {p.address && <p className="truncate text-caption text-text-secondary">{p.address}</p>}
                  <p className="text-caption text-text-secondary">
                    {p.visits} visit{p.visits === 1 ? "" : "s"}
                    {p.lastVisit ? ` · last ${p.lastVisit}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => startMerge(p)}>
                    Merge
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    loading={pending && busyId === p.id}
                    onClick={() => run(() => setPlaceActiveAction({ placeId: p.id, active: !p.isActive }), p.id)}
                  >
                    {p.isActive ? "Retire" : "Restore"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Drawer
        open={open?.kind === "edit"}
        onClose={() => setOpen(null)}
        title={open?.kind === "edit" ? `Edit ${open.place.name}` : "Edit"}
        footer={
          <Button
            loading={pending}
            disabled={Boolean(editBlocker)}
            disabledReason={editBlocker ?? undefined}
            onClick={() =>
              open?.kind === "edit" &&
              spot.lat != null &&
              spot.lng != null &&
              run(() =>
                editPlaceAction({
                  placeId: open.place.id,
                  name,
                  address: spot.address.trim() || undefined,
                  lat: spot.lat!,
                  lng: spot.lng!,
                }),
              )
            }
          >
            Save
          </Button>
        }
      >
        {open?.kind === "edit" && (
          <div className="flex flex-col gap-3">
            <Input label="Name" value={name} maxLength={PLACE_NAME_MAX} onChange={(e) => setName(e.target.value)} />
            <p className="text-caption text-text-secondary">
              Visits already made keep the name they were recorded with.
            </p>
            <LocationPicker
              value={spot}
              onChange={setSpot}
              radiusM={farFlagMeters}
              radiusNote={`Visits further than ${farFlagMeters} m from this point are flagged.`}
            />
          </div>
        )}
      </Drawer>

      <Drawer
        open={open?.kind === "merge"}
        onClose={() => setOpen(null)}
        title={open?.kind === "merge" ? `Merge ${open.place.name}` : "Merge"}
        footer={
          <Button
            loading={pending}
            disabled={!intoId}
            disabledReason={intoId ? undefined : `Choose the ${word.singular} to keep.`}
            onClick={() => open?.kind === "merge" && run(() => mergePlacesAction({ fromId: open.place.id, intoId }))}
          >
            Merge
          </Button>
        }
      >
        {open?.kind === "merge" && (
          <div className="flex flex-col gap-3">
            <p className="text-secondary text-text-secondary">
              Two entries for the same {word.singular}? Its {open.place.visits} visit
              {open.place.visits === 1 ? "" : "s"} will count under the one you choose, and “{open.place.name}” is
              retired. Each visit still shows the name it was recorded with.
            </p>
            {others.length === 0 ? (
              <p className="text-secondary text-text-secondary">There is no other {word.singular} to merge into.</p>
            ) : (
              <Select
                label={`Keep this ${word.singular}`}
                placeholder={`Choose a ${word.singular}`}
                value={intoId}
                onChange={(e) => setIntoId(e.target.value)}
                options={others.map((p) => ({ value: p.id, label: p.address ? `${p.name} — ${p.address}` : p.name }))}
              />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
