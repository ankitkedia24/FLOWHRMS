"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPinHouse } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { STATUS } from "@/lib/status";
import { saveBranchAction } from "@/lib/branches/actions";
import { LocationPicker } from "@/components/maps/LocationPicker";

/**
 * Company locations (screen A24 — "company, logo, branches, retention").
 *
 * Each location may set its own permitted-area radius, or leave it blank
 * to follow the company default. Turning one off while people work there
 * requires a reason, which is recorded.
 */
export interface LocationRow {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  /** Null = inherits the tenant default. */
  radiusM: number | null;
  isActive: boolean;
  assignedCount: number;
}

interface Draft {
  id: string;
  name: string;
  address: string;
  lat: string;
  lng: string;
  radiusM: string;
  isActive: boolean;
  reason: string;
}

const emptyDraft: Draft = {
  id: "",
  name: "",
  address: "",
  lat: "",
  lng: "",
  radiusM: "",
  isActive: true,
  reason: "",
};

export function LocationsCard({
  locations,
  defaultRadiusM,
}: {
  locations: LocationRow[];
  defaultRadiusM: number;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);

  const deactivating =
    draft?.id !== "" &&
    draft?.isActive === false &&
    (locations.find((l) => l.id === draft?.id)?.isActive ?? false);
  const affected =
    locations.find((l) => l.id === draft?.id)?.assignedCount ?? 0;
  const needsReason = Boolean(deactivating) && affected > 0 && !draft?.reason.trim();

  function edit(location: LocationRow) {
    setDraft({
      id: location.id,
      name: location.name,
      address: location.address ?? "",
      lat: location.lat?.toString() ?? "",
      lng: location.lng?.toString() ?? "",
      radiusM: location.radiusM?.toString() ?? "",
      isActive: location.isActive,
      reason: "",
    });
  }

  return (
    <Card>
      <CardHeader
        title="Locations"
        meta="Where your company works. Each one can set its own permitted area."
        action={
          <Button size="sm" variant="outline" onClick={() => setDraft(emptyDraft)}>
            Add branch
          </Button>
        }
      />

      {locations.length === 0 ? (
        <p className="text-secondary text-text-secondary">
          No locations yet. Add one so check-ins can be matched to a place of
          work.
        </p>
      ) : (
        <ul className="flex flex-col">
          {locations.map((location) => (
            <li
              key={location.id}
              className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-body font-semibold text-text-primary">
                  <MapPinHouse aria-hidden="true" className="size-4 shrink-0" />
                  {location.name}
                </p>
                {location.address && (
                  <p className="text-caption text-text-secondary">
                    {location.address}
                  </p>
                )}
                <p className="mt-0.5 font-mono text-data text-text-secondary tabular-nums">
                  {location.lat != null && location.lng != null
                    ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                    : "No coordinates — permitted area not checked here"}
                  {" · "}
                  {location.radiusM != null
                    ? `${location.radiusM} m`
                    : `${defaultRadiusM} m (company default)`}
                </p>
                <p className="mt-0.5 text-caption text-text-secondary">
                  {location.assignedCount}{" "}
                  {location.assignedCount === 1 ? "person works" : "people work"}{" "}
                  here
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip
                  status={location.isActive ? STATUS.active : STATUS.inactive}
                  size="sm"
                />
                <Button size="sm" variant="outline" onClick={() => edit(location)}>
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <div className="mt-4 border-t border-border-subtle pt-4">
          <div className="flex flex-col gap-1">
            <Input
              label="Location name"
              required
              placeholder="Bhiwandi Warehouse"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            {/* Search, current location or pin — and leave the point empty
                if this location's check-ins shouldn't be area-checked. */}
            <LocationPicker
              key={draft.id || "new"}
              value={{
                address: draft.address,
                lat: draft.lat.trim() === "" ? null : Number(draft.lat),
                lng: draft.lng.trim() === "" ? null : Number(draft.lng),
              }}
              onChange={(next) =>
                setDraft((d) =>
                  d
                    ? {
                        ...d,
                        address: next.address,
                        lat: next.lat == null ? "" : String(next.lat),
                        lng: next.lng == null ? "" : String(next.lng),
                      }
                    : d,
                )
              }
              radiusM={Number(draft.radiusM) >= 50 ? Number(draft.radiusM) : defaultRadiusM}
              onPlaceName={(n) => setDraft((d) => (d && !d.name.trim() ? { ...d, name: n } : d))}
            />
            <Input
              label="Permitted area radius"
              optional
              type="number"
              inputMode="numeric"
              suffix="metres"
              placeholder={String(defaultRadiusM)}
              helper={`Leave blank to use the company default of ${defaultRadiusM} m. A warehouse may need more room than a shop.`}
              value={draft.radiusM}
              onChange={(e) => setDraft({ ...draft, radiusM: e.target.value })}
            />
            <div className="mt-2">
              <Checkbox
                checked={draft.isActive}
                onChange={(e) =>
                  setDraft({ ...draft, isActive: e.target.checked })
                }
                label="This location is in use"
              />
            </div>
          </div>

          {deactivating && affected > 0 && (
            <div className="mt-3">
              <Alert
                variant="consequence"
                title={`${affected} ${affected === 1 ? "person" : "people"} work at this location.`}
              >
                Turning it off means their check-ins no longer match a
                permitted area and will be sent for approval. No attendance
                data is deleted.
              </Alert>
              <div className="mt-2">
                <Input
                  label="Reason"
                  required
                  helper="Recorded in the activity log."
                  value={draft.reason}
                  onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 md:flex-row">
            <Button
              loading={pending}
              disabled={!draft.name.trim() || needsReason}
              disabledReason={
                !draft.name.trim()
                  ? "Name the location."
                  : needsReason
                    ? "Give a reason to turn this location off."
                    : undefined
              }
              onClick={() =>
                startTransition(async () => {
                  const result = await saveBranchAction({
                    branchId: draft.id || undefined,
                    name: draft.name.trim(),
                    address: draft.address.trim() || undefined,
                    lat: draft.lat.trim() === "" ? null : Number(draft.lat),
                    lng: draft.lng.trim() === "" ? null : Number(draft.lng),
                    radiusM:
                      draft.radiusM.trim() === "" ? null : Number(draft.radiusM),
                    isActive: draft.isActive,
                    reason: draft.reason.trim() || undefined,
                  });
                  if (result.ok) {
                    show({ variant: "success", message: result.message });
                    setDraft(null);
                    router.refresh();
                  } else {
                    show({ variant: "error", message: result.error });
                  }
                })
              }
            >
              Save location
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
