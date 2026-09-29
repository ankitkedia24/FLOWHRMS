import { describe, expect, it } from "vitest";
import {
  dependentModules,
  disableImpact,
  missingRequirements,
  type EnabledMap,
} from "@/lib/modules/impact";

const V1: EnabledMap = {
  EMPLOYEES: true,
  ATTENDANCE: true,
  LEAVE: true,
  PAYROLL: true,
  TASKS: true,
  DAILY_REPORTING: true,
};

describe("missingRequirements", () => {
  it("is empty when every dependency is on", () => {
    expect(missingRequirements(V1, "PAYROLL")).toEqual([]);
  });

  it("names the dependency that is off", () => {
    const map: EnabledMap = { ...V1, ATTENDANCE: false };
    expect(missingRequirements(map, "PAYROLL")).toEqual(["ATTENDANCE"]);
  });

  it("treats an any-of group as satisfied when one option is on", () => {
    const map: EnabledMap = { ATTENDANCE: true, TASKS: false };
    expect(missingRequirements(map, "PERFORMANCE")).toEqual([]);
  });

  it("reports both options when the whole any-of group is off", () => {
    const map: EnabledMap = { ATTENDANCE: false, TASKS: false };
    expect(missingRequirements(map, "PERFORMANCE").sort()).toEqual([
      "ATTENDANCE",
      "TASKS",
    ]);
  });

  it("CORE modules never count as missing", () => {
    expect(missingRequirements({}, "NOTIFICATIONS")).toEqual([]);
  });
});

describe("dependentModules", () => {
  it("finds enabled modules that would break", () => {
    expect(dependentModules(V1, "ATTENDANCE").sort()).toEqual([
      "PAYROLL",
      "PERFORMANCE",
    ].filter((m) => V1[m as keyof EnabledMap] === true));
  });

  it("Employee Management carries Payroll, Leave and Tasks", () => {
    const dependents = dependentModules(V1, "EMPLOYEES").sort();
    expect(dependents).toContain("PAYROLL");
    expect(dependents).toContain("LEAVE");
    expect(dependents).toContain("TASKS");
  });

  it("ignores modules that are already off", () => {
    const map: EnabledMap = { ...V1, PAYROLL: false };
    expect(dependentModules(map, "ATTENDANCE")).not.toContain("PAYROLL");
  });

  it("an any-of dependent survives while a sibling source is on", () => {
    const map: EnabledMap = { ATTENDANCE: true, TASKS: true, PERFORMANCE: true };
    // Turning off Attendance still leaves Tasks as a source.
    expect(dependentModules(map, "ATTENDANCE")).not.toContain("PERFORMANCE");
  });
});

describe("disableImpact", () => {
  const counts = { employees: 55, adminUsers: 6 };

  it("names the dependent modules in the consequence sentence", () => {
    const impact = disableImpact(V1, "ATTENDANCE", counts);
    expect(impact.sentence).toContain("Payroll");
    expect(impact.sentence).toContain("cannot work without Attendance");
  });

  it("lists what stops, including the employee count", () => {
    const impact = disableImpact(V1, "ATTENDANCE", counts);
    expect(impact.stops.some((s) => s.includes("55 employees"))).toBe(true);
    expect(impact.stops.some((s) => s.includes("daily summary"))).toBe(true);
  });

  it("always reassures that no data is deleted", () => {
    const impact = disableImpact(V1, "TASKS", counts);
    expect(impact.retention).toContain("No tasks data is deleted");
    expect(impact.retention).toContain("enable it again");
  });

  it("requires the module key as the typed confirmation", () => {
    expect(disableImpact(V1, "ATTENDANCE", counts).typedConfirm).toBe(
      "ATTENDANCE",
    );
  });

  it("still explains itself when nothing depends on the module", () => {
    const map: EnabledMap = { EMPLOYEES: true, DAILY_REPORTING: true };
    const impact = disableImpact(map, "DAILY_REPORTING", counts);
    expect(impact.dependents).toEqual([]);
    expect(impact.sentence).toContain("will be removed");
  });
});
