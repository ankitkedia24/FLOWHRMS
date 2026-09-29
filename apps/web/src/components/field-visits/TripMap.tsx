"use client";

import { useEffect, useRef, useState } from "react";
import { loadMaps, MAPS_KEY } from "@/lib/maps/load";
import type { TripMapData } from "@/lib/field-visits/state";

/**
 * A trip on a map (FIELD-VISITS-MODULE.md §7): the tapped spots, numbered
 * in order, joined by the road taken — or by a dashed straight line where
 * the road distance isn't known. Only the spots someone tapped; nothing in
 * between was ever recorded.
 *
 * Needs the browser Maps key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY); without it
 * the trip is shown as the timeline alone.
 */

const BRAND = "#7166F3";

export function TripMap({ data }: { data: TripMapData }) {
  const div = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!MAPS_KEY || data.stops.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const google = await loadMaps();
        const [{ Map, Polyline }, { Marker }, geometry] = await Promise.all([
          google.maps.importLibrary("maps"),
          google.maps.importLibrary("marker"),
          google.maps.importLibrary("geometry"),
        ]);
        if (cancelled || !div.current) return;
        const map = new Map(div.current, {
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "cooperative",
        });
        const bounds = new google.maps.LatLngBounds();

        for (const leg of data.legs) {
          const path = leg.polyline ? geometry.encoding.decodePath(leg.polyline) : [leg.from, leg.to];
          for (const p of path) bounds.extend(p);
          new Polyline({
            map,
            path,
            strokeColor: BRAND,
            strokeOpacity: leg.polyline ? 0.85 : 0,
            strokeWeight: 4,
            // Dashed where only the straight line is known.
            icons: leg.polyline
              ? []
              : [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.8, scale: 3 }, offset: "0", repeat: "14px" }],
          });
        }
        for (const stop of data.stops) {
          bounds.extend(stop);
          new Marker({
            map,
            position: stop,
            title: stop.title,
            label: { text: stop.label, color: "#ffffff", fontSize: "12px", fontWeight: "600" },
          });
        }
        if (data.stops.length + data.legs.length > 1) map.fitBounds(bounds, 32);
        else {
          map.setCenter(data.stops[0]);
          map.setZoom(15);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (!MAPS_KEY || data.stops.length === 0 || failed) return null;
  return (
    <div
      ref={div}
      role="img"
      aria-label="Map of the trip: the tapped spots, in order, and the road between them"
      className="h-64 w-full overflow-hidden rounded-md border border-border-subtle bg-surface-sunken"
    />
  );
}
