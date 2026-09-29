/**
 * Whether this browser has already seen the company's opening animation in
 * this session. The animation writes the cookie when it finishes; the app
 * layouts read it on the server and don't send the animation again. Keyed
 * by the animation's file, so uploading a new one shows it once more.
 */
export const SPLASH_COOKIE = "fh-splash";

export function splashAlreadySeen(cookieValue: string | undefined, version: string): boolean {
  if (!cookieValue) return false;
  try {
    return decodeURIComponent(cookieValue) === version;
  } catch {
    return false;
  }
}
