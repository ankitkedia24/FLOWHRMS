/**
 * Where things sit on a company's ID card. The company uploads the whole
 * design as one image; FlowHRMS only places each person's photo and a few
 * lines of text on it. Every position is a percentage of the card, so the
 * same layout renders on a phone screen and prints at true size (CR80,
 * 85.6 × 54 mm). Pure and tested (src/tests/idcard.test.ts).
 */

export const ID_FIELDS = ["name", "designation", "employeeCode", "department", "bloodGroup", "phone"] as const;
export type IdField = (typeof ID_FIELDS)[number];

export const FIELD_LABELS: Record<IdField, string> = {
  name: "Name",
  designation: "Designation",
  employeeCode: "Employee ID",
  department: "Department",
  bloodGroup: "Blood group",
  phone: "Phone",
};

export interface FieldLayout {
  show: boolean;
  /** Left edge and top edge, % of card width / height. */
  x: number;
  y: number;
  /** Box width, % of card width. Text wraps to it. */
  w: number;
  /** Font size, % of card height. */
  size: number;
  color: string;
  bold: boolean;
  align: "left" | "center" | "right";
  /** Printed before the value, e.g. "ID: " or "Blood group: ". */
  prefix: string;
}

export interface IdCardLayout {
  orientation: "portrait" | "landscape";
  photo: { x: number; y: number; w: number; h: number; shape: "rect" | "rounded" | "circle" };
  fields: Record<IdField, FieldLayout>;
}

/** CR80, the size of a bank card. */
export const CARD_MM = { long: 85.6, short: 54 } as const;

export function cardSizeMm(orientation: IdCardLayout["orientation"]): { w: number; h: number } {
  return orientation === "portrait" ? { w: CARD_MM.short, h: CARD_MM.long } : { w: CARD_MM.long, h: CARD_MM.short };
}

const field = (y: number, size: number, extra: Partial<FieldLayout> = {}): FieldLayout => ({
  show: true,
  x: 8,
  y,
  w: 84,
  size,
  color: "#17163E",
  bold: false,
  align: "center",
  prefix: "",
  ...extra,
});

export function defaultLayout(orientation: IdCardLayout["orientation"] = "portrait"): IdCardLayout {
  if (orientation === "landscape") {
    return {
      orientation,
      // 28% of 85.6 mm = 24 mm; 24 / 54 = 44.4% of the height: square.
      photo: { x: 6, y: 24, w: 28, h: 44.4, shape: "rounded" },
      fields: {
        name: field(26, 8, { x: 38, w: 56, bold: true, align: "left" }),
        designation: field(38, 6, { x: 38, w: 56, align: "left" }),
        employeeCode: field(50, 5.5, { x: 38, w: 56, align: "left", prefix: "ID: " }),
        department: field(60, 5.5, { x: 38, w: 56, align: "left", show: false }),
        bloodGroup: field(70, 5.5, { x: 38, w: 56, align: "left", prefix: "Blood group: " }),
        phone: field(80, 5.5, { x: 38, w: 56, align: "left", show: false }),
      },
    };
  }
  return {
    orientation,
    // 40% of 54 mm wide = 21.6 mm; 21.6 / 85.6 = 25.2% of the height: square.
    photo: { x: 30, y: 20, w: 40, h: 25.2, shape: "rounded" },
    fields: {
      name: field(49, 5, { bold: true }),
      designation: field(56, 3.8),
      employeeCode: field(62, 3.4, { prefix: "ID: " }),
      department: field(67, 3.4, { show: false }),
      bloodGroup: field(72, 3.4, { prefix: "Blood group: " }),
      phone: field(77, 3.4, { show: false }),
    },
  };
}

const clamp = (n: unknown, min: number, max: number, fallback: number) => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, Math.round(v * 10) / 10));
};

/** Anything stored or sent from the designer, made safe to render. */
export function normaliseLayout(raw: unknown): IdCardLayout {
  const r = (raw ?? {}) as Partial<IdCardLayout>;
  const orientation = r.orientation === "landscape" ? "landscape" : "portrait";
  const base = defaultLayout(orientation);
  const p = (r.photo ?? {}) as Partial<IdCardLayout["photo"]>;
  const photo = {
    x: clamp(p.x, 0, 95, base.photo.x),
    y: clamp(p.y, 0, 95, base.photo.y),
    w: clamp(p.w, 5, 100, base.photo.w),
    h: clamp(p.h, 5, 100, base.photo.h),
    shape: p.shape === "rect" || p.shape === "circle" ? p.shape : "rounded",
  } as IdCardLayout["photo"];
  const fields = {} as Record<IdField, FieldLayout>;
  for (const key of ID_FIELDS) {
    const f = ((r.fields ?? {}) as Partial<Record<IdField, Partial<FieldLayout>>>)[key] ?? {};
    const d = base.fields[key];
    fields[key] = {
      show: typeof f.show === "boolean" ? f.show : d.show,
      x: clamp(f.x, 0, 95, d.x),
      y: clamp(f.y, 0, 97, d.y),
      w: clamp(f.w, 5, 100, d.w),
      size: clamp(f.size, 1.5, 15, d.size),
      color: typeof f.color === "string" && /^#[0-9a-fA-F]{6}$/.test(f.color) ? f.color : d.color,
      bold: typeof f.bold === "boolean" ? f.bold : d.bold,
      align: f.align === "left" || f.align === "right" || f.align === "center" ? f.align : d.align,
      prefix: typeof f.prefix === "string" ? f.prefix.slice(0, 24) : d.prefix,
    };
  }
  return { orientation, photo, fields };
}

export interface IdCardPerson {
  name: string;
  designation: string | null;
  employeeCode: string | null;
  department: string | null;
  bloodGroup: string | null;
  phone: string | null;
}

/** The text for one field, or null when the person has nothing to print there. */
export function fieldText(person: IdCardPerson, key: IdField, f: FieldLayout): string | null {
  const value = person[key];
  if (!value || !value.trim()) return null;
  return `${f.prefix}${value.trim()}`;
}
