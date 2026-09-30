import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { proofAnchorId, proofReviewHref } from "@/lib/tasks/links";

describe("task proof link", () => {
  const id = "0b7c2f4e-1d2a-4c3b-9e8f-123456789abc";

  it("opens the task list at that task's proof card", () => {
    expect(proofReviewHref(id)).toBe(`/admin/tasks#proof-${id}`);
    expect(proofReviewHref(id).split("#")[1]).toBe(proofAnchorId(id));
  });

  it("points at a page that exists (there is no /admin/tasks/[id])", () => {
    const path = proofReviewHref(id).split("#")[0];
    const page = fileURLToPath(new URL(`../app/(admin)${path}/page.tsx`, import.meta.url));
    expect(existsSync(page)).toBe(true);
  });
});
