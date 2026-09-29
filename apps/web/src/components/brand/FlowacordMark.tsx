/**
 * The Flowacord icon mark — the approved brand mark, not a redrawing.
 *
 * Geometry is lifted verbatim from the official vector
 * (`public/brand/flowacord-mark.svg`, viewBox 366.57 × 376.12): five
 * circles of r=54.18 and one arrow path. The file draws the circles as
 * 45°-rotated rounded squares; a rounded square whose radius is half its
 * side IS a circle, so `<circle>` here is the same shape to the pixel.
 *
 * Colours are fixed by the brand guide and do not change with the
 * surface — the mark is the same on white and on the navy ground.
 *
 * Inline SVG rather than an <Image>, because the mark sits inside text
 * lockups in the header and must not flash in late on a slow connection.
 */
export const MARK_VIEWBOX = "0 0 366.57 376.12";

export const FLOWACORD = {
  lavenderLight: "#CEB4F5",
  lavender: "#9F8EF4",
  purple: "#7166F3",
  navy: "#34327F",
  ground: "#010123",
  paper: "#F5F5F5",
} as const;

/** [cx, cy, fill] — the five dots, top row left→right then the left column down. */
export const MARK_DOTS: ReadonlyArray<readonly [number, number, string]> = [
  [54.18, 54.18, FLOWACORD.lavenderLight],
  [183.29, 54.18, FLOWACORD.lavender],
  [312.39, 54.18, FLOWACORD.purple],
  [54.18, 188.06, FLOWACORD.lavender],
  [54.18, 321.94, FLOWACORD.purple],
];
export const MARK_RADIUS = 54.18;
export const MARK_ARROW =
  "M150,253V159a4.21,4.21,0,0,1,4.21-4.21h94a4.21,4.21,0,0,1,3,7.19l-94,94A4.21,4.21,0,0,1,150,253Z";

export function FlowacordMark({
  size = 28,
  className,
  title,
}: {
  size?: number;
  className?: string;
  /** Give the mark a name when it stands alone as the link's only content. */
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size * (376.12 / 366.57)}
      viewBox={MARK_VIEWBOX}
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
      focusable="false"
      className={className}
    >
      {title && <title>{title}</title>}
      {MARK_DOTS.map(([cx, cy, fill]) => (
        <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={MARK_RADIUS} fill={fill} />
      ))}
      <path d={MARK_ARROW} fill={FLOWACORD.lavender} />
    </svg>
  );
}
