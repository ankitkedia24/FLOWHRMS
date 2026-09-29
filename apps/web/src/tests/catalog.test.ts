import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSION_KEYS,
  FEATURES,
  MODULES,
  MODULE_DEPENDENCIES,
  PERMISSIONS,
  ROLE_TEMPLATES,
} from "@/lib/catalog";

describe("platform catalog integrity", () => {
  it("module dependencies match MODULES.md", () => {
    const dep = (m: string) =>
      MODULE_DEPENDENCIES.filter((d) => d.module === m).map((d) => d.requires);
    expect(dep("PAYROLL").sort()).toEqual(["ATTENDANCE", "EMPLOYEES"]);
    expect(dep("LEAVE")).toEqual(["EMPLOYEES"]);
    expect(dep("TASKS")).toEqual(["EMPLOYEES"]);
    // Performance requires Attendance OR Tasks (anyOf group).
    const perf = MODULE_DEPENDENCIES.filter((d) => d.module === "PERFORMANCE");
    expect(perf.every((d) => d.anyOfGroup === "perf-source")).toBe(true);
  });

  it("every feature belongs to a declared module", () => {
    for (const feature of FEATURES) {
      expect(MODULES[feature.module]).toBeDefined();
    }
  });

  it("role templates only reference declared permissions", () => {
    for (const role of ROLE_TEMPLATES) {
      for (const perm of role.permissions) {
        expect(ALL_PERMISSION_KEYS).toContain(perm);
      }
    }
  });

  it("USER-ROLES.md sensitive set is marked sensitive", () => {
    const sensitive = PERMISSIONS.filter((p) => p.isSensitive).map((p) => p.key);
    for (const key of [
      "payroll.view",
      "payroll.edit",
      "payroll.approve",
      "bank.view",
      "bank.edit",
      "documents.download",
      "location.view",
      "attendance.override",
      "reports.export",
      "audit.view",
    ]) {
      expect(sensitive).toContain(key);
    }
  });

  it("Manager template has no payroll or bank access by default", () => {
    const manager = ROLE_TEMPLATES.find((r) => r.key === "MANAGER")!;
    const banned = manager.permissions.filter(
      (p) => p.startsWith("payroll.") || p.startsWith("bank."),
    );
    expect(banned).toEqual([]);
  });

  it("Employee template carries no admin permissions", () => {
    const employee = ROLE_TEMPLATES.find((r) => r.key === "EMPLOYEE")!;
    expect(employee.permissions).toEqual([]);
  });
});
