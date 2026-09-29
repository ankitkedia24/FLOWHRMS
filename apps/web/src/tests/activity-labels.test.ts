import { describe, expect, it } from "vitest";
import { ACTIVITY_LABEL_KEYS, describeAction } from "@/lib/activity-labels";

describe("activity log wording", () => {
  it("says what happened in plain words", () => {
    expect(describeAction("employee.invite_accepted")).toBe("Invitation accepted");
    expect(describeAction("tenant.self_signup")).toBe("Company signed up for a free trial");
  });

  it("never shows the word tenant, for known or unknown actions", () => {
    for (const key of [...ACTIVITY_LABEL_KEYS, "tenant.something_new", "tenant_policy.saved"]) {
      expect(describeAction(key).toLowerCase()).not.toContain("tenant");
    }
    expect(describeAction("tenant.something_new")).toBe("Company something new");
  });

  it("falls back to readable words for new actions", () => {
    expect(describeAction("leave.approved")).toBe("Leave approved");
    expect(describeAction("")).toBe("Change recorded");
  });
});

describe("record types in the activity log", () => {
  it("are named the way people say them", async () => {
    const { describeEntity } = await import("@/lib/activity-labels");
    expect(describeEntity("tenant_membership")).toBe("Employee");
    expect(describeEntity("tenant")).toBe("Company");
    expect(describeEntity("tenant_widget").toLowerCase()).not.toContain("tenant");
  });
});
