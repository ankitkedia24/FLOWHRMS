import { describe, expect, it } from "vitest";
import {
  countDays,
  formatDateRange,
  leaveApprovalImpact,
  leaveDays,
  leaveRequestConsequence,
  overlaps,
  payrollMonthLabel,
} from "@/lib/leave/policy";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("leave day counting", () => {
  it("counts a single day as one", () => {
    expect(countDays(d("2026-08-12"), d("2026-08-12"))).toBe(1);
  });

  it("counts both ends of a range", () => {
    expect(countDays(d("2026-08-12"), d("2026-08-14"))).toBe(3);
  });

  it("treats a half day as 0.5 regardless of dates", () => {
    expect(
      leaveDays({ type: "HALF_DAY", start: d("2026-08-12"), end: d("2026-08-12") }),
    ).toBe(0.5);
  });

  it("counts full-day ranges", () => {
    expect(
      leaveDays({ type: "FULL_DAY", start: d("2026-08-12"), end: d("2026-08-13") }),
    ).toBe(2);
  });
});

describe("consequence and impact wording", () => {
  it("states unpaid days and the payroll month before sending", () => {
    const consequence = leaveRequestConsequence({ days: 2, monthLabel: "August" });
    expect(consequence.sentence).toBe(
      "2 unpaid days will be applied to August payroll.",
    );
    expect(consequence.detail).toBe(
      "Your manager can change this before payroll is approved.",
    );
    expect(consequence.requiresReason).toBe(true);
  });

  it("uses the singular for one day", () => {
    expect(leaveRequestConsequence({ days: 1, monthLabel: "August" }).sentence).toBe(
      "1 unpaid day will be applied to August payroll.",
    );
  });

  it("computes the approver impact line with the person's name", () => {
    expect(
      leaveApprovalImpact({
        days: 2,
        monthLabel: "August",
        name: "Ravi Kumar",
        paid: false,
      }),
    ).toBe("Approving applies 2 unpaid days to August payroll for Ravi Kumar.");
  });

  it("states no deduction when approving as paid", () => {
    const impact = leaveApprovalImpact({
      days: 2,
      monthLabel: "August",
      name: "Ravi Kumar",
      paid: true,
    });
    expect(impact).toContain("no deduction");
    expect(impact).toContain("reason is recorded");
  });
});

describe("overlap detection", () => {
  const existing = { start: d("2026-08-12"), end: d("2026-08-14") };

  it("detects an exact clash", () => {
    expect(overlaps({ start: d("2026-08-12"), end: d("2026-08-12") }, existing)).toBe(
      true,
    );
  });

  it("detects a partial overlap at either end", () => {
    expect(overlaps({ start: d("2026-08-10"), end: d("2026-08-12") }, existing)).toBe(
      true,
    );
    expect(overlaps({ start: d("2026-08-14"), end: d("2026-08-16") }, existing)).toBe(
      true,
    );
  });

  it("allows adjacent ranges that do not touch", () => {
    expect(overlaps({ start: d("2026-08-15"), end: d("2026-08-16") }, existing)).toBe(
      false,
    );
    expect(overlaps({ start: d("2026-08-09"), end: d("2026-08-11") }, existing)).toBe(
      false,
    );
  });
});

describe("date formatting", () => {
  it("names the payroll month in the tenant timezone", () => {
    expect(payrollMonthLabel(d("2026-08-12"), "Asia/Kolkata")).toBe("August");
  });

  it("formats a single day", () => {
    expect(formatDateRange(d("2026-08-12"), d("2026-08-12"), "Asia/Kolkata")).toBe(
      "12 August 2026",
    );
  });

  it("compresses a same-month range", () => {
    expect(formatDateRange(d("2026-08-12"), d("2026-08-13"), "Asia/Kolkata")).toBe(
      "12–13 August 2026",
    );
  });

  it("writes both months for a cross-month range", () => {
    expect(formatDateRange(d("2026-08-30"), d("2026-09-02"), "Asia/Kolkata")).toBe(
      "30 August 2026 – 2 September 2026",
    );
  });
});
