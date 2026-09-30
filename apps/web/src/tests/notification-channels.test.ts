import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateAccess } from "@/lib/authz/flags";
import type { AppSession } from "@/lib/auth/types";
import { choosableMatrix, notificationChannelStates } from "@/lib/notifications/channels";
import { NOTIFICATION_EVENTS } from "@/lib/settings/constants";
import { STATUS } from "@/lib/status";

/**
 * Notification channels say only what they do (hardening batch 7). notify()
 * writes in-app notices and nothing else, yet push and email defaulted on
 * and the settings matrix and daily report showed them "Enabled". These
 * pin the honest version: in-app works, the rest are "Not available yet"
 * whatever a company's switch says, and a save cannot store a tick for them.
 */

/**
 * Lets one test pretend a channel has been built, to pin what happens on
 * that day: the company's switch decides, and its ticks are kept. Empty
 * everywhere else, so every other test reads the real catalog.
 */
const pretendBuilt = vi.hoisted(() => new Set<string>());
vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return {
    ...actual,
    isFeatureBuilt: (moduleKey: string, featureKey: string) =>
      pretendBuilt.has(`${moduleKey}.${featureKey}`) ||
      actual.isFeatureBuilt(moduleKey, featureKey),
  };
});
afterEach(() => pretendBuilt.clear());

const session = {
  user: { id: "u1", displayName: "Test", email: "t@example.com", isPlatformAdmin: false },
  tenant: { id: "t1", slug: "demo", name: "Demo", timezone: "Asia/Kolkata", plan: "INTERNAL", trialEndsAt: null, selfSignup: false, ownerEmailVerifiedAt: null, paidUntil: null },
  membership: { id: "m1", roleKey: "OWNER", roleName: "Owner", employeeCode: null },
  permissions: new Set(),
  source: "dev-fixture",
} as unknown as AppSession;

/** The company's switch as the pages read it — catalog defaults, nothing saved. */
const catalogDefaults = (feature: string) =>
  evaluateAccess({
    session,
    entitlements: { modules: {}, features: {}, userExceptions: {} },
    module: "NOTIFICATIONS",
    feature,
  }).allowed;

describe("notification channel states", () => {
  it("in-app is the one channel that delivers, and it is always on", () => {
    const states = notificationChannelStates(() => true);
    const delivering = states.filter((c) => c.delivers).map((c) => c.key);
    expect(delivering).toEqual(["in_app"]);
    const inApp = states.find((c) => c.key === "in_app")!;
    expect(inApp.alwaysOn).toBe(true);
    expect(inApp.status).toBe(STATUS.enabled);
    expect(inApp.reason).toBeUndefined();
  });

  it("push, email, SMS and WhatsApp read Not available yet — even switched on", () => {
    for (const switchedOn of [true, false]) {
      const others = notificationChannelStates(() => switchedOn).filter((c) => !c.alwaysOn);
      expect(others.map((c) => c.label)).toEqual(["Push", "Email", "WhatsApp", "SMS"]);
      for (const c of others) {
        expect(c.delivers).toBe(false);
        expect(c.status).toBe(STATUS.notAvailableYet);
        expect(c.reason).toBe("Not available yet");
      }
    }
  });

  it("the catalog still defaults push and email on, but neither counts as on or shows as Enabled", () => {
    // The trap this closes: evaluateAccess said yes, and nothing was sent.
    expect(catalogDefaults("push")).toBe(false);
    expect(catalogDefaults("email")).toBe(false);
    const states = notificationChannelStates(catalogDefaults);
    for (const key of ["push", "email"]) {
      expect(states.find((c) => c.key === key)!.status).not.toBe(STATUS.enabled);
    }
  });

  it("never asks the company's switch about a channel that isn't built", () => {
    const asked: string[] = [];
    notificationChannelStates((key) => {
      asked.push(key);
      return true;
    });
    expect(asked).toEqual([]);
  });

  it("once a channel is built, the company's switch decides", () => {
    pretendBuilt.add("NOTIFICATIONS.email");
    const on = notificationChannelStates((key) => key === "email");
    expect(on.find((c) => c.key === "email")).toMatchObject({
      delivers: true,
      status: STATUS.enabled,
    });
    const off = notificationChannelStates(() => false);
    expect(off.find((c) => c.key === "email")).toMatchObject({
      delivers: false,
      status: STATUS.disabled,
      reason: "Switched off in Module Management",
    });
    // The others are still not available.
    expect(off.find((c) => c.key === "sms")!.status).toBe(STATUS.notAvailableYet);
  });

  it("reads Not available yet, as a fixed status label", () => {
    expect(STATUS.notAvailableYet.label).toBe("Not available yet");
    expect(STATUS.notAvailableYet.tone).toBe("neutral");
  });
});

describe("the events the matrix lists", () => {
  it("are the ones notify() sends an in-app notice for — not payslips", () => {
    // Each has a notify.* call behind it (lib/notifications/index.ts), so
    // the always-on in-app tick is true for every row shown.
    expect(NOTIFICATION_EVENTS.map((e) => e.key)).toEqual([
      "attendance_exception",
      "leave_request",
      "leave_decision",
      "task_assigned",
      "proof_submitted",
      "proof_decision",
    ]);
  });
});

describe("saving the event × channel matrix", () => {
  it("drops ticks for channels nothing sends on", () => {
    expect(
      choosableMatrix({
        "leave_request.email": true,
        "leave_request.push": true,
        "task_assigned.sms": true,
        "proof_decision.whatsapp": false,
      }),
    ).toEqual({});
  });

  it("does not store in-app, which is always on", () => {
    expect(choosableMatrix({ "leave_request.in_app": false })).toEqual({});
  });

  it("drops events and keys it doesn't know", () => {
    expect(
      choosableMatrix({
        "made_up.email": true,
        email: true,
        ".email": true,
        "__proto__.push": true,
      }),
    ).toEqual({});
  });

  it("keeps the choice, on or off, for a channel once it is built", () => {
    pretendBuilt.add("NOTIFICATIONS.email");
    expect(
      choosableMatrix({
        "leave_request.email": true,
        "task_assigned.email": false,
        "leave_request.sms": true,
        // Nothing sends a payslip notice at all, on any channel.
        "payslip_ready.email": true,
      }),
    ).toEqual({ "leave_request.email": true, "task_assigned.email": false });
  });

  it("keeps the policy's shape: an empty matrix is still a matrix", () => {
    const saved = choosableMatrix({});
    expect(saved).toEqual({});
    expect(Object.getPrototypeOf(saved)).toBe(Object.prototype);
  });
});
