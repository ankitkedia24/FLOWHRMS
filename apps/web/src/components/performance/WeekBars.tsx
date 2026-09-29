/**
 * This week's points, Monday to Sunday — inline SVG on tokens
 * (PERFORMANCE-MODULE.md §1.9, no chart libraries).
 *
 * Bars grow in under motion-safe; the numbers are in a table for screen
 * readers rather than baked into the drawing, so the chart is decoration
 * over data and not the only copy of it.
 */
export function WeekBars({
  bars,
}: {
  bars: Array<{ day: string; points: number; isToday: boolean }>;
}) {
  const max = Math.max(1, ...bars.map((b) => b.points));
  const width = 308;
  const height = 96;
  const barWidth = 28;
  const gap = (width - bars.length * barWidth) / (bars.length - 1);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height + 18}`}
        className="w-full max-w-[340px]"
        aria-hidden="true"
      >
        {bars.map((bar, i) => {
          const h = Math.max(3, Math.round((bar.points / max) * height));
          const x = i * (barWidth + gap);
          return (
            <g key={bar.day}>
              <rect
                x={x}
                y={height - h}
                width={barWidth}
                height={h}
                rx={5}
                fill={
                  bar.isToday
                    ? "var(--fh-color-brand-primary)"
                    : bar.points > 0
                      ? "var(--fh-color-brand-primary-subtle)"
                      : "var(--fh-color-surface-sunken)"
                }
                className="motion-safe:[transition:height_.6s_cubic-bezier(.2,.8,.2,1),y_.6s_cubic-bezier(.2,.8,.2,1)]"
              />
              <text
                x={x + barWidth / 2}
                y={height + 14}
                textAnchor="middle"
                fontSize={11}
                fontWeight={bar.isToday ? 700 : 500}
                fill={
                  bar.isToday
                    ? "var(--fh-color-brand-primary)"
                    : "var(--fh-color-text-tertiary)"
                }
              >
                {bar.day}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Points earned each day this week</caption>
        <thead>
          <tr>
            {bars.map((b) => (
              <th key={b.day} scope="col">
                {b.day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {bars.map((b) => (
              <td key={b.day}>{b.points}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
