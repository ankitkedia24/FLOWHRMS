import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSION_KEYS,
  FEATURES,
  GRANTABLE_PERMISSIONS,
  isFeatureBuilt,
  isModuleBuilt,
  isPermissionBuilt,
  MODULES,
  ROLE_TEMPLATES,
  switchableFeatures,
  type ModuleKey,
} from "@/lib/catalog";
import { applyPlanModules, planModuleProblems } from "@/lib/billing/plan-modules";
import { normaliseTrialSettings } from "@/lib/platform/trial-defaults";
import { matrixRequest, mergePermissions } from "@/lib/roles/policy";
import { STATUS } from "@/lib/status";

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
  // Hardening batch 7: read only to paint a status, never to send. notify()
  // writes in-app notices and nothing else (lib/notifications/index.ts).
  "NOTIFICATIONS.push",
  "NOTIFICATIONS.email",
  "NOTIFICATIONS.whatsapp",
  "NOTIFICATIONS.sms",
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
    const offered = (["ATTENDANCE", "PAYROLL", "TASKS", "NOTIFICATIONS"] as const).flatMap(
      (m) => switchableFeatures(m).map((f) => `${f.module}.${f.key}`),
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
    // Notifications keeps no switches: in-app is always on, and nothing
    // else sends. Performance's switches are read, and stay.
    expect(switchableFeatures("NOTIFICATIONS")).toEqual([]);
    expect(switchableFeatures("PERFORMANCE").map((f) => f.key)).toEqual([
      "leaderboard",
      "rewards",
    ]);
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

describe("modules with nothing behind them", () => {
  const UNBUILT = ["ANNOUNCEMENTS", "APPROVALS", "ASSETS", "GPS_TRACKING"];

  it("are exactly the four placeholders; Field visits and Expenses are built", () => {
    const unbuilt = (Object.keys(MODULES) as ModuleKey[]).filter((k) => !isModuleBuilt(k));
    expect(unbuilt.sort()).toEqual(UNBUILT);
    expect(isModuleBuilt("FIELD_VISITS")).toBe(true);
    expect(isModuleBuilt("EXPENSES")).toBe(true);
  });

  it("an unknown key is not built, including inherited names", () => {
    expect(isModuleBuilt("WIDGETS")).toBe(false);
    expect(isModuleBuilt("toString")).toBe(false);
  });

  it("read as Not built yet", () => {
    expect(STATUS.notBuilt.label).toBe("Not built yet");
  });

  it("can't be put in a plan", () => {
    expect(planModuleProblems(["EMPLOYEES", "ASSETS"])).toEqual(["Assets isn't built yet"]);
    expect(planModuleProblems(["APPROVALS", "GPS_TRACKING"])).toEqual([
      "Approvals, GPS Tracking aren't built yet",
    ]);
    expect(planModuleProblems(["EMPLOYEES", "EXPENSES", "FIELD_VISITS", "ATTENDANCE"])).toEqual([]);
  });

  const settings = (on: string[], allowed: string[] = on) =>
    (Object.keys(MODULES) as ModuleKey[]).map((key) => ({
      key,
      enabled: on.includes(key),
      allowedByPlatform: allowed.includes(key),
    }));

  it("are never switched on by a plan that still lists them", () => {
    const changes = applyPlanModules(settings(["EMPLOYEES"]), ["EMPLOYEES", "ASSETS", "ANNOUNCEMENTS"]);
    expect(changes.find((c) => c.key === "ASSETS")).toBeUndefined();
    expect(changes.find((c) => c.key === "ANNOUNCEMENTS")).toBeUndefined();
  });

  it("stay as they are when a company already has one on (Group G)", () => {
    const current = settings(["EMPLOYEES", "ASSETS", "APPROVALS"]);
    const changes = applyPlanModules(current, ["EMPLOYEES", "ASSETS"]);
    expect(changes.find((c) => c.key === "ASSETS")).toBeUndefined();
    expect(changes.find((c) => c.key === "APPROVALS")).toBeUndefined();
  });

  it("are dropped from the free-trial package", () => {
    const s = normaliseTrialSettings({ days: 30, modules: ["ATTENDANCE", "GPS_TRACKING", "ASSETS"] });
    expect(s.modules).toContain("ATTENDANCE");
    expect(s.modules).not.toContain("GPS_TRACKING");
    expect(s.modules).not.toContain("ASSETS");
  });
});
