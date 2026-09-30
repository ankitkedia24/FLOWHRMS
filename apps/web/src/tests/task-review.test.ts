import { describe, expect, it } from "vitest";
import { OUTSIDE_TEAM } from "@/lib/authz/scope";
import {
  OWN_PROOF,
  proofReviewRefusal,
  REVIEWABLE_PROOF_DECISIONS,
  reviewableProofWhere,
} from "@/lib/tasks/review";

/** Hardening 7E.3–7E.4: who may review task proof, and while it can be. */

const me = (roleKey: string) => ({ membershipId: "me", roleKey });
const team = new Set(["report"]);

describe("nobody reviews their own proof, except an Owner", () => {
  it("refuses every company-wide role below Owner on their own proof", () => {
    for (const roleKey of ["SUPER_ADMIN", "ADMIN", "HR"]) {
      expect(proofReviewRefusal({ actor: me(roleKey), scope: "all", assigneeId: "me" })).toBe(OWN_PROOF);
    }
    expect(OWN_PROOF).toBe("You can't review your own proof. Another approver has to.");
  });

  it("refuses a team-scoped role on their own proof with the same words", () => {
    for (const roleKey of ["MANAGER", "TEAM_LEADER", "CUSTOM"]) {
      expect(proofReviewRefusal({ actor: me(roleKey), scope: team, assigneeId: "me" })).toBe(OWN_PROOF);
    }
  });

  it("lets an Owner review their own, because nobody sits above them", () => {
    expect(proofReviewRefusal({ actor: me("OWNER"), scope: "all", assigneeId: "me" })).toBeNull();
  });

  it("keeps record scope for everyone else's proof", () => {
    expect(proofReviewRefusal({ actor: me("ADMIN"), scope: "all", assigneeId: "anyone" })).toBeNull();
    expect(proofReviewRefusal({ actor: me("MANAGER"), scope: team, assigneeId: "report" })).toBeNull();
    expect(proofReviewRefusal({ actor: me("MANAGER"), scope: team, assigneeId: "outsider" })).toBe(OUTSIDE_TEAM);
  });
});

describe("the proof review queue", () => {
  it("leaves your own proof out unless you are an Owner", () => {
    expect(reviewableProofWhere(me("ADMIN"), "all")).toEqual({ assigneeId: { not: "me" } });
    expect(reviewableProofWhere(me("HR"), "all")).toEqual({ assigneeId: { not: "me" } });
    expect(reviewableProofWhere(me("OWNER"), "all")).toEqual({});
  });

  it("shows a Manager their team only, which never includes themselves", () => {
    expect(reviewableProofWhere(me("MANAGER"), team)).toEqual({ assigneeId: { in: ["report"] } });
  });
});

describe("what can still be reviewed", () => {
  it("is a proof still waiting — asking for details ends it, and a new one is sent", () => {
    expect([...REVIEWABLE_PROOF_DECISIONS]).toEqual(["PENDING"]);
  });
});
