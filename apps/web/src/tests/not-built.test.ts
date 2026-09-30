import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSION_KEYS,
  FEATURES,
  GRANTABLE_PERMISSIONS,
  isFeatureBuilt,
  isPermissionBuilt,
  ROLE_TEMPLATES,
  switchableFeatures,
} from "@/lib/catalog";
import { matrixRequest, mergePermissions } from "@/lib/roles/policy";

/**
 * Switches that do nothing and permissions nothing checks (hardening
 * batch 5). Each key below was confirmed unread by grep across
 * apps/web/src; when one gets built, drop its `built: false` and this list.
 */
const UNBUILT_FEATURES = [
  "ATTENDANCE.gps_capture",
  "ATTENDANCE.outside_area_approval",
  "ATTENDANCE.offline_capture",
  "ATTENDANCE.missed_punch_correction",
  "ATTENDANCE.late_penalty",
  "ATTENDANCE.late_exemption",
  "PAYROLL.overtime",
  "PAYROLL.advances",
  "PAYROLL.loans",
  "PAYROLL.incentives",
  "PAYROLL.bonus",
  "PAYROLL.payslip_delivery",
  "TASKS.multiple_assignees",
  "TASKS.recurring_tasks",
  "TASKS.proof_video",
  "TASKS.gps_proof",
  "TASKS.daily_report",
];

const UNBUILT_PERMISSIONS = [
  "attendance.override",
  "bank.edit",
  "location.view",
  "tasks.reassign",
];

describe("feature switches nothing reads", () => {
  it("are exactly the confirmed-unread ones", () => {
    const unbuilt = FEATURES.filter((f) => !isFeatureBuilt(f.module, f.key)).map(
      (f) => `${f.module}.${f.key}`,
    );
    expect(unbuilt.sort()).toEqual([...UNBUILT_FEATURES].sort());
  });

  it("keep their keys in the catalog", () => {
    const keys = FEATURES.map((f) => `${f.module}.${f.key}`);
    for (const key of UNBUILT_FEATURES) expect(keys).toContain(key);
  });

  it("are never offered as a switch", () => {
    const offered = (["ATTENDANCE", "PAYROLL", "TASKS"] as const).flatMap((m) =>
      switchableFeatures(m).map((f) => `${f.module}.${f.key}`),
    );
    for (const key of UNBUILT_FEATURES) expect(offered).not.toContain(key);
    // The ones something does read are still there.
    expect(offered).toEqual(
      expect.arrayContaining([
        "ATTENDANCE.geofence",
        "ATTENDANCE.any_branch_check_in",
        "ATTENDANCE.multiple_punch",
        "TASKS.proof_photo",
        "TASKS.proof_file",
      ]),
    );
    expect(switchableFeatures("PAYROLL")).toEqual([]);
  });

  it("an unknown key is not built either", () => {
    expect(isFeatureBuilt("ATTENDANCE", "teleport")).toBe(false);
    expect(isFeatureBuilt("TASKS", "geofence")).toBe(false);
  });
});

describe("permissions nothing checks", () => {
  it("are left off the access-level matrix", () => {
    const offered = GRANTABLE_PERMISSIONS.map((p) => p.key);
    for (const key of UNBUILT_PERMISSIONS) {
      expect(isPermissionBuilt(key)).toBe(false);
      expect(offered).not.toContain(key);
    }
    expect(offered.length).toBe(ALL_PERMISSION_KEYS.length - UNBUILT_PERMISSIONS.length);
  });

  it("stay in the catalog and on the role templates that carry them", () => {
    for (const key of UNBUILT_PERMISSIONS) expect(ALL_PERMISSION_KEYS).toContain(key);
    const superAdmin = ROLE_TEMPLATES.find((r) => r.key === "SUPER_ADMIN")!;
    expect(superAdmin.permissions).toContain("attendance.override");
    expect(superAdmin.permissions).toContain("tasks.reassign");
  });

  it("a save keeps the ones a role holds, whatever the request says", () => {
    const current = ["attendance.override", "employees.view", "tasks.reassign"];
    const requested = matrixRequest({ current, requested: ["employees.view"] });
    const owner = new Set<string>(ALL_PERMISSION_KEYS);
    expect(mergePermissions({ current, requested, mine: owner })).toEqual(current);
  });

  it("a save cannot add one the role doesn't hold", () => {
    const requested = matrixRequest({
      current: ["employees.view"],
      requested: ["employees.view", "location.view", "bank.edit", "leave.approve"],
    });
    expect(requested.sort()).toEqual(["employees.view", "leave.approve"]);
  });

  it("drops keys the catalog doesn't know", () => {
    expect(matrixRequest({ current: ["made.up"], requested: ["also.made.up"] })).toEqual([]);
  });
});
