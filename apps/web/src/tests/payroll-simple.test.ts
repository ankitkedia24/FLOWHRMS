import { describe, expect, it } from "vitest";
import {
  MONTHLY_SALARY_KEY,
  STARTER_PACKS,
  buildSalaryLines,
  isSimpleStructure,
  normalizePackPercents,
  packById,
  planPackSwitch,
  resolvePayMode,
} from "@/lib/payroll/simple";
import {
  DEFAULT_LATE_POLICY,
  calculatePayrollLine,
  type ComponentDefinition,
} from "@/lib/payroll/engine";

/**
 * The simple pay path exists so an owner types ONE number. Everything
 * asserted here protects that promise: the number they type is the number
 * a full month pays, the one-number forms can never engage for a tenant
 * whose pay actually depends on more, and packs never drift into being
 * statutory advice (D-P3-01).
 */

const FULL_MONTH = {
  calendarDays: 30,
  presentDays: 30,
  paidLeaveDays: 0,
  unpaidLeaveDays: 0,
  absentDays: 0,
  lateDays: 0,
  lateMinutes: 0,
};

/** Shorthand for an active component in mode resolution. */
const comp = (
  key: string,
  kind: "EARNING" | "DEDUCTION" = "EARNING",
  calculation: "FIXED" | "PERCENT_OF_BASE" | "PER_DAY" = "FIXED",
  prorated = true,
) => ({ key, kind, calculation, prorated });

describe("which mode a tenant is in", () => {
  it("is SIMPLE for a fresh tenant with nothing configured", () => {
    expect(resolvePayMode(null, []).mode).toBe("SIMPLE");
  });

  it("is SIMPLE when only the monthly salary component exists", () => {
    expect(resolvePayMode(null, [comp(MONTHLY_SALARY_KEY)]).mode).toBe("SIMPLE");
  });

  it("adopts a tenant's own single fixed earning as the carrier", () => {
    // The real pilot tenant made a component called "Salary" through the
    // old editor before this feature existed. Their setup IS the simple
    // shape; creating monthly_salary beside it would split history in two.
    const mode = resolvePayMode(null, [comp("salary")]);
    expect(mode.mode).toBe("SIMPLE");
    if (mode.mode === "SIMPLE") {
      expect(mode.carrier.key).toBe("salary");
      // The canonical name only applies when the component is CREATED —
      // an existing "Salary" keeps its name via the upsert semantics.
      expect(mode.carrier.calculation).toBe("FIXED");
    }
  });

  it("does not treat a deduction or per-day component as a carrier", () => {
    expect(resolvePayMode(null, [comp("salary", "DEDUCTION")]).mode).toBe("CUSTOM");
    expect(resolvePayMode(null, [comp("daily_wage", "EARNING", "PER_DAY")]).mode).toBe(
      "CUSTOM",
    );
  });

  it("is CUSTOM for the demo tenant's component set", () => {
    const mode = resolvePayMode(null, [
      comp("basic", "EARNING", "PERCENT_OF_BASE"),
      comp("hra", "EARNING", "PERCENT_OF_BASE"),
      comp("conveyance"),
      comp("provident_fund", "DEDUCTION", "FIXED", false),
    ]);
    expect(mode.mode).toBe("CUSTOM");
  });

  it("lets component evidence override a stale policy", () => {
    // Policy says single-amount, but the tenant's payslips depend on more.
    // The one-number form must NOT engage — it would save a structure that
    // ignores half of someone's pay.
    const mode = resolvePayMode({ pack: "single" }, [
      comp(MONTHLY_SALARY_KEY),
      comp("overtime", "EARNING", "PER_DAY"),
    ]);
    expect(mode.mode).toBe("CUSTOM");
  });

  it("tolerates carrier-shaped leftovers after a pack switch", () => {
    // A lingering monthly salary (or the pilot's "salary") cannot change
    // anyone's pay: pack saves never include it and old structures are
    // never rewritten.
    const mode = resolvePayMode({ pack: "basic_hra" }, [
      comp(MONTHLY_SALARY_KEY),
      comp("salary"),
      comp("basic", "EARNING", "PERCENT_OF_BASE"),
      comp("hra", "EARNING", "PERCENT_OF_BASE"),
      comp("fixed_allowance"),
    ]);
    expect(mode.mode).toBe("PACK");
  });

  it("a pack tenant with a non-carrier stray is CUSTOM", () => {
    const mode = resolvePayMode({ pack: "basic_hra" }, [
      comp("basic", "EARNING", "PERCENT_OF_BASE"),
      comp("pf_deduction", "DEDUCTION"),
    ]);
    expect(mode.mode).toBe("CUSTOM");
  });

  it("respects an explicit custom choice regardless of components", () => {
    expect(resolvePayMode({ pack: "custom" }, []).mode).toBe("CUSTOM");
  });
});

describe("what one typed salary becomes", () => {
  const ids = new Map([
    [MONTHLY_SALARY_KEY, "id-monthly"],
    ["basic", "id-basic"],
    ["hra", "id-hra"],
    ["fixed_allowance", "id-allowance"],
  ]);

  const simpleMode = () => resolvePayMode(null, []);

  it("SIMPLE: one fixed line carrying the whole salary", () => {
    expect(
      buildSalaryLines({
        mode: simpleMode(),
        monthlySalary: 18_000,
        componentIdByKey: ids,
      }),
    ).toEqual([{ componentId: "id-monthly", amount: 18_000, percent: 0 }]);
  });

  it("SIMPLE with an adopted carrier: the line lands on THAT component", () => {
    const mode = resolvePayMode(null, [comp("salary")]);
    const lines = buildSalaryLines({
      mode,
      monthlySalary: 18_000,
      componentIdByKey: new Map([["salary", "id-existing-salary"]]),
    });
    expect(lines).toEqual([
      { componentId: "id-existing-salary", amount: 18_000, percent: 0 },
    ]);
  });

  const packMode = () =>
    resolvePayMode({ pack: "basic_hra" }, [
      comp("basic", "EARNING", "PERCENT_OF_BASE"),
      comp("hra", "EARNING", "PERCENT_OF_BASE"),
      comp("fixed_allowance"),
    ]);

  it("PACK: a full month pays back exactly the salary typed", () => {
    // The whole point of the remainder line. Awkward values on purpose:
    // percentages of these do not round cleanly.
    for (const salary of [30_001, 19_999, 1, 45_000]) {
      const lines = buildSalaryLines({
        mode: packMode(),
        monthlySalary: salary,
        componentIdByKey: ids,
      });
      const byId = new Map(lines.map((l) => [l.componentId, l]));
      const components: ComponentDefinition[] = [
        { key: "basic", name: "Basic", kind: "EARNING", calculation: "PERCENT_OF_BASE", isStatutory: false, prorated: true, amount: 0, percent: byId.get("id-basic")!.percent },
        { key: "hra", name: "HRA", kind: "EARNING", calculation: "PERCENT_OF_BASE", isStatutory: false, prorated: true, amount: 0, percent: byId.get("id-hra")!.percent },
        { key: "fixed_allowance", name: "Fixed allowance", kind: "EARNING", calculation: "FIXED", isStatutory: false, prorated: true, amount: byId.get("id-allowance")!.amount, percent: 0 },
      ];
      const result = calculatePayrollLine({
        structure: { baseAmount: salary, components },
        attendance: FULL_MONTH,
        policy: DEFAULT_LATE_POLICY,
      });
      expect(result.gross, `salary ${salary}`).toBe(salary);
      expect(result.net, `salary ${salary}`).toBe(salary);
    }
  });

  it("PACK: the remainder is never negative, even at 100 percent", () => {
    const mode = packMode();
    const full = { ...mode, percents: { basic: 75, hra: 25 } } as typeof mode;
    const lines = buildSalaryLines({
      mode: full,
      monthlySalary: 30_001,
      componentIdByKey: ids,
    });
    const allowance = lines.find((l) => l.componentId === "id-allowance")!;
    expect(allowance.amount).toBeGreaterThanOrEqual(0);
  });

  it("refuses to build lines for a custom setup", () => {
    expect(() =>
      buildSalaryLines({ mode: { mode: "CUSTOM" }, monthlySalary: 1, componentIdByKey: ids }),
    ).toThrow();
  });

  it("names the missing component when the tenant set is incomplete", () => {
    expect(() =>
      buildSalaryLines({ mode: simpleMode(), monthlySalary: 1, componentIdByKey: new Map() }),
    ).toThrow(/monthly_salary/);
  });
});

describe("pack percents are clamped, never trusted", () => {
  it("keeps valid overrides", () => {
    expect(normalizePackPercents("basic_hra", { basic: 55, hra: 30 })).toEqual({
      basic: 55,
      hra: 30,
    });
  });

  it("falls back to defaults when a value is out of range or missing", () => {
    const defaults = { basic: 60, hra: 25 };
    expect(normalizePackPercents("basic_hra", { basic: 120, hra: 10 })).toEqual(defaults);
    expect(normalizePackPercents("basic_hra", { basic: -1, hra: 10 })).toEqual(defaults);
    expect(normalizePackPercents("basic_hra", { basic: 60 })).toEqual(defaults);
  });

  it("falls back when percents together exceed 100", () => {
    // The remainder line would go negative — the maths must never see it.
    expect(normalizePackPercents("basic_hra", { basic: 80, hra: 30 })).toEqual({
      basic: 60,
      hra: 25,
    });
  });
});

describe("packs are shapes, not statutory advice (D-P3-01)", () => {
  it("contains no statutory-looking component", () => {
    for (const pack of STARTER_PACKS) {
      for (const c of pack.components) {
        expect(c.key, `${pack.id}/${c.key}`).not.toMatch(
          /pf|provident|esi|professional_tax|ptax|tds|gratuity/,
        );
      }
    }
  });

  it("declares itself illustrative or trivially simple", () => {
    // Any pack with configurable percentages must say the split is
    // illustrative, in the description the owner actually reads.
    for (const pack of STARTER_PACKS) {
      const hasPercents = pack.components.some((c) => c.defaultPercent != null);
      if (hasPercents) {
        expect(pack.description.toLowerCase()).toContain("illustrative");
      }
    }
  });

  it("every percent component carries a default", () => {
    for (const pack of STARTER_PACKS) {
      for (const c of pack.components) {
        if (c.calculation === "PERCENT_OF_BASE") {
          expect(c.defaultPercent, `${pack.id}/${c.key}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("switching packs against real component states", () => {
  const sw = (
    key: string,
    opts: Partial<{
      kind: "EARNING" | "DEDUCTION";
      calculation: "FIXED" | "PERCENT_OF_BASE" | "PER_DAY";
      prorated: boolean;
      isActive: boolean;
      referenced: boolean;
      name: string;
    }> = {},
  ) => ({
    key,
    name: opts.name ?? key,
    kind: opts.kind ?? ("EARNING" as const),
    calculation: opts.calculation ?? ("FIXED" as const),
    prorated: opts.prorated ?? true,
    isActive: opts.isActive ?? true,
    referenced: opts.referenced ?? false,
  });

  it("adopts the referenced carrier and cleans the stray — the pilot's exact state", () => {
    // What four failed clicks left in production: the tenant's own
    // "salary" carrying a real structure, plus a monthly_salary the old
    // switch wrongly created. Choosing "single" must adopt the referenced
    // one and deactivate the stray, not create anything.
    const plan = planPackSwitch("single", [
      sw("salary", { referenced: true, name: "Salary" }),
      sw(MONTHLY_SALARY_KEY),
    ]);
    expect(plan).toEqual({
      ok: true,
      ensure: [{ ...STARTER_PACKS[0].components[0], key: "salary" }],
      deactivateKeys: [MONTHLY_SALARY_KEY],
    });
  });

  it("creates the default carrier for a fresh tenant", () => {
    const plan = planPackSwitch("single", []);
    expect(plan.ok && plan.ensure[0].key).toBe(MONTHLY_SALARY_KEY);
    expect(plan.ok && plan.deactivateKeys).toEqual([]);
  });

  it("refuses when a referenced non-carrier stands in the way, naming it", () => {
    const plan = planPackSwitch("single", [
      sw("salary", { referenced: true }),
      sw("pf", { kind: "DEDUCTION", referenced: true, name: "Provident fund" }),
    ]);
    expect(plan).toEqual({ ok: false, blocking: ["Provident fund"] });
  });

  it("refuses two referenced carriers — one number cannot be two", () => {
    const plan = planPackSwitch("single", [
      sw("salary", { referenced: true }),
      sw("stipend", { referenced: true }),
    ]);
    expect(plan.ok).toBe(false);
  });

  it("deactivates unreferenced non-pack components when moving to a pack", () => {
    const plan = planPackSwitch("basic_hra", [
      sw("salary", { referenced: true }), // carrier-shaped, tolerated
      sw("bonus"), // unreferenced stray → cleaned
    ]);
    expect(plan.ok && plan.deactivateKeys).toEqual(["bonus"]);
  });

  it("the plan's outcome actually resolves to the target mode", () => {
    // The property the old switch violated: apply the plan on paper, then
    // ask resolvePayMode — it must say SIMPLE, or the button lies.
    const components = [
      sw("salary", { referenced: true }),
      sw(MONTHLY_SALARY_KEY),
    ];
    const plan = planPackSwitch("single", components);
    if (!plan.ok) throw new Error("expected ok");
    const after = components
      .filter((c) => !plan.deactivateKeys.includes(c.key))
      .map(({ key, kind, calculation, prorated }) => ({ key, kind, calculation, prorated }));
    expect(resolvePayMode({ pack: "single" }, after).mode).toBe("SIMPLE");
  });
});

describe("recognising the simple shape in stored data", () => {
  const fixedEarning = { component: { kind: "EARNING" as const, calculation: "FIXED" as const } };

  it("matches one fixed earning, whatever the tenant called it", () => {
    // Judged by shape, not key — the pilot's own "Salary" component reads
    // correctly without any data migration.
    expect(isSimpleStructure([fixedEarning])).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isSimpleStructure([])).toBe(false);
    expect(
      isSimpleStructure([
        { component: { kind: "EARNING", calculation: "PERCENT_OF_BASE" } },
      ]),
    ).toBe(false);
    expect(
      isSimpleStructure([
        { component: { kind: "DEDUCTION", calculation: "FIXED" } },
      ]),
    ).toBe(false);
    expect(isSimpleStructure([fixedEarning, fixedEarning])).toBe(false);
  });
});

describe("pack lookup", () => {
  it("finds real packs and refuses custom", () => {
    expect(packById("single")?.label).toBe("Single amount");
    expect(packById("basic_hra")?.components).toHaveLength(3);
    expect(packById("custom")).toBeNull();
  });
});
