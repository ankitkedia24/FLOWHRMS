/**
 * The navy activity strip under the hero.
 *
 * The items are listed twice and the track slides exactly -50%, which is
 * what makes the loop seamless: at the halfway point the second copy sits
 * precisely where the first began, so the reset is invisible.
 *
 * `aria-hidden` on the whole strip is deliberate. It is decorative motion
 * repeating four sample events, and a screen reader announcing the same
 * four lines twice, forever, would be worse than silence. Everything it
 * says is stated properly elsewhere on the page.
 *
 * On a phone the animation stops and the strip becomes an ordinary
 * horizontal scroll (see marketing.css) — auto-scrolling text under a
 * thumb is a fight nobody wins.
 */

const ITEMS = [
  { dot: "var(--m-green)", text: "Ramesh checked in at Jaipur warehouse" },
  { dot: "var(--m-amber)", text: "12 tasks completed today" },
  { dot: "var(--m-green)", text: "Priya's leave request approved" },
  { dot: "var(--m-red)", text: "Payroll review due in 6 days" },
];

export function Ticker() {
  return (
    <div className="m-ticker overflow-hidden bg-[color:var(--m-navy)] py-[15px]" aria-hidden="true">
      <div className="m-ticker-track">
        {[0, 1].map((copy) =>
          ITEMS.map((item) => (
            <span
              key={`${copy}-${item.text}`}
              className="flex items-center gap-2.5 whitespace-nowrap text-sm text-[color:var(--m-cream)]"
            >
              <span className="size-[7px] rounded-full" style={{ background: item.dot }} />
              {item.text}
            </span>
          )),
        )}
      </div>
    </div>
  );
}
