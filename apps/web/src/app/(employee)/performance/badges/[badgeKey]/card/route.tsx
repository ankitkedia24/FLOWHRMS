import { ImageResponse } from "next/og";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { BADGES } from "@/lib/performance/badges";
import {
  FLOWACORD,
  MARK_ARROW,
  MARK_DOTS,
  MARK_RADIUS,
  MARK_VIEWBOX,
} from "@/components/brand/FlowacordMark";

export const dynamic = "force-dynamic";

/**
 * A shareable achievement card (PERFORMANCE-MODULE.md §F) — a PNG the
 * person downloads and forwards themselves, on WhatsApp or wherever.
 *
 * Two rules keep it honest:
 * - Only YOUR OWN earned badges render. The gate is the badge row, so a
 *   guessed URL for something unearned is a plain 404 — a share card for
 *   a badge you don't have would be the product helping someone lie.
 * - It carries the first name, the badge, and the company — nothing else.
 *   No points, no rank: the card is a brag the person chose to make, not
 *   a leak of their standing.
 *
 * Drawn with the same next/og machinery as the app icons: no new
 * dependency, no binary assets, brand colours inline.
 */

const NAVY = FLOWACORD.ground;
const CREAM = FLOWACORD.paper;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ badgeKey: string }> },
) {
  // The same gate as every other performance surface: module off means
  // no cards, however real the badge underneath. A 404 rather than a
  // redirect — this is an image URL, and an image that bounces to a
  // sign-in page renders as a broken thumbnail wherever it was pasted.
  let session;
  try {
    const access = await checkAccess({ module: "PERFORMANCE" });
    if (!access.decision.allowed) return new Response("Not found", { status: 404 });
    session = access.session;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const { badgeKey } = await params;
  const badge = BADGES.find((b) => b.key === badgeKey);
  if (!badge) return new Response("Not found", { status: 404 });

  const earned = await getDb().employeeBadge.findFirst({
    where: {
      tenantId: session.tenant.id,
      membershipId: session.membership.id,
      badgeKey,
    },
  });
  if (!earned) return new Response("Not found", { status: 404 });

  const firstName = session.user.displayName.split(/\s+/)[0];
  const when = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: session.tenant.timezone,
  }).format(earned.earnedAt);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: NAVY,
          color: CREAM,
          fontFamily: "sans-serif",
        }}
      >
        {/* the Flowacord mark — the official geometry, as the app icon draws it */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={124}
          height={127}
          viewBox={MARK_VIEWBOX}
        >
          {MARK_DOTS.map(([cx, cy, fill]) => (
            <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={MARK_RADIUS} fill={fill} />
          ))}
          <path d={MARK_ARROW} fill={FLOWACORD.lavender} />
        </svg>

        <div style={{ display: "flex", fontSize: 26, marginTop: 36, opacity: 0.75 }}>
          Badge earned
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            marginTop: 8,
            textAlign: "center",
          }}
        >
          {badge.name}
        </div>
        <div style={{ display: "flex", fontSize: 28, marginTop: 14, color: FLOWACORD.lavenderLight }}>
          {firstName} · {session.tenant.name}
        </div>
        <div style={{ display: "flex", fontSize: 22, marginTop: 8, opacity: 0.6 }}>
          {badge.earnedLine} · {when}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 20,
            marginTop: 40,
            opacity: 0.5,
            letterSpacing: 2,
          }}
        >
          FlowHRMS · by Flowacord
        </div>
      </div>
    ),
    { width: 1080, height: 566 },
  );
}
