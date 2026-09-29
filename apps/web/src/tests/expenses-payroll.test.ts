import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_LABEL_MAX,
  ADJUSTMENT_REASON_MAX,
  adjustmentLabel,
  adjustmentReason,
  monthLabel,
  offeredRoutes,
  payrollRoundingNote,
  seamFailureMessage,
  settlementMonth,
} from "@/lib/expenses/payroll-settlement";
import { payrollSettlementAmount } from "@/lib/expenses/settle-payroll";

const IST = "Asia/Kolkata";
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("settlement month (§13 rule 2)", () => {
  it("is the calendar month of the decision in the tenant’s timezone, as a UTC first-of-month", () => {
    expect(iso(settlementMonth(new Date("2026-09-15T10:00:00.000Z"), IST))).toBe("2026-09-01");
    expect(iso(settlementMonth(new Date("2026-09-01T00:00:00.000Z"), IST))).toBe("2026-09-01");
  });

  it("crosses the month boundary by local time, not UTC", () => {
    // 20:00 UTC on 30 Sept is 01:30 IST on 1 Oct.
    expect(iso(settlementMonth(new Date("2026-09-30T20:00:00.000Z"), IST))).toBe("2026-10-01");
    expect(iso(settlementMonth(new Date("2026-09-30T20:00:00.000Z"), "UTC"))).toBe("2026-09-01");
    // 19:00 UTC on 31 Dec is 00:30 IST on 1 Jan — the year rolls too.
    expect(iso(settlementMonth(new Date("2026-12-31T19:00:00.000Z"), IST))).toBe("2027-01-01");
  });

  it("labels the month in words", () => {
    expect(monthLabel(new Date("2026-09-01T00:00:00.000Z"))).toBe("September 2026");
  });
});

describe("routes offered (§12)", () => {
  it("is OUTSIDE only when Payroll is off, whatever the preference says", () => {
    expect(offeredRoutes({ payrollOn: false, defaultRoute: "PAYROLL" })).toEqual({
      routes: ["OUTSIDE"],
      preselected: "OUTSIDE",
    });
  });

  it("offers both when Payroll is on, preselecting the tenant’s preference", () => {
    expect(offeredRoutes({ payrollOn: true, defaultRoute: "PAYROLL" }).preselected).toBe("PAYROLL");
    expect(offeredRoutes({ payrollOn: true, defaultRoute: "OUTSIDE" }).preselected).toBe("OUTSIDE");
    expect(offeredRoutes({ payrollOn: true, defaultRoute: "OUTSIDE" }).routes).toEqual(["PAYROLL", "OUTSIDE"]);
  });
});

describe("whole rupees at the seam (owner decision, §13 rule 5)", () => {
  it("rounds half-up with Payroll’s own rule, so payslip and settlement agree", () => {
    expect(payrollSettlementAmount(1240.5)).toBe(1241);
    expect(payrollSettlementAmount(1240.49)).toBe(1240);
    expect(payrollSettlementAmount(0.5)).toBe(1);
    expect(payrollSettlementAmount(250)).toBe(250);
  });

  it("says so only when rounding changed the figure", () => {
    expect(payrollRoundingNote(250, 250)).toBeNull();
    expect(payrollRoundingNote(1240.5, 1241)).toContain("₹1,240.50");
    expect(payrollRoundingNote(1240.5, 1241)).toContain("₹1,241.00");
    expect(payrollRoundingNote(1240.5, 1241)).toContain("whole rupees");
  });
});

describe("payslip traceability (§13 rules 5 and 7)", () => {
  it("the label and reason both carry the claim reference, within Payroll’s limits", () => {
    const label = adjustmentLabel("Fuel", "EXP-000042");
    expect(label).toBe("Expense · Fuel · EXP-000042");
    expect(label.length).toBeLessThanOrEqual(ADJUSTMENT_LABEL_MAX);
    const reason = adjustmentReason("EXP-000042", "4 Sept 2026", "Sunita Rao");
    expect(reason).toBe("Expense claim EXP-000042, approved 4 Sept 2026 by Sunita Rao");
    expect(reason.length).toBeLessThanOrEqual(ADJUSTMENT_REASON_MAX);
  });

  it("never exceeds the limits, even with an absurd category name", () => {
    expect(adjustmentLabel("x".repeat(500), "EXP-000001").length).toBe(ADJUSTMENT_LABEL_MAX);
  });
});

describe("refusals name the way out (§13 rules 1, 3, 4)", () => {
  it("each typed refusal is a plain sentence with the alternative", () => {
    expect(seamFailureMessage("PAYROLL_UNAVAILABLE", {})).toContain("outside payroll");
    const open = seamFailureMessage("NO_OPEN_RUN", { monthLabel: "September 2026", earliestLockedLabel: null });
    expect(open).toContain("September 2026");
    expect(open).toContain("Calculate");
    const locked = seamFailureMessage("NO_OPEN_RUN", { monthLabel: "September 2026", earliestLockedLabel: "September 2026" });
    expect(locked).toContain("approved and locked");
    const line = seamFailureMessage("NO_LINE_FOR_PERSON", { monthLabel: "September 2026", personName: "Rajesh Kulkarni" });
    expect(line).toContain("Rajesh Kulkarni");
    expect(line).toContain("not on the September 2026 payroll run");
  });
});

describe("the Payroll boundary (§15)", () => {
  it("only settle-payroll.ts imports from @/lib/payroll", () => {
    const dir = join(process.cwd(), "src", "lib", "expenses");
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
      .filter((f) => /from\s+["']@\/lib\/payroll/.test(readFileSync(join(dir, f), "utf8")))
      .filter((f) => f !== "settle-payroll.ts");
    expect(offenders).toEqual([]);
  });

  it("the seam itself does import Payroll — the boundary is a door, not a wall", () => {
    const src = readFileSync(join(process.cwd(), "src", "lib", "expenses", "settle-payroll.ts"), "utf8");
    expect(src).toMatch(/from "@\/lib\/payroll\/adjustments"/);
    expect(src).toMatch(/from "@\/lib\/payroll\/engine"/);
  });
});
