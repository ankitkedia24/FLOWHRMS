/**
 * Where the phone is, right now — asked at a tap and never in between
 * (FIELD-VISITS-MODULE.md §2). Browser only.
 *
 * Like check-in, the wait has a deadline of its own: an unanswered
 * permission prompt fires neither callback, and a tap must never hang on
 * it. No location is a normal answer — the tap is recorded without one.
 */

export interface TapCoords {
  lat: number;
  lng: number;
  accuracyM: number | null;
}

export const SPOT_DEADLINE_MS = 15_000;

export function captureSpot(deadlineMs = SPOT_DEADLINE_MS): Promise<TapCoords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (value: TapCoords | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      resolve(value);
    };
    const watchdog = setTimeout(() => finish(null), deadlineMs);
    navigator.geolocation.getCurrentPosition(
      (position) =>
        finish({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy ?? null,
        }),
      () => finish(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 20_000 },
    );
  });
}
