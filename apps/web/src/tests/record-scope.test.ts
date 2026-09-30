import { describe, expect, it } from "vitest";
import {
  OUTSIDE_TEAM,
  canSee,
  decidableWhere,
  decisionScopeRefusal,
  recordScope,
  seesWholeCompany,
  supervisorsOf,
  teamOf,
  visibleIds,
  type ScopeDepartment,
  type ScopeMember,
} from "@/lib/authz/scope";
import { TEAM_SCOPED_KINDS } from "@/lib/actions/audience";

/**
 *   owner
 *   └─ mgr ─┬─ lead ── rep1 ── rep2
 *           └─ rep3
 *   head (heads Dispatch: d1, d2, and head themselves)
 *   other (nobody's report, no department)
 */
const m = (id: string, reportingToId: string | null = null, departmentId: string | null = null): ScopeMember => ({
  id,
  reportingToId,
  departmentId,
});
const members: ScopeMember[] = [
  m("owner"),
  m("mgr", "owner"),
  m("lead", "mgr"),
  m("rep1", "lead"),
  m("rep2", "rep1"),
  m("rep3", "mgr"),
  m("head", null, "dispatch"),
  m("d1", null, "dispatch"),
  m("d2", "rep3", "dispatch"),
  m("other"),
];
const departments: ScopeDepartment[] = [
  { id: "dispatch", headId: "head" },
  { id: "empty", headId: null },
];

describe("who sees the whole company", () => {
  it("is Owner, Super Admin, Admin and HR", () => {
    for (const key of ["OWNER", "SUPER_ADMIN", "ADMIN", "HR"]) {
      expect(seesWholeCompany(key)).toBe(true);
      expect(recordScope({ actor: { membershipId: "x", roleKey: key }, members, departments })).toBe("all");
    }
  });

  it("is nobody else — Manager, Team Leader, Viewer and any role a company adds see a team", () => {
    for (const key of ["MANAGER", "TEAM_LEADER", "VIEWER", "EMPLOYEE", "STORE_SUPERVISOR"]) {
      expect(seesWholeCompany(key)).toBe(false);
      expect(recordScope({ actor: { membershipId: "mgr", roleKey: key }, members, departments })).toBeInstanceOf(Set);
    }
  });
});

describe("a team", () => {
  it("is everyone who reports to you, directly or through others", () => {
    expect([...teamOf("mgr", members, departments)].sort()).toEqual(["d2", "lead", "rep1", "rep2", "rep3"]);
    expect([...teamOf("lead", members, departments)].sort()).toEqual(["rep1", "rep2"]);
  });

  it("includes the members of a department you head, but never you", () => {
    expect([...teamOf("head", members, departments)].sort()).toEqual(["d1", "d2"]);
  });

  it("is empty for someone nobody reports to", () => {
    expect(teamOf("other", members, departments).size).toBe(0);
    expect(teamOf("rep2", members, departments).size).toBe(0);
  });

  it("does not hang, or include you, when a reporting line loops back", () => {
    const loop = [m("a", "b"), m("b", "c"), m("c", "a"), m("self", "self")];
    expect([...teamOf("a", loop, [])].sort()).toEqual(["b", "c"]);
    expect(teamOf("self", loop, []).size).toBe(0);
    expect([...supervisorsOf("a", loop, [])].sort()).toEqual(["b", "c"]);
    expect(supervisorsOf("self", loop, []).size).toBe(0);
  });

  it("agrees in both directions: X is in M's team exactly when M supervises X", () => {
    const ids = members.map((x) => x.id);
    for (const manager of ids) {
      const team = teamOf(manager, members, departments);
      for (const person of ids) {
        expect(supervisorsOf(person, members, departments).has(manager)).toBe(team.has(person));
      }
    }
  });
});

describe("seeing and deciding within scope", () => {
  const scope = recordScope({ actor: { membershipId: "lead", roleKey: "TEAM_LEADER" }, members, departments });

  it("lets you see yourself and your team, and nobody else", () => {
    expect(canSee(scope, "lead", "lead")).toBe(true);
    expect(canSee(scope, "lead", "rep2")).toBe(true);
    expect(canSee(scope, "lead", "rep3")).toBe(false);
    expect(canSee(scope, "lead", "mgr")).toBe(false);
    expect(canSee("all", "lead", "other")).toBe(true);
  });

  it("lists you and your team, or everyone", () => {
    expect(visibleIds(scope, "lead")?.sort()).toEqual(["lead", "rep1", "rep2"]);
    expect(visibleIds("all", "lead")).toBeNull();
  });

  it("refuses deciding about someone outside your team, in words", () => {
    expect(decisionScopeRefusal(scope, "lead", "rep1")).toBeNull();
    expect(decisionScopeRefusal(scope, "lead", "rep3")).toBe(OUTSIDE_TEAM);
    expect(OUTSIDE_TEAM).toBe("That person isn't in your team.");
    expect(decisionScopeRefusal("all", "lead", "other")).toBeNull();
  });

  it("never lets scope approve your own work", () => {
    expect(decisionScopeRefusal(scope, "lead", "lead")).toMatch(/your own/);
  });

  it("queues your team's requests only, and never your own unless you are an Owner", () => {
    const where = decidableWhere({ membershipId: "lead", roleKey: "TEAM_LEADER" }, scope);
    expect(where).toEqual({ membershipId: { in: expect.arrayContaining(["rep1", "rep2"]) } });
    expect(JSON.stringify(where)).not.toContain('"lead"');
    expect(decidableWhere({ membershipId: "a", roleKey: "ADMIN" }, "all")).toEqual({ membershipId: { not: "a" } });
    expect(decidableWhere({ membershipId: "o", roleKey: "OWNER" }, "all")).toEqual({});
  });

  it("asks a manager's tiles about their team only for the kinds whose action checks scope", () => {
    expect([...TEAM_SCOPED_KINDS].sort()).toEqual(["ATTENDANCE_EXCEPTION", "LEAVE_REQUEST", "TASK_PROOF"]);
  });
});
