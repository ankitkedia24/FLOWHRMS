import { IBM_Plex_Sans, Poppins } from "next/font/google";

/**
 * Fonts for the marketing and sign-in surfaces only.
 *
 * Deliberately NOT in fonts.ts. The variables there are applied to <html>
 * in the root layout, so anything added to them preloads on every route in
 * the product — including the employee app, where a marketing typeface
 * would be dead weight on a phone. These two are applied on the marketing
 * wrapper instead, which lets Next scope the preload to the routes that
 * actually render them.
 *
 * Self-hosted like the rest: next/font fetches the files at build time and
 * serves them from our origin, so no request reaches the Google CDN at
 * runtime (the design bundle links fonts.googleapis.com; we do not).
 */
export const poppinsDisplay = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-poppins-display",
  display: "swap",
});

export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
  preload: true,
});

export const marketingFontVariables = `${poppinsDisplay.variable} ${ibmPlexSans.variable}`;
