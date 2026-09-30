/**
 * Rules for recording a server error on the live site (errors.ts does the
 * database and the email). Pure, and tested in src/tests/platform-errors.test.ts.
 */
import { createHash } from "node:crypto";

/** Where crash alerts go: Flowacord's own inbox, like the lockout codes. */
export { PLATFORM_APPROVAL_EMAIL as ALERT_EMAIL } from "./lockout-policy";

/** One email per kind of error in this window; the rest are only counted. */
export const ALERT_EVERY_MS = 60 * 60 * 1000;

/** Longest message kept, after scrubbing. */
export const MESSAGE_MAX = 300;

/**
 * Take personal data out of an error message before it is stored or
 * emailed. Messages rarely carry any, but a database error can quote the
 * value that broke a rule — an email address, a phone number.
 */
export function scrubMessage(raw: string): string {
  const oneLine = raw.replace(/\s+/g, " ").trim() || "(no message)";
  const scrubbed = oneLine
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\+?\d[\d\s-]{8,}\d/g, "[number]");
  return scrubbed.length > MESSAGE_MAX ? `${scrubbed.slice(0, MESSAGE_MAX - 1)}…` : scrubbed;
}

/**
 * Same route, same kind, same message — with ids and numbers blanked, so
 * "claim 41 not found" and "claim 42 not found" count as one error.
 */
export function errorFingerprint(input: { route: string; kind: string; message: string }): string {
  const shape = input.message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\d+/g, "#");
  return createHash("sha256").update(`${input.kind}|${input.route}|${shape}`).digest("hex").slice(0, 32);
}

/** Email this occurrence? The first of a kind, then at most once an hour. */
export function shouldEmail(lastEmailedAt: Date | null, now: Date): boolean {
  return !lastEmailedAt || now.getTime() - lastEmailedAt.getTime() >= ALERT_EVERY_MS;
}

/**
 * Next.js signals redirects and not-found pages by throwing; those are
 * the app working, not failing.
 */
export function isControlFlow(digest: string | undefined): boolean {
  if (!digest) return false;
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND";
}

/** The route file without a query string, e.g. "/(admin)/admin/employees/[membershipId]". */
export function routeLabel(routePath: string | undefined, path: string | undefined): string {
  const r = routePath?.trim() || path?.split("?")[0]?.trim() || "(unknown)";
  return r.length > 200 ? r.slice(0, 200) : r;
}
