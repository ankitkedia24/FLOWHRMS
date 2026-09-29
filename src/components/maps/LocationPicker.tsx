"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { loadMaps, MAPS_KEY } from "@/lib/maps/load";

/**
 * Choose where a work location is: search an address (Google Maps), use
 * this phone's position, or drag the pin. The circle shows the permitted
 * check-in area.
 *
 * Google Maps needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (a browser key,
 * restricted to the site's domains — DEPLOY.md §7d). Without it, "Use my
 * current location" and typing the coordinates still work, so adding a
 * location never depends on a third party being set up.
 */

export interface PickedLocation {
  address: string;
  lat: number | null;
  lng: number | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the Maps JS API ships no types here */
const INDIA = { lat: 20.5937, lng: 78.9629 };

export function LocationPicker({
  value,
  onChange,
  radiusM,
  onPlaceName,
}: {
  value: PickedLocation;
  onChange: (next: PickedLocation) => void;
  /** Permitted-area radius, drawn around the pin. */
  radiusM: number;
  /** A picked place's own name ("Sharma Traders"), to suggest as the location name. */
  onPlaceName?: (name: string) => void;
}) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const searchDiv = useRef<HTMLDivElement>(null);
  const maps = useRef<{ map: any; marker: any; circle: any; geocoder: any } | null>(null);
  // Map callbacks are wired once; they read the latest props through this.
  const latest = useRef({ value, onChange, onPlaceName });
  useEffect(() => {
    latest.current = { value, onChange, onPlaceName };
  });
  const [mapState, setMapState] = useState<"off" | "loading" | "ready" | "failed">(MAPS_KEY ? "loading" : "off");
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  // Typed coordinates keep their own text, so "20." isn't eaten mid-typing.
  const [latText, setLatText] = useState(value.lat?.toString() ?? "");
  const [lngText, setLngText] = useState(value.lng?.toString() ?? "");
  // When the map or GPS moves the point, show the new numbers.
  const [shown, setShown] = useState({ lat: value.lat, lng: value.lng });
  if (shown.lat !== value.lat || shown.lng !== value.lng) {
    setShown({ lat: value.lat, lng: value.lng });
    if (parseCoord(latText, 90) !== value.lat) setLatText(value.lat?.toString() ?? "");
    if (parseCoord(lngText, 180) !== value.lng) setLngText(value.lng?.toString() ?? "");
  }

  // Build the map and search once.
  useEffect(() => {
    if (!MAPS_KEY) return;
    let cancelled = false;
    (async () => {
      try {
        const google = await loadMaps();
        const [{ Map, Circle }, { Marker }, { Geocoder }, places] = await Promise.all([
          google.maps.importLibrary("maps"),
          google.maps.importLibrary("marker"),
          google.maps.importLibrary("geocoding"),
          google.maps.importLibrary("places"),
        ]);
        if (cancelled || !mapDiv.current) return;
        const start = latest.current.value;
        const center = start.lat != null && start.lng != null ? { lat: start.lat, lng: start.lng } : INDIA;
        const map = new Map(mapDiv.current, {
          center,
          zoom: start.lat != null ? 17 : 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        const marker = new Marker({ map, position: start.lat != null ? center : null, draggable: true });
        const circle = new Circle({
          map,
          center: start.lat != null ? center : null,
          radius: radiusM,
          strokeColor: "#7166F3",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#7166F3",
          fillOpacity: 0.12,
          clickable: false,
        });
        const geocoder = new Geocoder();
        maps.current = { map, marker, circle, geocoder };

        const place = (lat: number, lng: number, address?: string) => {
          const pos = { lat, lng };
          marker.setPosition(pos);
          circle.setCenter(pos);
          if (address !== undefined) {
            latest.current.onChange({ address, lat, lng });
            return;
          }
          latest.current.onChange({ ...latest.current.value, lat, lng });
          geocoder
            .geocode({ location: pos })
            .then((r: any) => {
              const text = r?.results?.[0]?.formatted_address;
              if (text) latest.current.onChange({ address: text, lat, lng });
            })
            .catch(() => undefined);
        };

        map.addListener("click", (e: any) => place(e.latLng.lat(), e.latLng.lng()));
        marker.addListener("dragend", (e: any) => place(e.latLng.lat(), e.latLng.lng()));

        // Address search: Places Autocomplete (the current web component).
        if (searchDiv.current && places.PlaceAutocompleteElement) {
          const search = new places.PlaceAutocompleteElement({ includedRegionCodes: ["in"] });
          search.setAttribute("placeholder", "Search the shop, warehouse or street");
          search.style.width = "100%";
          searchDiv.current.replaceChildren(search);
          const onPick = async (picked: any) => {
            if (!picked) return;
            await picked.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
            const loc = picked.location;
            if (!loc) return;
            place(loc.lat(), loc.lng(), picked.formattedAddress ?? "");
            map.setCenter({ lat: loc.lat(), lng: loc.lng() });
            map.setZoom(17);
            if (picked.displayName) latest.current.onPlaceName?.(picked.displayName);
          };
          search.addEventListener("gmp-select", (e: any) => void onPick(e.placePrediction?.toPlace()));
          // Older name for the same event, still sent by some versions.
          search.addEventListener("gmp-placeselect", (e: any) => void onPick(e.place));
        }
        setMapState("ready");
      } catch {
        if (!cancelled) setMapState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Built once; later changes are pushed in by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the circle in step with the radius field.
  useEffect(() => {
    maps.current?.circle.setRadius(radiusM);
  }, [radiusM]);

  function useMyLocation() {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError("This device can't share its location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const m = maps.current;
        if (m) {
          const at = { lat, lng };
          m.marker.setPosition(at);
          m.circle.setCenter(at);
          m.map.setCenter(at);
          m.map.setZoom(18);
          onChange({ ...value, lat, lng });
          m.geocoder
            .geocode({ location: at })
            .then((r: any) => {
              const text = r?.results?.[0]?.formatted_address;
              if (text) latest.current.onChange({ address: text, lat, lng });
            })
            .catch(() => undefined);
        } else {
          onChange({ ...value, lat, lng });
        }
        if (pos.coords.accuracy > 100) {
          setGpsError(`Your phone placed you within about ${Math.round(pos.coords.accuracy)} m. Drag the pin if it's off.`);
        }
      },
      (err) => {
        setLocating(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Location access is blocked for this site. Allow it in the browser, or search the address instead."
            : "Couldn't get your location. Try again outside, or search the address instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  const showMap = mapState === "loading" || mapState === "ready";

  return (
    <div className="flex flex-col gap-3">
      {showMap && (
        <div className="flex flex-col gap-1.5">
          <span className="text-label text-text-primary">Find it on the map</span>
          <div ref={searchDiv} className="min-h-11 [&_gmp-place-autocomplete]:w-full" />
        </div>
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={locating}
          leadingIcon={<Crosshair className="size-4" aria-hidden="true" />}
          onClick={useMyLocation}
        >
          Use my current location
        </Button>
        {gpsError && <p className="mt-1.5 text-caption text-status-warning-text">{gpsError}</p>}
      </div>
      {showMap && (
        <div
          ref={mapDiv}
          className="h-64 w-full overflow-hidden rounded-surface-card border border-border-default bg-surface-sunken"
          aria-label="Map. Tap to place the pin, or drag it."
        />
      )}
      {mapState === "failed" && (
        <p className="text-caption text-status-warning-text">
          The map didn&apos;t load. Use your current location or type the coordinates below.
        </p>
      )}
      <Input
        label="Address"
        optional
        value={value.address}
        onChange={(e) => onChange({ ...value, address: e.target.value })}
        placeholder="Shop no., street, area, city"
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Latitude"
          inputMode="decimal"
          value={latText}
          onChange={(e) => {
            setLatText(e.target.value);
            onChange({ ...value, lat: parseCoord(e.target.value, 90) });
          }}
          helper={showMap ? "Set by the map" : undefined}
        />
        <Input
          label="Longitude"
          inputMode="decimal"
          value={lngText}
          onChange={(e) => {
            setLngText(e.target.value);
            onChange({ ...value, lng: parseCoord(e.target.value, 180) });
          }}
        />
      </div>
      {value.lat != null && value.lng != null && (
        <p className="flex items-center gap-1.5 text-caption text-text-secondary">
          <MapPin className="size-3.5" aria-hidden="true" />
          Check-ins count within {radiusM} m of this point.
        </p>
      )}
    </div>
  );
}

function parseCoord(text: string, limit: number): number | null {
  const n = Number(text.trim());
  return text.trim() !== "" && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}
