import { Poppins, Wix_Madefor_Text } from "next/font/google";

/**
 * Fonts are self-hosted: next/font downloads the files at build time and
 * serves them from our own origin — no request to the Google CDN at runtime
 * (01-brand/typography.md §2; design handoff README §2).
 *
 * Preload policy: the handoff asks for exactly two preloaded faces —
 * Wix Madefor Text 400 and Poppins 700. next/font preloads per family.
 *
 * Figures (27 Sept 2026, owner's choice): numbers, times, codes and the
 * small meta lines used to be set in Spline Sans Mono. They are now set in
 * Poppins, the brand face, so `font-mono` resolves to Poppins and the mono
 * face is no longer loaded. 400 is added for the regular-weight meta lines.
 */
export const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-poppins",
  display: "swap",
  preload: true,
});

export const wixMadeforText = Wix_Madefor_Text({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-wix-madefor-text",
  display: "swap",
  preload: true,
});

export const fontVariables = `${poppins.variable} ${wixMadeforText.variable}`;
