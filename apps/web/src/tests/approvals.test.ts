import { describe, expect, it } from "vitest";
import {
  ALREADY_DECIDED,
  DECIDABLE_STATUSES,
  isDecidable,
  mayDecideOwn,
  selfDecisionRefusal,
  withoutOwn,
} from "@/lib/authz/approvals";
import { OWNER_DECIDES_OWN, resolveAudience, type AudienceCandidate } from "@/lib/actions/audience";

const me = (roleKey: string) => ({ membershipId: "me", roleKey });

describe("nobody decides their own request, except an Owner", () => {
  it("refuses everyone below Owner deciding their own leave, with a clear message", () => {
    for (const roleKey of ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "TEAM_LEADER", "CUSTOM"]) {
      expect(selfDecisionRefusal({ actor: me(roleKey), subjectMembershipId: "me", kind: "leave" })).toBe(
        "You can't decide your own leave. Another approver has to.",
      );
    }
  });

  it("says attendance, not leave, for attendance", () => {
    expect(selfDecisionRefusal({ actor: me("ADMIN"), subjectMembershipId: "me", kind: "attendance" })).toBe(
      "You can't review your own attendance. Another approver has to.",
    );
  });

  it("lets an Owner decide their own, because nobody sits above them", () => {
    expect(mayDecideOwn("OWNER")).toBe(true);
    expect(selfDecisionRefusal({ actor: me("OWNER"), subjectMembershipId: "me", kind: "leave" })).toBeNull();
    expect(selfDecisionRefusal({ actor: me("OWNER"), subjectMembershipId: "me", kind: "attendance" })).toBeNull();
  });

  it("has nothing to say about someone else's request", () => {
    expect(selfDecisionRefusal({ actor: me("MANAGER"), subjectMembershipId: "them", kind: "leave" })).toBeNull();
  });

  it("keeps your own out of the queue you decide from, unless you are an Owner", () => {
    expect(withoutOwn(me("ADMIN"))).toEqual({ membershipId: { not: "me" } });
    expect(withoutOwn(me("MANAGER"))).toEqual({ membershipId: { not: "me" } });
    expect(withoutOwn(me("OWNER"))).toEqual({});
  });
});

describe("what can still be decided", () => {
  it("keeps a request open while it waits on an answer to a question", () => {
    expect(isDecidable("PENDING")).toBe(true);
    expect(isDecidable("DETAILS_REQUESTED")).toBe(true);
    expect([...DECIDABLE_STATUSES].sort()).toEqual(["DETAILS_REQUESTED", "PENDING"]);
  });

  it("closes it on a final decision, a cancellation or no exception at all", () => {
    for (const status of ["APPROVED", "REJECTED", "CANCELLED", "NONE"]) {
      expect(isDecidable(status)).toBe(false);
    }
  });

  it("tells the losing approver where to look", () => {
    expect(ALREADY_DECIDED).toBe("Already decided. Open the activity log to see who decided.");
  });
});

describe("an Owner's own request reaches the Owner's tiles", () => {
  const candidate = (userId: string): AudienceCandidate => ({
    userId,
    membershipId: `m-${userId}`,
    displayName: userId,
    canDecide: true,
    isDepartmentHead: false,
  });

  it("asks the Owner about their own leave, with a reason that says why", () => {
    const recipients = resolveAudience({
      candidates: [candidate("owner"), candidate("admin")],
      actorUserId: "owner",
      aboutUserId: "owner",
      aboutMayDecideOwn: true,
    });
    expect(recipients.map((r) => r.userId).sort()).toEqual(["admin", "owner"]);
    expect(recipients.find((r) => r.userId === "owner")?.reason).toMatch(/decide your own/);
  });

  it("still never asks anyone else about themselves", () => {
    const recipients = resolveAudience({
      candidates: [candidate("hr"), candidate("admin")],
      actorUserId: "hr",
      aboutUserId: "hr",
      aboutMayDecideOwn: false,
    });
    expect(recipients.map((r) => r.userId)).toEqual(["admin"]);
  });

  it("still leaves out whoever raised it when that is someone else", () => {
    const recipients = resolveAudience({
      candidates: [candidate("owner"), candidate("raiser")],
      actorUserId: "raiser",
      aboutUserId: "owner",
      aboutMayDecideOwn: true,
    });
    expect(recipients.map((r) => r.userId)).toEqual(["owner"]);
  });

  it("applies only where the deciding action allows it: leave, attendance and expense claims", () => {
    expect([...OWNER_DECIDES_OWN].sort()).toEqual(["ATTENDANCE_EXCEPTION", "EXPENSE_CLAIM", "LEAVE_REQUEST"]);
  });
});
