import { ID_FIELDS, cardSizeMm, fieldText, type IdCardLayout, type IdCardPerson } from "@/lib/idcard/layout";

/**
 * One ID card: the company's own design as the background, with this
 * person's photo and details placed where the layout says. Sized by its
 * height (any CSS length), so "85.6mm" prints at true size and "380px"
 * fits a phone screen — every position and font size scales with it.
 */
export function IdCardView({
  layout,
  person,
  photoUrl,
  backgroundUrl,
  logoUrl = null,
  height,
}: {
  layout: IdCardLayout;
  person: IdCardPerson;
  photoUrl: string | null;
  backgroundUrl: string | null;
  /** Shown at the top only when the company hasn't uploaded a design yet. */
  logoUrl?: string | null;
  height: string;
}) {
  const mm = cardSizeMm(layout.orientation);
  const scaled = (fraction: number) => `calc(${height} * ${fraction})`;
  const { photo } = layout;
  const initials =
    person.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <div
      className="relative shrink-0 overflow-hidden bg-white font-heading [print-color-adjust:exact]"
      style={{
        height,
        width: scaled(mm.w / mm.h),
        // CR80 corners are 3.18 mm.
        borderRadius: scaled(3.18 / mm.h),
        boxShadow: "0 0 0 0.2mm rgba(23,22,62,.18)",
      }}
    >
      {backgroundUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, printed as-is
        <img src={backgroundUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
          <img
            src={logoUrl}
            alt=""
            className="absolute left-1/2 -translate-x-1/2 object-contain"
            style={{ top: "5%", height: "10%", maxWidth: "70%" }}
          />
        )
      )}

      <div
        className="absolute flex items-center justify-center overflow-hidden bg-[#EEEDFD]"
        style={{
          left: `${photo.x}%`,
          top: `${photo.y}%`,
          width: `${photo.w}%`,
          height: `${photo.h}%`,
          borderRadius: photo.shape === "circle" ? "50%" : photo.shape === "rounded" ? "8%" : 0,
        }}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
          <img src={photoUrl} alt={`Photo of ${person.name}`} className="size-full object-cover" />
        ) : (
          <span style={{ fontSize: scaled(0.06), color: "#7166F3", fontWeight: 600 }}>{initials}</span>
        )}
      </div>

      {ID_FIELDS.map((key) => {
        const f = layout.fields[key];
        const text = f.show ? fieldText(person, key, f) : null;
        if (!text) return null;
        return (
          <div
            key={key}
            className="absolute break-words"
            style={{
              left: `${f.x}%`,
              top: `${f.y}%`,
              width: `${f.w}%`,
              fontSize: scaled(f.size / 100),
              lineHeight: 1.15,
              color: f.color,
              fontWeight: f.bold ? 700 : 500,
              textAlign: f.align,
            }}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
}
