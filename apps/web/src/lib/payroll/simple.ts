import { roundRupees } from "./engine";
import type { ComponentCalculation, ComponentKind } from "./engine";

/**
 * Simple pay setup — the vocabulary-free path (D-P10-01).
 *
 * An owner's mental model is "I pay Ramesh ₹18,000 a month, minus days he
 * didn't work". This module turns that one number into the structures the
 * engine already understands, so the engine, the payslip and the approval
 * flow do not change at all — only what a person must know to use them.
 *
 * Pure: no I/O, no database, fully unit-tested. The server actions own
 * persistence; screens own presentation.
 */

export const MONTHLY_SALARY_KEY = "monthly_salary";

export interface PackComponent {
  key: string;
  name: string;
  kind: ComponentKind;
  calculation: ComponentCalculation;
  prorated: boolean;
  sortOrder: number;
  /** Only for PERCENT_OF_BASE components: the pack's suggested percent. */
  defaultPercent?: number;
}

export const MONTHLY_SALARY_COMPONENT: PackComponent = {
  key: MONTHLY_SALARY_KEY,
  name: "Monthly salary",
  kind: "EARNING",
  calculation: "FIXED",
  prorated: true,
  sortOrder: 10,
};

export type PackId = "single" | "basic_hra" | "custom";

/** What the tenant chose, stored as the versioned `pay_setup` policy. */
export interface PaySetupPolicy {
  pack: PackId;
  /** Percent overrides by component key, for packs that use percentages. */
  percents?: Record<string, number>;
}

export interface StarterPack {
  id: Exclude<PackId, "custom">;
  label: string;
  /**
   * Must say "illustrative" — packs are a starting shape, never advice
   * (D-P3-01). A unit test enforces this.
   */
  description: string;
  components: PackComponent[];
}

/**
 * The packs. Deliberately NO provident fund, ESI, professional tax or TDS:
 * FlowHRMS ships no statutory items (D-P3-01), and a pack that included one
 * would be read as advice about the law.
 */
export const STARTER_PACKS: readonly StarterPack[] = [
  {
    id: "single",
    label: "Single amount",
    description:
      "One monthly salary per person, reduced for unpaid days. The simplest setup, right for most businesses.",
    components: [MONTHLY_SALARY_COMPONENT],
  },
  {
    id: "basic_hra",
    label: "Basic + HRA + allowance",
    description:
      "Splits each salary into basic pay, house rent allowance and a fixed allowance. The percentages are illustrative — change them to whatever your company uses.",
    components: [
      {
        key: "basic",
        name: "Basic",
        kind: "EARNING",
        calculation: "PERCENT_OF_BASE",
        prorated: true,
        sortOrder: 10,
        defaultPercent: 60,
      },
      {
        key: "hra",
        name: "House rent allowance",
        kind: "EARNING",
        calculation: "PERCENT_OF_BASE",
        prorated: true,
        sortOrder: 20,
        defaultPercent: 25,
      },
      {
        // The remainder line: whatever the percent lines leave of the
        // salary. Keeping it FIXED means a full month always adds back up
        // to the number the owner typed.
        key: "fixed_allowance",
        name: "Fixed allowance",
        kind: "EARNING",
        calculation: "FIXED",
        prorated: true,
        sortOrder: 30,
      },
    ],
  },
];

export function packById(id: PackId): StarterPack | null {
  return STARTER_PACKS.find((p) => p.id === id) ?? null;
}

export type PayMode =
  | {
      mode: "SIMPLE";
      /**
       * The component that carries the salary. Usually `monthly_salary`,
       * but a tenant that already made its own single fixed earning —
       * "Salary", "Pay" — keeps it: their existing structures ARE the
       * simple shape, and creating a second component beside it would
       * split their history in two.
       */
      carrier: PackComponent;
    }
  | { mode: "PACK"; pack: StarterPack; percents: Record<string, number> }
  | { mode: "CUSTOM" };

export interface ActiveComponent {
  key: string;
  kind: ComponentKind;
  calculation: ComponentCalculation;
  prorated: boolean;
}

/** A component that could carry a whole salary on its own. */
function isCarrierShaped(c: ActiveComponent): boolean {
  return c.kind === "EARNING" && c.calculation === "FIXED" && c.prorated;
}

/**
 * Which setup this tenant is actually in.
 *
 * Component EVIDENCE beats the stored policy: a tenant whose payslips
 * depend on components beyond the declared pack is Custom no matter what
 * the policy row says, so the one-number forms can never quietly save a
 * structure that ignores half of someone's pay. Carrier-shaped leftovers
 * (a lingering monthly salary from before a pack switch) are tolerated.
 */
export function resolvePayMode(
  policy: PaySetupPolicy | null,
  activeComponents: readonly ActiveComponent[],
): PayMode {
  if (policy?.pack === "custom") return { mode: "CUSTOM" };

  if (policy?.pack === "basic_hra") {
    const pack = packById("basic_hra")!;
    const packKeys = new Set(pack.components.map((c) => c.key));
    // Beyond the pack, only carrier-shaped leftovers are tolerated: they
    // cannot silently change anyone's pay, because pack saves never
    // include them and old structures are never rewritten.
    const beyond = activeComponents.filter(
      (c) => !packKeys.has(c.key) && !isCarrierShaped(c),
    );
    if (beyond.length > 0) return { mode: "CUSTOM" };
    return {
      mode: "PACK",
      pack,
      percents: normalizePackPercents("basic_hra", policy?.percents),
    };
  }

  if (activeComponents.length === 0) {
    return { mode: "SIMPLE", carrier: MONTHLY_SALARY_COMPONENT };
  }
  if (activeComponents.length === 1 && isCarrierShaped(activeComponents[0])) {
    const existing = activeComponents[0];
    return {
      mode: "SIMPLE",
      carrier:
        existing.key === MONTHLY_SALARY_KEY
          ? MONTHLY_SALARY_COMPONENT
          : { ...MONTHLY_SALARY_COMPONENT, key: existing.key },
    };
  }
  return { mode: "CUSTOM" };
}

/**
 * Clamp pack percents to something the maths can live with: each 0–100,
 * and together at most 100 so the remainder line is never negative.
 * Anything invalid falls back to the pack defaults.
 */
export function normalizePackPercents(
  packId: PackId,
  raw: Record<string, number> | undefined,
): Record<string, number> {
  const pack = packId === "custom" ? null : packById(packId);
  if (!pack) return {};

  const defaults: Record<string, number> = {};
  for (const c of pack.components) {
    if (c.defaultPercent != null) defaults[c.key] = c.defaultPercent;
  }
  if (!raw) return defaults;

  const result: Record<string, number> = {};
  let sum = 0;
  for (const key of Object.keys(defaults)) {
    const value = raw[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
      return defaults;
    }
    result[key] = value;
    sum += value;
  }
  if (sum > 100) return defaults;
  return result;
}

/**
 * The structure lines one typed salary becomes.
 *
 * SIMPLE: one FIXED line carrying the whole salary.
 * PACK: the percent lines at their configured rates, plus the fixed
 * remainder — computed against the ROUNDED percent lines (the engine
 * rounds each line half-up and sums the rounded lines, D-P3-02), so a
 * full month's gross is exactly the salary the owner typed.
 */
export function buildSalaryLines(input: {
  mode: PayMode;
  monthlySalary: number;
  componentIdByKey: ReadonlyMap<string, string>;
}): Array<{ componentId: string; amount: number; percent: number }> {
  const { mode, monthlySalary, componentIdByKey } = input;

  const idFor = (key: string): string => {
    const id = componentIdByKey.get(key);
    if (!id) throw new Error(`Missing component for key "${key}".`);
    return id;
  };

  if (mode.mode === "SIMPLE") {
    return [{ componentId: idFor(mode.carrier.key), amount: monthlySalary, percent: 0 }];
  }
  if (mode.mode !== "PACK") {
    throw new Error("Custom setups build their own lines in the editor.");
  }

  const lines: Array<{ componentId: string; amount: number; percent: number }> = [];
  let percentTotal = 0;
  let remainderKey: string | null = null;

  for (const component of mode.pack.components) {
    if (component.calculation === "PERCENT_OF_BASE") {
      const percent = mode.percents[component.key] ?? component.defaultPercent ?? 0;
      lines.push({ componentId: idFor(component.key), amount: 0, percent });
      percentTotal += roundRupees((monthlySalary * percent) / 100);
    } else {
      remainderKey = component.key;
    }
  }
  if (remainderKey) {
    lines.push({
      componentId: idFor(remainderKey),
      amount: Math.max(0, monthlySalary - percentTotal),
      percent: 0,
    });
  }
  return lines;
}

export interface SwitchComponent {
  key: string;
  name: string;
  kind: ComponentKind;
  calculation: ComponentCalculation;
  prorated: boolean;
  isActive: boolean;
  /** Is this component part of anyone's saved salary structure? */
  referenced: boolean;
}

export type PackSwitchPlan =
  | {
      ok: true;
      /** Components to upsert (name preserved on update, active asserted). */
      ensure: PackComponent[];
      /** Active, unreferenced components to deactivate — safe by definition. */
      deactivateKeys: string[];
    }
  | {
      ok: false;
      /** Names of the components that make the switch dishonest. */
      blocking: string[];
    };

/**
 * What switching to a pack would actually do to this tenant's components —
 * or why it must be refused.
 *
 * The first version of the switch upserted the pack's components by key
 * and hoped. For a tenant whose salary already lived on its own component,
 * that CREATED a second carrier, which made the tenant resolve to Custom,
 * which made the button look dead — four times in a row, per the audit
 * log. The rules it was missing:
 *
 * - An existing referenced carrier IS the single-amount setup. Adopt it.
 * - A referenced component can never be deactivated (the engine silently
 *   pays ₹0 for inactive components) and never ignored — if it stands in
 *   the way of the target mode, the switch is refused, naming it.
 * - Unreferenced strays are cleaned up. Deactivating them can change
 *   nothing, because nothing points at them.
 */
export function planPackSwitch(
  target: Exclude<PackId, "custom">,
  components: readonly SwitchComponent[],
): PackSwitchPlan {
  const active = components.filter((c) => c.isActive);
  const asCarrier = (c: SwitchComponent): PackComponent =>
    c.key === MONTHLY_SALARY_KEY
      ? MONTHLY_SALARY_COMPONENT
      : { ...MONTHLY_SALARY_COMPONENT, key: c.key };

  if (target === "single") {
    const carriers = active.filter(isCarrierShaped);
    const referencedCarriers = carriers.filter((c) => c.referenced);
    const blocking = active.filter((c) => !isCarrierShaped(c) && c.referenced);

    // Two referenced carriers cannot become one number honestly either.
    if (referencedCarriers.length > 1) {
      blocking.push(...referencedCarriers.slice(1));
    }
    if (blocking.length > 0) {
      return { ok: false, blocking: blocking.map((c) => c.name) };
    }

    const carrier =
      referencedCarriers[0] ??
      carriers.find((c) => c.key === MONTHLY_SALARY_KEY) ??
      carriers[0];

    const ensure = carrier ? asCarrier(carrier) : MONTHLY_SALARY_COMPONENT;
    return {
      ok: true,
      ensure: [ensure],
      deactivateKeys: active
        .filter((c) => c.key !== ensure.key && !c.referenced)
        .map((c) => c.key),
    };
  }

  const pack = packById(target)!;
  const packKeys = new Set(pack.components.map((c) => c.key));
  // Carrier-shaped leftovers are tolerated by resolvePayMode, so they do
  // not block; anything else that is referenced does.
  const blocking = active.filter(
    (c) => !packKeys.has(c.key) && !isCarrierShaped(c) && c.referenced,
  );
  if (blocking.length > 0) {
    return { ok: false, blocking: blocking.map((c) => c.name) };
  }
  return {
    ok: true,
    ensure: [...pack.components],
    deactivateKeys: active
      .filter((c) => !packKeys.has(c.key) && !c.referenced)
      .map((c) => c.key),
  };
}

/**
 * Is this stored structure the simple one-line shape — one fixed earning
 * that IS the salary? Judged by shape, not key, so a tenant's own single
 * "Salary" component from before this feature reads correctly.
 */
export function isSimpleStructure(
  lines: ReadonlyArray<{
    component: { kind: ComponentKind; calculation: ComponentCalculation };
  }>,
): boolean {
  return (
    lines.length === 1 &&
    lines[0].component.kind === "EARNING" &&
    lines[0].component.calculation === "FIXED"
  );
}
