"use client";

/**
 * Loads the Google Maps JavaScript API once per page, for every map in
 * the app (the work-location picker, the field trip map).
 *
 * Needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — a browser key restricted to the
 * site's domains (DEPLOY.md §7d). Without it `MAPS_KEY` is empty and the
 * callers show their no-map fallback instead of calling this.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- the Maps JS API ships no types here */
export type GoogleNS = any;

declare global {
  interface Window {
    google?: GoogleNS;
    __fhMapsReady?: () => void;
  }
}

export const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

let loading: Promise<GoogleNS> | null = null;

export function loadMaps(): Promise<GoogleNS> {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google);
  loading ??= new Promise((resolve, reject) => {
    window.__fhMapsReady = () => resolve(window.google);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&v=weekly&loading=async&region=IN&callback=__fhMapsReady`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error("Google Maps didn't load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}
