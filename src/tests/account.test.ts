import { describe, expect, it } from "vitest";
import {
  ATTEMPT_WINDOW_MS,
  describeRetryWait,
  MAX_FAILED_ATTEMPTS,
  MIN_PASSWORD_LENGTH,
  PasswordAttemptLimiter,
  validatePasswordChange,
} from "@/lib/account/policy";
import { passwordChangedEmail } from "@/lib/email/templates";

const good = {
  currentPassword: "old-password-1",
  newPassword: "new-password-22",
  confirmPassword: "new-password-22",
};

describe("password change validation", () => {
  it("accepts a well-formed change", () => {
    expect(validatePasswordChange(good)).toBeNull();
  });

  it("requires the current password first", () => {
    expect(validatePasswordChange({ ...good, currentPassword: "" })).toEqual({
      field: "currentPassword",
      message: "Enter your current password.",
    });
  });

  it("holds the new password to the same minimum as the invitation page", () => {
    const short = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(
      validatePasswordChange({ ...good, newPassword: short, confirmPassword: short }),
    ).toMatchObject({ field: "newPassword" });
    const exact = "a".repeat(MIN_PASSWORD_LENGTH);
    expect(
      validatePasswordChange({ ...good, newPassword: exact, confirmPassword: exact }),
    ).toBeNull();
  });

  it("refuses the same password again", () => {
    expect(
      validatePasswordChange({
        ...good,
        newPassword: good.currentPassword,
        confirmPassword: good.currentPassword,
      }),
    ).toMatchObject({ field: "newPassword" });
  });

  it("checks the confirmation last, so the first problem named is the real one", () => {
    expect(validatePasswordChange({ ...good, confirmPassword: "different" })).toEqual({
      field: "confirmPassword",
      message: "Both passwords must match.",
    });
    // A too-short password with a mismatched confirmation reports the length.
    expect(
      validatePasswordChange({ ...good, newPassword: "short", confirmPassword: "x" }),
    ).toMatchObject({ field: "newPassword" });
  });
});

describe("failed-attempt limiter", () => {
  function limiterAt(start: number) {
    let t = start;
    const limiter = new PasswordAttemptLimiter(() => t);
    return { limiter, advance: (ms: number) => (t += ms) };
  }

  it("allows the first attempts and stops at the limit", () => {
    const { limiter } = limiterAt(1_000_000);
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
      expect(limiter.retryAfterSeconds("u1")).toBe(0);
      limiter.recordFailure("u1");
    }
    expect(limiter.retryAfterSeconds("u1")).toBeGreaterThan(0);
  });

  it("counts per person, not globally", () => {
    const { limiter } = limiterAt(1_000_000);
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) limiter.recordFailure("u1");
    expect(limiter.retryAfterSeconds("u2")).toBe(0);
  });

  it("forgets after the window and on success", () => {
    const { limiter, advance } = limiterAt(1_000_000);
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) limiter.recordFailure("u1");
    expect(limiter.retryAfterSeconds("u1")).toBeGreaterThan(0);
    advance(ATTEMPT_WINDOW_MS);
    expect(limiter.retryAfterSeconds("u1")).toBe(0);

    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) limiter.recordFailure("u1");
    limiter.clear("u1");
    expect(limiter.retryAfterSeconds("u1")).toBe(0);
  });

  it("names the wait in whole minutes and points at the reset path", () => {
    expect(describeRetryWait(1)).toContain("1 minute,");
    expect(describeRetryWait(61)).toContain("2 minutes");
    expect(describeRetryWait(900)).toContain("Forgot password");
  });
});

describe("password-changed email", () => {
  const at = new Date("2026-09-15T04:30:00.000Z"); // 10:00 IST
  const base = { name: "Sunita Rao", at, timeZone: "Asia/Kolkata" };

  it("says when, in the company's time, and what to do if it wasn't them", () => {
    const mail = passwordChangedEmail({ ...base, signedOutOthers: false });
    expect(mail.subject).toBe("Your FlowHRMS password was changed");
    expect(mail.text).toContain("Hello Sunita,");
    expect(mail.text).toContain("15 Sept 2026");
    expect(mail.text).toContain("10:00");
    expect(mail.text).toContain("If it wasn't");
    expect(mail.text).toContain("Your other devices stay signed in.");
    expect(mail.text).not.toMatch(/password is|new password:/i);
  });

  it("reports when other devices were signed out", () => {
    const mail = passwordChangedEmail({ ...base, signedOutOthers: true });
    expect(mail.text).toContain("Your other devices were signed out");
    expect(mail.html).toContain("Your other devices were signed out");
  });

  it("escapes the name in HTML", () => {
    const mail = passwordChangedEmail({ ...base, name: "<b>x</b>", signedOutOthers: false });
    expect(mail.html).not.toContain("<b>x</b>");
    expect(mail.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
