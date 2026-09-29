import { describe, expect, it } from "vitest";
import {
  DEFAULT_LATE_POLICY,
  calculatePayrollLine,
  daysInPeriod,
  formatRupees,
  roundRupees,
  runBlockers,
  runExclusions,
  unpaidDaysFor,
  type AttendanceSummary,
  type SalaryStructureInput,
} from "@/lib/payroll/engine";

const structure: SalaryStructureInput = {
  baseAmount: 20_000,
  components: [
    {
      key: "basic",
      name: "Basic",
      kind: "EARNING",
      calculation: "PERCENT_OF_BASE",
      isStatutory: false,
      prorated: true,
      amount: 0,
      percent: 60,
    },
    {
      key: "hra",
      name: "House rent allowance",
      kind: "EARNING",
      calculation: "PERCENT_OF_BASE",
      isStatutory: false,
      prorated: true,
      amount: 0,
      percent: 25,
    },
    {
      key: "conveyance",
      name: "Conveyance",
      kind: "EARNING",
      calculation: "FIXED",
      isStatutory: false,
      prorated: true,
      amount: 2_000,
      percent: 0,
    },
    {
      key: "pf",
      name: "Provident fund (defined by your accountant)",
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
  calendarDays: 31,
  presentDays: 31,
  paidLeaveDays: 0,
  unpaidLeaveDays: 0,
  absentDays: 0,
  lateDays: 0,
  lateMinutes: 0,
};

describe("rounding", () => {
  it("rounds half up to whole rupees", () => {
    expect(roundRupees(100.5)).toBe(101);
    expect(roundRupees(100.4)).toBe(100);
    expect(roundRupees(-100.5)).toBe(-101);
  });

  it("formats with Indian digit grouping", () => {
    expect(formatRupees(142_800)).toBe("₹1,42,800");
    expect(formatRupees(42_800)).toBe("₹42,800");
    expect(formatRupees(800)).toBe("₹800");
  });
});

describe("unpaid day derivation", () => {
  it("counts unpaid leave and absent days", () => {
    const result = unpaidDaysFor(
      { ...fullMonth, unpaidLeaveDays: 2, absentDays: 1 },
      DEFAULT_LATE_POLICY,
    );
    expect(result.unpaidDays).toBe(3);
  });

  it("converts repeated lateness by the tenant's policy", () => {
    const result = unpaidDaysFor(
      { ...fullMonth, lateDays: 7 },
      { latesPerDeductedDay: 3, deductAbsentDays: true },
    );
    expect(result.lateDeductionDays).toBe(2); // floor(7 / 3)
    expect(result.unpaidDays).toBe(2);
  });

  it("never deducts for lateness when the policy is off", () => {
    const result = unpaidDaysFor(
      { ...fullMonth, lateDays: 12 },
      { latesPerDeductedDay: 0, deductAbsentDays: true },
    );
    expect(result.lateDeductionDays).toBe(0);
  });

  it("ignores absent days when the policy says not to deduct", () => {
    const result = unpaidDaysFor(
      { ...fullMonth, absentDays: 4 },
      { latesPerDeductedDay: 3, deductAbsentDays: false },
    );
    expect(result.unpaidDays).toBe(0);
  });
});

describe("payslip calculation", () => {
  it("pays the full structure for a complete month", () => {
    const result = calculatePayrollLine({
      structure,
      attendance: fullMonth,
      policy: DEFAULT_LATE_POLICY,
    });
    // 12,000 basic + 5,000 HRA + 2,000 conveyance
    expect(result.gross).toBe(19_000);
    expect(result.deductionTotal).toBe(1_800);
    expect(result.net).toBe(17_200);
    expect(result.payableDays).toBe(31);
  });

  it("totals always reconcile to the sum of printed lines", () => {
    const result = calculatePayrollLine({
      structure,
      attendance: { ...fullMonth, unpaidLeaveDays: 3 },
      policy: DEFAULT_LATE_POLICY,
    });
    const earningsSum = result.earnings.reduce((s, l) => s + l.amount, 0);
    const deductionsSum = result.deductions.reduce((s, l) => s + l.amount, 0);
    expect(result.gross).toBe(earningsSum);
    expect(result.deductionTotal).toBe(deductionsSum);
    expect(result.net).toBe(
      result.gross - result.deductionTotal + result.adjustmentTotal,
    );
  });

  it("pro-rates earnings for unpaid days", () => {
    const result = calculatePayrollLine({
      structure,
      attendance: { ...fullMonth, unpaidLeaveDays: 3 },
      policy: DEFAULT_LATE_POLICY,
    });
    expect(result.unpaidDays).toBe(3);
    expect(result.payableDays).toBe(28);
    expect(result.gross).toBeLessThan(19_000);
    // 19,000 × 28/31 ≈ 17,161
    expect(result.gross).toBeGreaterThan(17_000);
  });

  it("does not pro-rate a component marked not prorated", () => {
    const result = calculatePayrollLine({
      structure,
      attendance: { ...fullMonth, unpaidLeaveDays: 10 },
      policy: DEFAULT_LATE_POLICY,
    });
    const pf = result.deductions.find((d) => d.key === "pf")!;
    expect(pf.amount).toBe(1_800); // unchanged by unpaid days
  });

  it("explains every figure with a basis line", () => {
    const result = calculatePayrollLine({
      structure,
      attendance: { ...fullMonth, unpaidLeaveDays: 2 },
      policy: DEFAULT_LATE_POLICY,
    });
    for (const line of [...result.earnings, ...result.deductions]) {
      expect(line.basis.length).toBeGreaterThan(0);
    }
    expect(result.earnings[0].basis).toContain("60% of base");
    expect(result.earnings[0].basis).toContain("pro-rated");
  });

  it("marks accountant-defined components as statutory", () => {
    const result = calculatePayrollLine({
      structure,
      attendance: fullMonth,
      policy: DEFAULT_LATE_POLICY,
    });
    expect(result.deductions.find((d) => d.key === "pf")?.isStatutory).toBe(true);
    expect(result.earnings.every((e) => !e.isStatutory)).toBe(true);
  });

  it("applies signed adjustments to net pay only", () => {
    const result = calculatePayrollLine({
      structure,
      attendance: fullMonth,
      policy: DEFAULT_LATE_POLICY,
      adjustments: [
        { label: "Incentive", amount: 1_500 },
        { label: "Advance recovery", amount: -500 },
      ],
    });
    expect(result.adjustmentTotal).toBe(1_000);
    expect(result.gross).toBe(19_000); // gross untouched
    expect(result.net).toBe(18_200);
  });

  it("PER_DAY components are not double pro-rated", () => {
    const perDay: SalaryStructureInput = {
      baseAmount: 0,
      components: [
        {
          key: "daily",
          name: "Daily wage",
          kind: "EARNING",
          calculation: "PER_DAY",
          isStatutory: false,
          prorated: true,
          amount: 500,
          percent: 0,
        },
      ],
    };
    const result = calculatePayrollLine({
      structure: perDay,
      attendance: { ...fullMonth, unpaidLeaveDays: 1 },
      policy: DEFAULT_LATE_POLICY,
    });
    expect(result.payableDays).toBe(30);
    expect(result.gross).toBe(15_000); // 500 × 30, not 500 × 30 × 30/31
  });

  it("never produces a payable day count below zero", () => {
    const result = calculatePayrollLine({
      structure,
      attendance: { ...fullMonth, unpaidLeaveDays: 40 },
      policy: DEFAULT_LATE_POLICY,
    });
    expect(result.payableDays).toBe(0);
    expect(result.gross).toBe(0);
  });
});

describe("run gates", () => {
  it("blocks approval when a line has negative net pay", () => {
    const blockers = runBlockers([
      { name: "Ravi Kumar", status: "READY", net: -200 },
      { name: "Meena Joshi", status: "READY", net: 15_000 },
    ]);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].membershipName).toBe("Ravi Kumar");
    expect(blockers[0].reason).toContain("negative");
  });

  it("names employees excluded for having no salary structure", () => {
    const excluded = runExclusions([
      { name: "Vikas Sharma", status: "NO_SALARY_STRUCTURE" },
      { name: "Meena Joshi", status: "READY" },
    ]);
    expect(excluded).toEqual(["Vikas Sharma"]);
  });
});

describe("period helpers", () => {
  it("counts days in the payroll month", () => {
    expect(daysInPeriod(new Date("2026-08-01T00:00:00.000Z"))).toBe(31);
    expect(daysInPeriod(new Date("2026-02-01T00:00:00.000Z"))).toBe(28);
    expect(daysInPeriod(new Date("2024-02-01T00:00:00.000Z"))).toBe(29);
  });
});
