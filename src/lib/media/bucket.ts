/**
 * company-media: a company's logo, opening animation, ID card design,
 * employee photos and field visit photos. Private (scripts/setup-storage.ts);
 * shown through short-lived signed URLs (src/lib/media/urls.ts).
 */
export const MEDIA_BUCKET = "company-media";
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;

/** `visits`: optional photos taken at a field visit (FIELD-VISITS-MODULE.md §6). */
export type MediaKind = "logo" | "photos" | "splash" | "idcard" | "visits";

/** The opening animation may be at most this long, and is cut off there. */
export const SPLASH_MAX_SECONDS = 4;
export const SPLASH_MAX_BYTES = 5 * 1024 * 1024;

/**
 * A path the browser uploaded to is only accepted if it sits in this
 * company's folder for that kind of file. Uploads go straight from the
 * browser to storage, so the path that comes back is untrusted input.
 */
export function mediaPathOk(path: unknown, tenantId: string, kind: MediaKind): path is string {
  if (typeof path !== "string" || path.length > 200) return false;
  const prefix = `${tenantId}/${kind}/`;
  return path.startsWith(prefix) && /^[A-Za-z0-9._-]+$/.test(path.slice(prefix.length));
}
