import { describe, expect, it } from "vitest";
import {
  LOCKOUT_MAX_ATTEMPTS,
  LOCKOUT_MAX_PER_HOUR,
  PLATFORM_APPROVAL_EMAIL,
  lockoutCodeRefusal,
  lockoutPrecondition,
  lockoutSendGate,
  wrongCodeMessage,
  type LockoutCodeRow,
} from "@/lib/platform/lockout-policy";
import { pauseMoment, pausesSooner } from "@/lib/billing/pricing";
import { lockoutCodeEmail } from "@/lib/email/templates";

/**
 * Nobody locks a company out without the code emailed to Flowacord (owner
 * decision, 30 Sept 2026). The database half — the actions refusing, the
 * code used once, parallel use — is in platform-lockout-integration.test.ts.
 */

const NOW = new Date("2026-09-30T10:00:00.000Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const DAY_MS = 86_400_000;

describe("where the code goes", () => {
  it("is Flowacord's own inbox, fixed in code", () => {
    expect(PLATFORM_APPROVAL_EMAIL).toBe("info@flowacord.com");
  });
});

describe("asking for a code (lockoutSendGate)", () => {
  it("allows the first code", () => {
    expect(lockoutSendGate({ lastSentAt: null, sentInLastHour: 0 }, NOW).ok).toBe(true);
  });

  it("makes you wait a minute between codes", () => {
    const r = lockoutSendGate({ lastSentAt: new Date(NOW.getTime() - 20_000), sentInLastHour: 1 }, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.waitSeconds).toBe(40);
      expect(r.error).toBe("Wait 40 seconds before asking for another code.");
    }
    expect(lockoutSendGate({ lastSentAt: new Date(NOW.getTime() - 61_000), sentInLastHour: 1 }, NOW).ok).toBe(true);
  });

  it("stops at five an hour", () => {
    const r = lockoutSendGate({ lastSentAt: at(-30), sentInLastHour: LOCKOUT_MAX_PER_HOUR }, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("5 codes in the last hour");
  });
});

describe("which companies each action applies to (lockoutPrecondition)", () => {
  const active = { status: "ACTIVE", plan: "PAID", trialEndsAt: null };

  it("suspends only an active company", () => {
    expect(lockoutPrecondition("SUSPEND", active, NOW)).toBeNull();
    expect(lockoutPrecondition("SUSPEND", { ...active, status: "SUSPENDED" }, NOW)).toBe(
      "This company is already suspended.",
    );
    expect(lockoutPrecondition("SUSPEND", { ...active, status: "ARCHIVED" }, NOW)).toBe(
      "Only an active company can be suspended.",
    );
  });

  it("ends only a running trial — a paying or internal company is suspended instead", () => {
    const trial = { status: "ACTIVE", plan: "TRIAL", trialEndsAt: at(60 * 24) };
    expect(lockoutPrecondition("END_TRIAL", trial, NOW)).toBeNull();
    expect(lockoutPrecondition("END_TRIAL", { ...trial, trialEndsAt: null }, NOW)).toBeNull();
    expect(lockoutPrecondition("END_TRIAL", { ...trial, trialEndsAt: at(-1) }, NOW)).toBe(
      "Their trial has already ended.",
    );
    for (const plan of ["PAID", "INTERNAL"]) {
      expect(lockoutPrecondition("END_TRIAL", { ...trial, plan }, NOW)).toBe(
        "Only a free trial can be ended. To stop a paying company's access, suspend it.",
      );
    }
  });
});

describe("whether a code can be tried (lockoutCodeRefusal)", () => {
  const row: LockoutCodeRow = {
    action: "SUSPEND",
    tenantId: "t1",
    requestedById: "u1",
    attempts: 0,
    expiresAt: at(10),
    usedAt: null,
  };
  const want = { action: "SUSPEND" as const, tenantId: "t1", userId: "u1" };

  it("lets the admin who asked try it, for that company and action", () => {
    expect(lockoutCodeRefusal(row, want, NOW)).toBeNull();
  });

  it("is useless to anyone else, for any other company, or for the other action", () => {
    const other = "That code was sent for something else. Ask for a new one.";
    expect(lockoutCodeRefusal(row, { ...want, userId: "u2" }, NOW)).toBe(other);
    expect(lockoutCodeRefusal(row, { ...want, tenantId: "t2" }, NOW)).toBe(other);
    expect(lockoutCodeRefusal(row, { ...want, action: "END_TRIAL" }, NOW)).toBe(other);
  });

  it("works once, for ten minutes, and not after five wrong tries", () => {
    expect(lockoutCodeRefusal(null, want, NOW)).toBe("That code has expired. Ask for a new one.");
    expect(lockoutCodeRefusal({ ...row, usedAt: at(-1) }, want, NOW)).toBe(
      "That code has already been used. Ask for a new one.",
    );
    expect(lockoutCodeRefusal({ ...row, expiresAt: NOW }, want, NOW)).toBe("That code has expired. Ask for a new one.");
    expect(lockoutCodeRefusal({ ...row, attempts: LOCKOUT_MAX_ATTEMPTS }, want, NOW)).toBe(
      "Too many wrong tries. Ask for a new code.",
    );
  });

  it("counts down the tries left", () => {
    expect(wrongCodeMessage(1)).toBe("That code isn't right. 4 tries left.");
    expect(wrongCodeMessage(4)).toBe("That code isn't right. 1 try left.");
    expect(wrongCodeMessage(5)).toBe("Too many wrong tries. Ask for a new code.");
  });
});

describe("date screens never pause a company sooner (pausesSooner)", () => {
  const trial = (days: number | null) => ({
    plan: "TRIAL",
    trialEndsAt: days === null ? null : new Date(NOW.getTime() + days * DAY_MS),
    paidUntil: null,
  });
  const paid = (days: number | null) => ({
    plan: "PAID",
    trialEndsAt: null,
    paidUntil: days === null ? null : new Date(NOW.getTime() + days * DAY_MS),
  });
  const internal = { plan: "INTERNAL", trialEndsAt: null, paidUntil: null };

  it("knows when each kind of company pauses", () => {
    expect(pauseMoment(trial(10))?.getTime()).toBe(NOW.getTime() + 10 * DAY_MS);
    expect(pauseMoment(paid(10))?.getTime()).toBe(NOW.getTime() + 17 * DAY_MS);
    expect(pauseMoment(paid(null))).toBeNull();
    expect(pauseMoment(internal)).toBeNull();
  });

  it("refuses bringing a pause closer", () => {
    expect(pausesSooner(trial(30), trial(3), NOW)).toBe(true);
    expect(pausesSooner(paid(60), paid(10), NOW)).toBe(true);
    expect(pausesSooner(paid(null), paid(365), NOW)).toBe(true);
    expect(pausesSooner(internal, trial(30), NOW)).toBe(true);
    expect(pausesSooner(trial(30), paid(10), NOW)).toBe(true);
  });

  it("allows moving it later, or removing it", () => {
    expect(pausesSooner(trial(3), trial(30), NOW)).toBe(false);
    expect(pausesSooner(trial(27), paid(30), NOW)).toBe(false);
    expect(pausesSooner(paid(10), paid(null), NOW)).toBe(false);
    expect(pausesSooner(trial(10), trial(10), NOW)).toBe(false);
  });

  it("does not guard a company that is already paused", () => {
    expect(pausesSooner(trial(-2), trial(1), NOW)).toBe(false);
  });
});

describe("the email with the code", () => {
  const mail = lockoutCodeEmail({
    code: "482913",
    doing: "suspend",
    consequence: "Nobody there will be able to sign in until the company is restored.",
    companyName: "Acme <Hardware>",
    requestedByName: "Priya Shah",
    requestedByEmail: "priya@example.test",
    reason: "Asked to close their account",
    requestedAt: NOW,
    expiresAt: at(10),
  });

  it("keeps the code out of the subject, which phones show on the lock screen", () => {
    expect(mail.subject).toBe("FlowHRMS: code to suspend Acme <Hardware>");
    expect(mail.subject).not.toMatch(/\d{3}/);
  });

  it("says who asked, why, and what it does — so an unexpected one is noticed", () => {
    expect(mail.text).toContain("Code: 482 913");
    expect(mail.text).toContain("Someone with FlowHRMS platform access wants to suspend Acme <Hardware>.");
    expect(mail.text).toContain("Asked by: Priya Shah <priya@example.test>");
    expect(mail.text).toContain("Their reason: Asked to close their account");
    expect(mail.text).toContain("When: 30 Sept, 3:30 pm IST");
    expect(mail.text).toContain("If you didn't expect this, don't share the code");
  });

  it("escapes what people typed in the HTML", () => {
    expect(mail.html).toContain("Acme &lt;Hardware&gt;");
    expect(mail.html).not.toContain("<Hardware>");
    expect(mail.html).toContain("482 913");
  });
});
