import { describe, expect, it } from "vitest";
import {
  generateInviteToken,
  hashInviteToken,
  inviteTokenMatches,
  inviteExpiryFrom,
  inviteUrl,
  INVITE_TTL_DAYS,
} from "@/lib/invites/token";
import {
  INVITE_HELD_REASON,
  canResendInvite,
  computeInviteStatus,
  describeClash,
  invitationsHeld,
  describeSignInReadiness,
  isInviteRedeemable,
  MAX_RESENDS,
  normaliseEmail,
  normaliseEmployeeCode,
  normaliseMobile,
  RESEND_COOLDOWN_MS,
} from "@/lib/invites/policy";
import {
  ROLE_CONSEQUENCE,
  ROLE_PICKER_ORDER,
  ROLE_TEMPLATES,
  PRIVILEGE_RANK,
  privilegeRank,
} from "@/lib/catalog";

const NOW = new Date("2026-08-10T10:00:00.000Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("invite tokens", () => {
  it("never repeats a token", () => {
    const seen = new Set(Array.from({ length: 500 }, generateInviteToken));
    expect(seen.size).toBe(500);
  });

  it("produces URL-safe tokens with no padding", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateInviteToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("matches a token against its own hash", () => {
    const token = generateInviteToken();
    expect(inviteTokenMatches(token, hashInviteToken(token))).toBe(true);
  });

  it("rejects a different token", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(inviteTokenMatches(a, hashInviteToken(b))).toBe(false);
  });

  it("rejects a malformed stored hash instead of throwing", () => {
    expect(inviteTokenMatches("anything", "not-hex")).toBe(false);
    expect(inviteTokenMatches("anything", "")).toBe(false);
  });

  it("stores a hash that does not contain the token", () => {
    const token = generateInviteToken();
    expect(hashInviteToken(token)).not.toContain(token.slice(0, 12));
    expect(hashInviteToken(token)).toHaveLength(64);
  });

  it("expires a week out", () => {
    expect(inviteExpiryFrom(NOW).getTime() - NOW.getTime()).toBe(
      INVITE_TTL_DAYS * DAY,
    );
  });

  it("builds a link without doubling the slash", () => {
    expect(inviteUrl("https://flowhrms.example.com/", "abc")).toBe(
      "https://flowhrms.example.com/invite/abc",
    );
  });

  it("escapes a token in the URL", () => {
    expect(inviteUrl("https://x.com", "a/b?c")).toBe(
      "https://x.com/invite/a%2Fb%3Fc",
    );
  });
});

describe("invite status is computed from the clock", () => {
  it("is Not invited when there is no invitation", () => {
    expect(computeInviteStatus(null, NOW).label).toBe("Not invited");
  });

  it("is Pending while live", () => {
    const status = computeInviteStatus(
      { status: "PENDING", expiresAt: later(DAY) },
      NOW,
    );
    expect(status.label).toBe("Pending");
  });

  it("is Expired once the deadline passes, even though the row still says PENDING", () => {
    const status = computeInviteStatus(
      { status: "PENDING", expiresAt: later(-1) },
      NOW,
    );
    expect(status.label).toBe("Expired");
  });

  it("stays Accepted regardless of expiry", () => {
    const status = computeInviteStatus(
      { status: "ACCEPTED", expiresAt: later(-10 * DAY) },
      NOW,
    );
    expect(status.label).toBe("Accepted");
  });

  it("reports Revoked", () => {
    expect(
      computeInviteStatus({ status: "REVOKED", expiresAt: later(DAY) }, NOW)
        .label,
    ).toBe("Revoked");
  });

  it("always carries a word, never colour alone", () => {
    for (const row of [
      { status: "PENDING" as const, expiresAt: later(DAY) },
      { status: "ACCEPTED" as const, expiresAt: later(DAY) },
      { status: "EXPIRED" as const, expiresAt: later(-DAY) },
      { status: "REVOKED" as const, expiresAt: later(DAY) },
    ]) {
      expect(computeInviteStatus(row, NOW).label.length).toBeGreaterThan(0);
    }
  });

  it("says why nothing was sent while the company's invitations are held", () => {
    const status = computeInviteStatus(null, NOW, true);
    expect(status.label).toBe("Not sent — confirm your email");
    expect(status.tone).toBe("warning");
  });

  it("only a never-sent invitation can be held; a real one shows its own state", () => {
    expect(computeInviteStatus({ status: "PENDING", expiresAt: later(DAY) }, NOW, true).label).toBe("Pending");
    expect(computeInviteStatus({ status: "REVOKED", expiresAt: later(DAY) }, NOW, true).label).toBe("Revoked");
  });
});

describe("invitations are held until a self-serve owner confirms their email", () => {
  it("holds them for a company that signed itself up and has not confirmed", () => {
    expect(invitationsHeld({ selfSignup: true, ownerEmailVerifiedAt: null })).toBe(true);
  });

  it("releases them once the owner has confirmed", () => {
    expect(invitationsHeld({ selfSignup: true, ownerEmailVerifiedAt: NOW })).toBe(false);
  });

  it("never holds a company Flowacord set up", () => {
    expect(invitationsHeld({ selfSignup: false, ownerEmailVerifiedAt: null })).toBe(false);
  });

  it("tells the owner the invitation goes out by itself", () => {
    expect(INVITE_HELD_REASON).toMatch(/goes out by itself/);
    expect(INVITE_HELD_REASON).toMatch(/Send it again/);
  });
});

describe("redeeming an invitation", () => {
  it("accepts a live pending invitation", () => {
    expect(
      isInviteRedeemable({ status: "PENDING", expiresAt: later(HOUR) }, NOW).ok,
    ).toBe(true);
  });

  it("refuses an expired one and says what to do", () => {
    const result = isInviteRedeemable(
      { status: "PENDING", expiresAt: later(-HOUR) },
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/expired.*new one/i);
  });

  it("refuses a second use and points at sign-in", () => {
    const result = isInviteRedeemable(
      { status: "ACCEPTED", expiresAt: later(HOUR) },
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/already been used/i);
  });

  it("refuses a revoked one", () => {
    const result = isInviteRedeemable(
      { status: "REVOKED", expiresAt: later(HOUR) },
      NOW,
    );
    expect(result.ok).toBe(false);
  });

  it("treats the exact expiry moment as expired", () => {
    expect(isInviteRedeemable({ status: "PENDING", expiresAt: NOW }, NOW).ok).toBe(
      false,
    );
  });
});

describe("resending", () => {
  it("allows a first resend", () => {
    expect(
      canResendInvite({ status: "PENDING", resendCount: 0 }, NOW).allowed,
    ).toBe(true);
  });

  it("allows resending an EXPIRED invitation — that is the common case", () => {
    expect(
      canResendInvite({ status: "EXPIRED", resendCount: 1 }, NOW).allowed,
    ).toBe(true);
  });

  it("refuses once accepted", () => {
    const result = canResendInvite(
      { status: "ACCEPTED", resendCount: 0 },
      NOW,
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toMatch(/already joined/i);
  });

  it("throttles a rapid second send and names the wait", () => {
    const result = canResendInvite(
      { status: "PENDING", resendCount: 1, lastResendAt: later(-30_000) },
      NOW,
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toMatch(/90 seconds/);
  });

  it("allows again once the cooldown passes", () => {
    expect(
      canResendInvite(
        {
          status: "PENDING",
          resendCount: 1,
          lastResendAt: later(-RESEND_COOLDOWN_MS),
        },
        NOW,
      ).allowed,
    ).toBe(true);
  });

  it("stops at the cap and suggests sharing the link instead", () => {
    const result = canResendInvite(
      { status: "PENDING", resendCount: MAX_RESENDS },
      NOW,
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toMatch(/directly/i);
  });
});

describe("mobile numbers", () => {
  it("treats the same number written four ways as one person", () => {
    const forms = [
      "9876543210",
      "+91 98765 43210",
      "098765-43210",
      " 919876543210 ",
    ];
    const values = forms.map((f) => {
      const r = normaliseMobile(f);
      return r.ok ? r.value : `FAILED:${f}`;
    });
    expect(new Set(values).size).toBe(1);
    expect(values[0]).toBe("+919876543210");
  });

  it("rejects a landline-length number with a usable message", () => {
    const r = normaliseMobile("22334455");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/10-digit/);
  });

  it("rejects an Indian number starting with 5", () => {
    const r = normaliseMobile("5876543210");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/6, 7, 8 or 9/);
  });

  it("keeps a non-Indian number that carries its own country code", () => {
    const r = normaliseMobile("+1 415 555 0132");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("+14155550132");
  });

  it("rejects an empty entry", () => {
    expect(normaliseMobile("   ").ok).toBe(false);
  });
});

describe("other identifiers", () => {
  it("lowercases and trims email", () => {
    expect(normaliseEmail("  Ravi.Kumar@Example.COM ")).toBe(
      "ravi.kumar@example.com",
    );
  });

  it("folds employee-code spacing and case", () => {
    expect(normaliseEmployeeCode(" emp 001 ")).toBe("EMP001");
    expect(normaliseEmployeeCode("STF001")).toBe("STF001");
  });
});

describe("duplicate messages respect the tenant boundary", () => {
  it("names the colleague when the clash is inside your own company", () => {
    expect(
      describeClash({
        inThisTenant: true,
        heldElsewhere: false,
        field: "email",
        holderName: "Ravi Kumar",
      }),
    ).toBe("Ravi Kumar already uses this email address.");
  });

  it("never reveals that an address belongs to another company", () => {
    const message = describeClash({
      inThisTenant: false,
      heldElsewhere: true,
      field: "email",
    });
    expect(message).toBeTruthy();
    expect(message).not.toMatch(/another|other compan|already exists|taken by/i);
    expect(message).toMatch(/can't be used here/i);
  });

  it("lets an employee ID repeat across companies", () => {
    expect(
      describeClash({
        inThisTenant: false,
        heldElsewhere: true,
        field: "employeeCode",
      }),
    ).toBeNull();
  });

  it("returns null when nothing clashes", () => {
    expect(
      describeClash({ inThisTenant: false, heldElsewhere: false, field: "mobile" }),
    ).toBeNull();
  });
});

describe("sign-in readiness is stated, not implied", () => {
  it("promises an email when there is one", () => {
    const r = describeSignInReadiness("ravi@example.com");
    expect(r.canInvite).toBe(true);
    expect(r.note).toMatch(/set their password/i);
  });

  it("says plainly that no email means no invitation, and the record is still saved", () => {
    const r = describeSignInReadiness(null);
    expect(r.canInvite).toBe(false);
    expect(r.note).toMatch(/record is saved/i);
    expect(r.note).toMatch(/copy the invitation link/i);
  });

  it("treats whitespace as no email", () => {
    expect(describeSignInReadiness("   ").canInvite).toBe(false);
  });
});

describe("the role picker defaults to the least it can", () => {
  it("offers Employee first, not Admin", () => {
    // Alphabetical order put Admin first, and a form that defaults to its
    // first option therefore granted Admin to anyone added without opening
    // the dropdown. Reached production; a new hire was created as HR/Admin
    // rather than Employee.
    expect(ROLE_PICKER_ORDER[0]).toBe("EMPLOYEE");
  });

  it("never offers an admin-area role before a non-admin one", () => {
    const opensAdmin = new Set(["MANAGER", "HR", "ADMIN", "SUPER_ADMIN", "OWNER"]);
    const firstAdmin = ROLE_PICKER_ORDER.findIndex((k) => opensAdmin.has(k));
    const lastPlain = ROLE_PICKER_ORDER.reduce(
      (acc, k, i) => (!opensAdmin.has(k) && k !== "VIEWER" ? i : acc),
      -1,
    );
    expect(firstAdmin).toBeGreaterThan(lastPlain);
  });

  it("puts Owner last — the most powerful role is never a default", () => {
    expect(ROLE_PICKER_ORDER[ROLE_PICKER_ORDER.length - 1]).toBe("OWNER");
  });

  it("explains every role it offers", () => {
    for (const key of ROLE_PICKER_ORDER) {
      expect(ROLE_CONSEQUENCE[key], `no consequence line for ${key}`).toBeTruthy();
    }
  });

  it("covers every role template the catalog defines", () => {
    for (const tpl of ROLE_TEMPLATES) {
      expect(ROLE_PICKER_ORDER, `${tpl.key} missing from the picker order`).toContain(tpl.key);
    }
  });

  it("says plainly which roles open the admin area", () => {
    for (const key of ["MANAGER", "HR", "ADMIN", "SUPER_ADMIN"]) {
      expect(ROLE_CONSEQUENCE[key].toLowerCase()).toContain("admin area");
    }
    expect(ROLE_CONSEQUENCE.EMPLOYEE.toLowerCase()).toContain("no admin area");
  });
});

describe("nobody may grant more authority than they hold", () => {
  it("ranks every role the catalog defines", () => {
    for (const tpl of ROLE_TEMPLATES) {
      expect(PRIVILEGE_RANK[tpl.key], `${tpl.key} has no rank`).toBeDefined();
    }
  });

  it("puts Owner strictly above every other role", () => {
    const owner = privilegeRank("OWNER");
    for (const tpl of ROLE_TEMPLATES) {
      if (tpl.key === "OWNER") continue;
      expect(privilegeRank(tpl.key)).toBeLessThan(owner);
    }
  });

  it("treats Viewer as low authority despite reading a lot", () => {
    // Viewer sees employees and reports but changes nothing, so it must
    // never be treated as senior to Manager or HR.
    expect(privilegeRank("VIEWER")).toBeLessThan(privilegeRank("MANAGER"));
    expect(privilegeRank("VIEWER")).toBeLessThan(privilegeRank("HR"));
  });

  it("stops an Admin creating an Owner", () => {
    expect(privilegeRank("OWNER")).toBeGreaterThan(privilegeRank("ADMIN"));
  });

  it("stops HR promoting someone to Super Admin", () => {
    expect(privilegeRank("SUPER_ADMIN")).toBeGreaterThan(privilegeRank("HR"));
  });

  it("lets a Manager assign roles at or below their own", () => {
    const manager = privilegeRank("MANAGER");
    for (const key of ["EMPLOYEE", "TEAM_LEADER", "VIEWER"]) {
      expect(privilegeRank(key)).toBeLessThanOrEqual(manager);
    }
  });

  it("gives an unknown role the lowest rank rather than trusting it", () => {
    expect(privilegeRank("NOT_A_REAL_ROLE")).toBe(0);
  });
});
