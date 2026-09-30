import { describe, expect, it } from "vitest";
import {
  DEFAULT_LATE_POLICY,
  calculatePayrollLine,
  runBlockers,
  type AttendanceSummary,
  type SalaryStructureInput,
} from "@/lib/payroll/engine";
import {
  LEFT_THE_RUN_REASON,
  compareRunLines,
  lineFigures,
  planLineWrites,
  storedLineFigures,
  type LineFigures,
} from "@/lib/payroll/lines";

/**
 * Hardening batch 4.2 / 4.3 — what Calculate stores, which stale lines it
 * removes, and the approval check that the stored lines (what payslips
 * read) still match a fresh calculation.
 */

const structure: SalaryStructureInput = {
  baseAmount: 30_000,
  components: [
    {
      key: "basic",
      name: "Basic",
      kind: "EARNING",
      calculation: "FIXED",
      isStatutory: false,
      prorated: true,
      amount: 30_000,
      percent: 0,
    },
    {
      key: "pf",
      name: "Provident fund",
      kind: "DEDUCTION",
      calculation: "FIXED",
      isStatutory: true,
      prorated: false,
      amount: 1_800,
      percent: 0,
    },
  ],
};

const fullMonth: AttendanceSummary = {
  calendarDays: 30,
  workingDays: 26,
  weeklyOffDays: 4,
  holidayDays: 0,
  presentDays: 26,
  paidLeaveDays: 0,
  unpaidLeaveDays: 0,
  absentDays: 0,
  lateDays: 0,
  lateMinutes: 0,
};

function ready(membershipId: string, attendance = fullMonth, adjustments: Array<{ label: string; amount: number }> = []) {
  const result = calculatePayrollLine({ structure, attendance, policy: DEFAULT_LATE_POLICY, adjustments });
  return lineFigures({ membershipId, status: "READY", statusReason: null, result }, 30);
}

const noStructure = (membershipId: string) =>
  lineFigures({ membershipId, status: "NO_SALARY_STRUCTURE", statusReason: "No salary structure", result: null }, 30);

/** How the database hands a stored line back: Decimals as strings-ish objects. */
function asStoredRow(line: LineFigures) {
  const dec = (n: number) => ({ toString: () => n.toFixed(2) });
  return storedLineFigures({
    ...line,
    presentDays: dec(line.presentDays),
    paidLeaveDays: dec(line.paidLeaveDays),
    unpaidDays: dec(line.unpaidDays),
    payableDays: dec(line.payableDays),
    lateDeductionDays: dec(line.lateDeductionDays),
    earnings: JSON.parse(JSON.stringify(line.earnings)),
    deductions: JSON.parse(JSON.stringify(line.deductions)),
    gross: dec(line.gross),
    deductionTotal: dec(line.deductionTotal),
    adjustmentTotal: dec(line.adjustmentTotal),
    net: dec(line.net),
  });
}

describe("lineFigures — what Calculate stores", () => {
  it("stores a calculated line's days, pay items and totals", () => {
    const line = ready("m1");
    expect(line.gross).toBe(30_000);
    expect(line.deductionTotal).toBe(1_800);
    expect(line.net).toBe(28_200);
    expect(line.earnings.map((e) => e.key)).toEqual(["basic"]);
    expect(line.deductions.map((e) => e.key)).toEqual(["pf"]);
  });

  it("stores an excluded line as zeros with no pay items — never an older calculation's", () => {
    const line = noStructure("m2");
    expect(line).toMatchObject({ status: "NO_SALARY_STRUCTURE", calendarDays: 30, gross: 0, net: 0 });
    expect(line.earnings).toEqual([]);
    expect(line.deductions).toEqual([]);
  });
});

describe("planLineWrites — stale lines", () => {
  it("removes the line of someone no longer in the preview", () => {
    const plan = planLineWrites(
      [ready("m1")],
      [
        { id: "line-1", membershipId: "m1", adjustmentCount: 0 },
        { id: "line-2", membershipId: "gone", adjustmentCount: 0 },
      ],
      30,
    );
    expect(plan.remove).toEqual(["line-2"]);
    expect(plan.write.map((l) => l.membershipId)).toEqual(["m1"]);
  });

  it("keeps, zeroed and left out, a stale line that carries adjustments — deleting it would delete them", () => {
    const plan = planLineWrites([ready("m1")], [{ id: "line-2", membershipId: "left", adjustmentCount: 2 }], 30);
    expect(plan.remove).toEqual([]);
    const kept = plan.write.find((l) => l.membershipId === "left");
    expect(kept).toMatchObject({
      status: "NO_SALARY_STRUCTURE",
      statusReason: LEFT_THE_RUN_REASON,
      gross: 0,
      deductionTotal: 0,
      adjustmentTotal: 0,
      net: 0,
    });
  });

  it("writes new people and leaves nothing to remove on a first calculation", () => {
    const plan = planLineWrites([ready("m1"), noStructure("m2")], [], 30);
    expect(plan.remove).toEqual([]);
    expect(plan.write).toHaveLength(2);
  });
});

describe("compareRunLines — approve only what payslips will show", () => {
  const stored = [ready("m1"), ready("m2"), noStructure("m3")];

  it("finds nothing when a fresh calculation matches the stored lines", () => {
    const planned = [ready("m1"), ready("m2"), noStructure("m3")];
    expect(compareRunLines(stored.map(asStoredRow), planned)).toEqual([]);
  });

  it("ignores wording: status reasons and pay-item names and bases", () => {
    const planned = [ready("m1"), ready("m2"), noStructure("m3")].map((l) => ({
      ...l,
      statusReason: "Worded differently",
      earnings: l.earnings.map((e) => ({ ...e, name: "Renamed", basis: "Other words" })),
    }));
    expect(compareRunLines(stored, planned)).toEqual([]);
  });

  it("reports a changed net, naming the figures that moved", () => {
    const absentTwoDays = { ...fullMonth, presentDays: 24, absentDays: 2 };
    const planned = [ready("m1", absentTwoDays), ready("m2"), noStructure("m3")];
    const diff = compareRunLines(stored, planned);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ membershipId: "m1", change: "CHANGED" });
    expect(diff[0].fields).toEqual(
      expect.arrayContaining(["presentDays", "unpaidDays", "payableDays", "gross", "net", "earnings"]),
    );
  });

  it("reports an adjustment the stored line does not carry", () => {
    const planned = [ready("m1", fullMonth, [{ label: "Bonus", amount: 500 }]), ready("m2"), noStructure("m3")];
    const diff = compareRunLines(stored, planned);
    expect(diff).toEqual([{ membershipId: "m1", change: "CHANGED", fields: ["adjustmentTotal", "net"] }]);
  });

  it("reports days that changed even when the money did not", () => {
    const planned = [{ ...ready("m1"), presentDays: 25 }, ready("m2"), noStructure("m3")];
    expect(compareRunLines(stored, planned)).toEqual([
      { membershipId: "m1", change: "CHANGED", fields: ["presentDays"] },
    ]);
  });

  it("reports a pay item added, dropped or re-amounted", () => {
    const [m1] = stored;
    const dropped = { ...m1, deductions: [] };
    const reamounted = { ...m1, earnings: m1.earnings.map((e) => ({ ...e, fullAmount: e.fullAmount + 1 })) };
    expect(compareRunLines([m1], [dropped])[0].fields).toEqual(["deductions"]);
    expect(compareRunLines([m1], [reamounted])[0].fields).toEqual(["earnings"]);
  });

  it("reports a status change — someone moving in or out of the paid set", () => {
    const planned = [ready("m1"), ready("m2"), ready("m3")];
    const diff = compareRunLines(stored, planned);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ membershipId: "m3", change: "CHANGED" });
    expect(diff[0].fields[0]).toBe("status");
  });

  it("reports someone who joined since the calculation", () => {
    const planned = [ready("m1"), ready("m2"), noStructure("m3"), ready("m4")];
    expect(compareRunLines(stored, planned)).toEqual([{ membershipId: "m4", change: "ADDED", fields: [] }]);
  });

  it("reports someone who left since the calculation", () => {
    const planned = [ready("m1"), noStructure("m3")];
    expect(compareRunLines(stored, planned)).toEqual([{ membershipId: "m2", change: "REMOVED", fields: [] }]);
  });

  it("matches a stale line already kept by the last calculation (left, with adjustments)", () => {
    const plan = planLineWrites([ready("m1")], [
      { id: "l1", membershipId: "m1", adjustmentCount: 0 },
      { id: "l9", membershipId: "left", adjustmentCount: 1 },
    ], 30);
    const storedNow = plan.write.map(asStoredRow);
    const again = planLineWrites([ready("m1")], [
      { id: "l1", membershipId: "m1", adjustmentCount: 0 },
      { id: "l9", membershipId: "left", adjustmentCount: 1 },
    ], 30);
    expect(compareRunLines(storedNow, again.write)).toEqual([]);
  });

  it("compares at the stored precision of two decimals", () => {
    const planned = [{ ...ready("m1"), presentDays: 25.999 }, ready("m2"), noStructure("m3")];
    const s = [{ ...ready("m1"), presentDays: 26 }, ready("m2"), noStructure("m3")];
    expect(compareRunLines(s, planned)).toEqual([]);
  });
});

describe("runBlockers — negative net pay", () => {
  it("blocks a line the preview marked BLOCKED, as the screen does", () => {
    const blockers = runBlockers([
      { name: "Ravi Kumar", status: "BLOCKED", net: -200 },
      { name: "Meena Joshi", status: "READY", net: 15_000 },
      { name: "Vikas Sharma", status: "NO_SALARY_STRUCTURE", net: 0 },
    ]);
    expect(blockers.map((b) => b.membershipName)).toEqual(["Ravi Kumar"]);
  });
});
