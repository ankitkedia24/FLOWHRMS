import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { legacyTaskHref, proofAnchorId, proofReviewHref } from "@/lib/tasks/links";

describe("task proof link", () => {
  const id = "0b7c2f4e-1d2a-4c3b-9e8f-123456789abc";

  it("opens the task list at that task's proof card", () => {
    expect(proofReviewHref(id)).toBe(`/admin/tasks#proof-${id}`);
    expect(proofReviewHref(id).split("#")[1]).toBe(proofAnchorId(id));
  });

  it("points at a page that exists", () => {
    const path = proofReviewHref(id).split("#")[0];
    const page = fileURLToPath(new URL(`../app/(admin)${path}/page.tsx`, import.meta.url));
    expect(existsSync(page)).toBe(true);
  });
});

describe("old /admin/tasks/{id} links (Hardening 7E.2)", () => {
  const id = "0b7c2f4e-1d2a-4c3b-9e8f-123456789abc";
  const team = new Set(["report"]);
  const task = (assigneeId: string, createdById = "someone") => ({ assigneeId, createdById });

  it("has a route to land on, so a stored link never ends on a missing page", () => {
    const page = fileURLToPath(new URL("../app/(admin)/admin/tasks/[taskId]/page.tsx", import.meta.url));
    expect(existsSync(page)).toBe(true);
  });

  it("forwards a task the person may see to its proof card", () => {
    expect(legacyTaskHref({ taskId: id, task: task("anyone"), scope: "all", actorId: "me" })).toBe(proofReviewHref(id));
    expect(legacyTaskHref({ taskId: id, task: task("report"), scope: team, actorId: "me" })).toBe(proofReviewHref(id));
    expect(legacyTaskHref({ taskId: id, task: task("me"), scope: team, actorId: "me" })).toBe(proofReviewHref(id));
    // One they set for someone since moved out of their team.
    expect(legacyTaskHref({ taskId: id, task: task("outsider", "me"), scope: team, actorId: "me" })).toBe(proofReviewHref(id));
  });

  it("opens the task list for a missing task, or one outside their team, alike", () => {
    expect(legacyTaskHref({ taskId: id, task: null, scope: "all", actorId: "me" })).toBe("/admin/tasks");
    expect(legacyTaskHref({ taskId: id, task: task("outsider"), scope: team, actorId: "me" })).toBe("/admin/tasks");
  });
});
