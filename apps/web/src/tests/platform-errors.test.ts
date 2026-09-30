import { describe, expect, it } from "vitest";
import {
  ALERT_EMAIL,
  errorFingerprint,
  isControlFlow,
  routeLabel,
  scrubMessage,
  shouldEmail,
} from "@/lib/platform/error-policy";
import { errorAlertEmail } from "@/lib/email/templates";

/**
 * Server errors on the live site: what is kept, how they group, and when
 * info@flowacord.com is emailed. The database half is in
 * platform-errors-integration.test.ts.
 */

const NOW = new Date("2026-09-30T10:00:00.000Z");

describe("what an error message keeps (scrubMessage)", () => {
  it("removes email addresses and long numbers — phone numbers, account numbers", () => {
    expect(scrubMessage('Unique constraint failed for asha.rao@example.com and +91 98765 43210')).toBe(
      "Unique constraint failed for [email] and [number]",
    );
    expect(scrubMessage("Account 123456789012 not found")).toBe("Account [number] not found");
  });

  it("keeps short numbers, which are rarely personal (line 42, status 500)", () => {
    expect(scrubMessage("Failed at line 42 with status 500")).toBe("Failed at line 42 with status 500");
  });

  it("is one line, never empty, and at most 300 characters", () => {
    expect(scrubMessage("  first\n  second  ")).toBe("first second");
    expect(scrubMessage("   ")).toBe("(no message)");
    const long = scrubMessage("x".repeat(1000));
    expect(long).toHaveLength(300);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("which errors count as the same (errorFingerprint)", () => {
  const base = { route: "/(admin)/admin/expenses/[id]", kind: "render" };

  it("groups messages that differ only by ids or numbers", () => {
    const a = errorFingerprint({ ...base, message: "Claim 41 not found (3f2b8c9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f)" });
    const b = errorFingerprint({ ...base, message: "Claim 42 not found (00000000-0000-4000-8000-000000000001)" });
    expect(a).toBe(b);
  });

  it("keeps different routes, kinds and messages apart", () => {
    const one = errorFingerprint({ ...base, message: "boom" });
    expect(errorFingerprint({ ...base, route: "/(admin)/admin/tasks", message: "boom" })).not.toBe(one);
    expect(errorFingerprint({ ...base, kind: "action", message: "boom" })).not.toBe(one);
    expect(errorFingerprint({ ...base, message: "bang" })).not.toBe(one);
  });
});

describe("when info@flowacord.com is emailed (shouldEmail)", () => {
  it("emails the first of a kind, then at most once an hour", () => {
    expect(ALERT_EMAIL).toBe("info@flowacord.com");
    expect(shouldEmail(null, NOW)).toBe(true);
    expect(shouldEmail(new Date(NOW.getTime() - 30 * 60_000), NOW)).toBe(false);
    expect(shouldEmail(new Date(NOW.getTime() - 60 * 60_000), NOW)).toBe(true);
  });
});

describe("what isn't an error", () => {
  it("ignores redirects and not-found pages, which Next.js signals by throwing", () => {
    expect(isControlFlow("NEXT_REDIRECT;replace;/sign-in;307;")).toBe(true);
    expect(isControlFlow("NEXT_HTTP_ERROR_FALLBACK;404")).toBe(true);
    expect(isControlFlow("NEXT_NOT_FOUND")).toBe(true);
    expect(isControlFlow("2718281828")).toBe(false);
    expect(isControlFlow(undefined)).toBe(false);
  });
});

describe("where it happened (routeLabel)", () => {
  it("prefers the route file and never keeps a query string", () => {
    expect(routeLabel("/(admin)/admin/employees/[membershipId]", "/admin/employees/abc?tab=pay")).toBe(
      "/(admin)/admin/employees/[membershipId]",
    );
    expect(routeLabel(undefined, "/admin/employees/abc?tab=pay")).toBe("/admin/employees/abc");
    expect(routeLabel("", "")).toBe("(unknown)");
  });
});

describe("the alert email", () => {
  const mail = errorAlertEmail({
    message: "Cannot read properties of undefined <reading 'id'>",
    route: "/(admin)/admin/expenses/[id]",
    kind: "render",
    method: "GET",
    count: 3,
    firstSeenAt: NOW,
    link: "https://hrms.flowacord.com/platform/system",
  });

  it("says where, what and how often, and links to the full list", () => {
    expect(mail.subject).toBe("FlowHRMS error: /(admin)/admin/expenses/[id]");
    expect(mail.text).toContain("Where: GET /(admin)/admin/expenses/[id] (render)");
    expect(mail.text).toContain("Seen 3 times since 30 Sept, 3:30 pm IST.");
    expect(mail.text).toContain("https://hrms.flowacord.com/platform/system");
  });

  it("escapes the message in the HTML", () => {
    expect(mail.html).toContain("&lt;reading 'id'&gt;");
    expect(mail.html).not.toContain("<reading");
  });
});
