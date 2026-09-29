import type { ReactElement } from "react";
import {
  FLOWACORD,
  MARK_ARROW,
  MARK_DOTS,
  MARK_RADIUS,
  MARK_VIEWBOX,
} from "@/components/brand/FlowacordMark";

/**
 * The FlowHRMS app icon, drawn for `ImageResponse`.
 *
 * The repo ships only SVG artwork, and neither Safari (`apple-touch-icon`)
 * nor Chrome's installability check will take an SVG. Satori renders inline
 * SVG, so the icon embeds the official Flowacord mark's own geometry
 * (`components/brand/FlowacordMark.tsx`) on the brand ground and Next
 * generates real PNGs at request time. Nothing here is redrawn.
 */

/** The plate the mark sits on. Also the PWA splash colour. */
export const BRAND_GROUND = FLOWACORD.ground;

/** The mark occupies this fraction of the icon box (matches the SVG). */
const MARK_SPAN = 1 / 1.3;

/**
 * `maskable` shrinks the artwork into the centre so Android can crop it to
 * a circle or squircle without slicing the mark. The background still
 * bleeds to the edge, which is what the maskable contract requires.
 */
export function iconArt(size: number, maskable = false): ReactElement {
  const scale = maskable ? 0.62 : 1;
  const span = Math.round(size * MARK_SPAN * scale);
  const inset = Math.round((size - span) / 2);

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: size,
        height: size,
        backgroundColor: BRAND_GROUND,
        // Maskable icons must be square: the launcher applies its own mask.
        borderRadius: maskable ? 0 : Math.round(size * 0.18),
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={span}
        height={span}
        viewBox={MARK_VIEWBOX}
        style={{ position: "absolute", left: inset, top: inset }}
      >
        {MARK_DOTS.map(([cx, cy, fill]) => (
          <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={MARK_RADIUS} fill={fill} />
        ))}
        <path d={MARK_ARROW} fill={FLOWACORD.lavender} />
      </svg>
    </div>
  );
}
