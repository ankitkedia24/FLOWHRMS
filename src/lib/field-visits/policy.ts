/**
 * The field visit rules (FIELD-VISITS-MODULE.md §6) — the company's word
 * for what its people visit, its purposes, photo, approval and nudges, who
 * records, and the vehicles travel is paid for. Versioned like every other
 * tenant policy: a trip stamps the version that applied when it started.
 *
 * Pure: no database, no session. Normalisation is the only entry point
 * that reads stored JSON, so an older document still comes out whole.
 */

export const PHOTO_RULES = ["OFF", "OPTIONAL", "REQUIRED"] as const;
export type PhotoRule = (typeof PHOTO_RULES)[number];

export const RECORDER_MODES = ["ALL", "DEPARTMENTS"] as const;
export type RecorderMode = (typeof RECORDER_MODES)[number];

export interface PlaceWord {
  /** Used mid-sentence: "Reached a {singular}". */
  singular: string;
  /** "Search {plural}", "At {plural}". */
  plural: string;
}

/** Words most companies use. Anything else is the company's own word. */
export const PLACE_WORD_PRESETS: ReadonlyArray<PlaceWord & { key: string }> = [
  { key: "place", singular: "place", plural: "places" },
  { key: "customer", singular: "customer", plural: "customers" },
  { key: "party", singular: "party", plural: "parties" },
  { key: "client", singular: "client", plural: "clients" },
  { key: "dealer", singular: "dealer", plural: "dealers" },
  { key: "site", singular: "site", plural: "sites" },
  { key: "store", singular: "store", plural: "stores" },
];

export const PLACE_WORD_MAX = 24;
export const PURPOSE_NAME_MAX = 40;
export const VEHICLE_NAME_MAX = 30;
export const MAX_PURPOSES = 30;
export const MAX_VEHICLES = 10;
/** Rupees per km. Above this is almost certainly a typing slip. */
export const MAX_RATE_PER_KM = 100;
export const FAR_FLAG_MIN_M = 50;
export const FAR_FLAG_MAX_M = 5000;

export interface VisitPurpose {
  /** Stable slug, never shown. */
  key: string;
  name: string;
  /** Retired purposes stay for history and cannot be chosen. */
  isActive: boolean;
  sortOrder: number;
}

export interface Vehicle {
  key: string;
  name: string;
  /** Rupees per km; null = not paid yet, so it cannot be claimed. */
  ratePerKm: number | null;
  isActive: boolean;
  sortOrder: number;
}

export interface FieldVisitsPolicy {
  placeWord: PlaceWord;
  purposes: VisitPurpose[];
  photo: PhotoRule;
  /** A visit this far from a saved place's spot is flagged, never refused. */
  farFlagMeters: number;
  /** Going out raises an approval tile; the trip never waits for it. */
  goingOutApproval: boolean;
  /** Reached, End visit and Back at office tell the reporting manager. */
  managerUpdates: boolean;
  /** Owners never record, whatever this says (§5). */
  recorders: { mode: RecorderMode; departmentIds: string[] };
  vehicles: Vehicle[];
}

const DEFAULT_PURPOSE_NAMES = [
  "Meeting",
  "Event",
  "Sales",
  "Collection",
  "Delivery",
  "Service",
  "Bank / govt office",
  "Purchase",
  "Other",
];

export const DEFAULT_FIELD_VISITS_POLICY: FieldVisitsPolicy = {
  placeWord: { singular: "place", plural: "places" },
  purposes: DEFAULT_PURPOSE_NAMES.map((name, i) => ({
    key: slugify(name),
    name,
    isActive: true,
    sortOrder: (i + 1) * 10,
  })),
  photo: "OPTIONAL",
  farFlagMeters: 300,
  goingOutApproval: true,
  managerUpdates: true,
  recorders: { mode: "ALL", departmentIds: [] },
  // No rate until the company sets one: nobody can claim travel before.
  vehicles: [
    { key: "two-wheeler", name: "Two-wheeler", ratePerKm: null, isActive: true, sortOrder: 10 },
    { key: "four-wheeler", name: "Four-wheeler", ratePerKm: null, isActive: true, sortOrder: 20 },
  ],
};

/** Keys are slugs of the name; stable once published. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** One line, single spaces, trimmed, capped. */
function tidy(value: unknown, max: number): string {
  return str(value).replace(/\s+/g, " ").trim().slice(0, max);
}

/** Two decimal places, or null for anything that isn't a sensible rate. */
export function normalizeRate(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(Math.min(value, MAX_RATE_PER_KM) * 100) / 100;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizePlaceWord(raw: unknown): PlaceWord {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const singular = tidy(r.singular, PLACE_WORD_MAX);
  if (!singular) return { ...DEFAULT_FIELD_VISITS_POLICY.placeWord };
  const plural = tidy(r.plural, PLACE_WORD_MAX) || `${singular}s`.slice(0, PLACE_WORD_MAX);
  return { singular, plural };
}

/** Shared by purposes and vehicles: drop nameless rows, de-duplicate keys (first wins), sort. */
function normalizeList<T extends { key: string; name: string; sortOrder: number }>(
  raw: unknown,
  max: number,
  build: (r: Record<string, unknown>, name: string, key: string, index: number) => T,
  nameMax: number,
): T[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  raw.slice(0, max * 2).forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const r = item as Record<string, unknown>;
    const name = tidy(r.name, nameMax);
    if (!name) return;
    const key = slugify(str(r.key)) || slugify(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(build(r, name, key, i));
  });
  out.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return out.slice(0, max);
}

/**
 * Fill defaults, clamp ranges, drop broken rows, de-duplicate keys. Never
 * throws: a stored document is always readable.
 */
export function normalizeFieldVisitsPolicy(input: unknown): FieldVisitsPolicy {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const purposes = normalizeList<VisitPurpose>(
    raw.purposes,
    MAX_PURPOSES,
    (r, name, key, i) => ({
      key,
      name,
      isActive: bool(r.isActive, true),
      sortOrder: Math.round(num(r.sortOrder, (i + 1) * 10)),
    }),
    PURPOSE_NAME_MAX,
  );

  const vehicles = normalizeList<Vehicle>(
    raw.vehicles,
    MAX_VEHICLES,
    (r, name, key, i) => ({
      key,
      name,
      ratePerKm: normalizeRate(r.ratePerKm),
      isActive: bool(r.isActive, true),
      sortOrder: Math.round(num(r.sortOrder, (i + 1) * 10)),
    }),
    VEHICLE_NAME_MAX,
  );

  const photo = PHOTO_RULES.includes(raw.photo as PhotoRule)
    ? (raw.photo as PhotoRule)
    : DEFAULT_FIELD_VISITS_POLICY.photo;

  const far = Math.round(num(raw.farFlagMeters, DEFAULT_FIELD_VISITS_POLICY.farFlagMeters));

  const rec = (raw.recorders && typeof raw.recorders === "object" ? raw.recorders : {}) as Record<
    string,
    unknown
  >;
  const departmentIds = Array.isArray(rec.departmentIds)
    ? [...new Set(rec.departmentIds.filter((d): d is string => typeof d === "string" && UUID.test(d)))]
    : [];
  const mode: RecorderMode = rec.mode === "DEPARTMENTS" ? "DEPARTMENTS" : "ALL";

  return {
    placeWord: normalizePlaceWord(raw.placeWord),
    // A document without any purposes gets the defaults back; one whose
    // purposes are all retired keeps them retired (choosing is optional).
    purposes: Array.isArray(raw.purposes) ? purposes : DEFAULT_FIELD_VISITS_POLICY.purposes,
    photo,
    farFlagMeters: Math.min(FAR_FLAG_MAX_M, Math.max(FAR_FLAG_MIN_M, far)),
    goingOutApproval: bool(raw.goingOutApproval, DEFAULT_FIELD_VISITS_POLICY.goingOutApproval),
    managerUpdates: bool(raw.managerUpdates, DEFAULT_FIELD_VISITS_POLICY.managerUpdates),
    recorders: { mode, departmentIds: mode === "DEPARTMENTS" ? departmentIds : [] },
    vehicles: Array.isArray(raw.vehicles) ? vehicles : DEFAULT_FIELD_VISITS_POLICY.vehicles,
  };
}

/** Why these rules can't be published yet, or null when they can. */
export function policyProblem(policy: FieldVisitsPolicy): string | null {
  if (policy.recorders.mode === "DEPARTMENTS" && policy.recorders.departmentIds.length === 0) {
    return "Choose at least one department, or let everyone record visits.";
  }
  return null;
}

export function activePurposes(policy: FieldVisitsPolicy): VisitPurpose[] {
  return policy.purposes.filter((p) => p.isActive);
}

/** Vehicles someone can claim travel for: switched on, with a rate. */
export function claimableVehicles(policy: FieldVisitsPolicy): Vehicle[] {
  return policy.vehicles.filter((v) => v.isActive && v.ratePerKm !== null);
}

/**
 * Whether this person records visits. Owners never do — they are who the
 * visits are reported to (§5).
 */
export function mayRecordVisits(
  person: { roleKey: string; departmentId: string | null },
  policy: FieldVisitsPolicy,
): boolean {
  if (person.roleKey === "OWNER") return false;
  if (policy.recorders.mode === "ALL") return true;
  return person.departmentId !== null && policy.recorders.departmentIds.includes(person.departmentId);
}

/** "a place", "an outlet" — the article for the company's own word. */
export function withArticle(word: string): string {
  return `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
}

/** First letter up, for headings: "Places", "Parties". */
export function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
