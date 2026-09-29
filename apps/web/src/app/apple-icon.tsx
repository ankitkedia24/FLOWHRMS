import { ImageResponse } from "next/og";
import { iconArt } from "@/lib/brand/icon-art";

/**
 * The home-screen icon on iOS.
 *
 * Safari ignores the manifest's icons and reads `apple-touch-icon`, and it
 * will not accept an SVG — which is all the repo shipped, so an installed
 * FlowHRMS showed a grey screenshot instead of the mark.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(iconArt(size.width), size);
}
