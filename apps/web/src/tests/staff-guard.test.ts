import { describe, expect, it } from "vitest";
import { LAST_OWNER_MESSAGE, createsReportingLoop, statusChangeRefusal } from "@/lib/employees/guard";
import { mergePermissions, roleEditRefusal } from "@/lib/roles/policy";

const person = (roleKey: string, status = "ACTIVE", userId = "target") => ({ userId, roleKey, status, name: "Asha" });
const actor = (roleKey: string, userId = "me") => ({ userId, roleKey });

describe("who may change someone's status", () => {
  it("refuses HR suspending or removing an Owner or a Super Admin", () => {
    for (const target of ["OWNER", "SUPER_ADMIN", "ADMIN"]) {
      for (const next of ["SUSPENDED", "DEACTIVATED"]) {
        expect(
          statusChangeRefusal({ actor: actor("HR"), person: person(target), nextStatus: next, otherActiveOwners: 3 }),
        ).toMatch(/more access than you/);
      }
    }
  });

  it("lets HR change people at or below their own level", () => {
    for (const target of ["HR", "MANAGER", "TEAM_LEADER", "EMPLOYEE", "VIEWER"]) {
      expect(
        statusChangeRefusal({ actor: actor("HR"), person: person(target), nextStatus: "SUSPENDED", otherActiveOwners: 1 }),
      ).toBeNull();
    }
  });

  it("refuses changing your own status, whoever you are", () => {
    expect(
      statusChangeRefusal({
        actor: actor("OWNER", "same"),
        person: person("OWNER", "ACTIVE", "same"),
        nextStatus: "DEACTIVATED",
        otherActiveOwners: 2,
      }),
    ).toMatch(/your own status/);
  });

  it("never removes the last active owner, but lets co-owners manage each other", () => {
    expect(
      statusChangeRefusal({ actor: actor("OWNER"), person: person("OWNER"), nextStatus: "SUSPENDED", otherActiveOwners: 0 }),
    ).toBe(LAST_OWNER_MESSAGE);
    expect(
      statusChangeRefusal({ actor: actor("OWNER"), person: person("OWNER"), nextStatus: "SUSPENDED", otherActiveOwners: 1 }),
    ).toBeNull();
  });

  it("lets an owner bring a suspended owner back even when they are the only other one", () => {
    expect(
      statusChangeRefusal({
        actor: actor("OWNER"),
        person: person("OWNER", "SUSPENDED"),
        nextStatus: "ACTIVE",
        otherActiveOwners: 0,
      }),
    ).toBeNull();
  });

  it("has nothing to refuse when the status doesn't change", () => {
    expect(
      statusChangeRefusal({ actor: actor("EMPLOYEE"), person: person("OWNER"), nextStatus: "ACTIVE", otherActiveOwners: 0 }),
    ).toBeNull();
  });
});

describe("reporting lines", () => {
  const lines = new Map<string, string | null>([
    ["ceo", null],
    ["head", "ceo"],
    ["lead", "head"],
    ["asha", "lead"],
  ]);

  it("refuses a loop, however long", () => {
    expect(createsReportingLoop("ceo", "asha", lines)).toBe(true);
    expect(createsReportingLoop("head", "lead", lines)).toBe(true);
    expect(createsReportingLoop("asha", "asha", lines)).toBe(true);
  });

  it("allows an ordinary line, or none", () => {
    expect(createsReportingLoop("asha", "ceo", lines)).toBe(false);
    expect(createsReportingLoop("asha", null, lines)).toBe(false);
  });

  it("stops on a loop that already exists elsewhere instead of spinning", () => {
    const broken = new Map<string, string | null>([
      ["a", "b"],
      ["b", "a"],
    ]);
    expect(createsReportingLoop("z", "a", broken)).toBe(false);
  });
});

describe("who may change an access level", () => {
  const role = (key: string, id = key) => ({ id, key, name: key });

  it("keeps the Owner level untouchable", () => {
    expect(roleEditRefusal({ actorRoleKey: "OWNER", actorRoleId: "OWNER", role: role("OWNER") })).toMatch(/Owner always keeps/);
  });

  it("refuses editing the level you hold, or one at or above it", () => {
    expect(roleEditRefusal({ actorRoleKey: "SUPER_ADMIN", actorRoleId: "SUPER_ADMIN", role: role("SUPER_ADMIN") })).toMatch(
      /hold SUPER_ADMIN access yourself/,
    );
    expect(roleEditRefusal({ actorRoleKey: "HR", actorRoleId: "HR", role: role("MANAGER") })).toMatch(/Only someone with more access/);
    expect(roleEditRefusal({ actorRoleKey: "ADMIN", actorRoleId: "ADMIN", role: role("SUPER_ADMIN") })).toMatch(
      /Only someone with more access/,
    );
  });

  it("lets you edit levels below your own", () => {
    expect(roleEditRefusal({ actorRoleKey: "OWNER", actorRoleId: "OWNER", role: role("SUPER_ADMIN") })).toBeNull();
    expect(roleEditRefusal({ actorRoleKey: "SUPER_ADMIN", actorRoleId: "SUPER_ADMIN", role: role("ADMIN") })).toBeNull();
  });
});

describe("which permissions a save can move", () => {
  const mine = new Set(["employees.view", "leave.approve"]);

  it("adds and removes only what you hold", () => {
    expect(
      mergePermissions({ current: ["employees.view"], requested: ["leave.approve"], mine }),
    ).toEqual(["leave.approve"]);
  });

  it("never grants what you don't hold", () => {
    expect(
      mergePermissions({ current: [], requested: ["payroll.approve", "bank.view", "leave.approve"], mine }),
    ).toEqual(["leave.approve"]);
  });

  it("never strips what you don't hold", () => {
    expect(
      mergePermissions({ current: ["payroll.approve", "employees.view"], requested: [], mine }),
    ).toEqual(["payroll.approve"]);
  });
});
