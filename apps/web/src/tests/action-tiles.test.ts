import { describe, expect, it } from "vitest";
import {
  canSnooze,
  formatSnoozeTime,
  isTileVisible,
  MAX_SNOOZES,
  nextLocalHour,
  resolveSnoozeOption,
  snoozeOptions,
} from "@/lib/actions/snooze";
import {
  describeHeadGap,
  resolveAudience,
  DECIDING_PERMISSION,
  type AudienceCandidate,
} from "@/lib/actions/audience";
import {
  ACTION_KINDS,
  APPROVE_INLINE,
  isActionKind,
  openLabel,
} from "@/lib/actions/kinds";

const IST = "Asia/Kolkata";
/** 10:00 UTC = 15:30 IST. */
const AFTERNOON = new Date("2026-08-10T10:00:00.000Z");
/** 02:00 UTC = 07:30 IST. */
const EARLY = new Date("2026-08-10T02:00:00.000Z");

describe("snooze times land on the tenant's clock", () => {
  it("finds this evening when it is still afternoon", () => {
    const at = nextLocalHour(AFTERNOON, IST, 18);
    expect(formatSnoozeTime(at, IST)).toBe("6:00 pm");
    expect(at.getTime()).toBeGreaterThan(AFTERNOON.getTime());
  });

  it("rolls to tomorrow when the hour has already passed", () => {
    const evening = new Date("2026-08-10T14:00:00.000Z"); // 19:30 IST
    const at = nextLocalHour(evening, IST, 18);
    expect(at.getTime() - evening.getTime()).toBeGreaterThan(20 * 60 * 60 * 1000);
    expect(formatSnoozeTime(at, IST)).toBe("6:00 pm");
  });

  it("finds 9am the same morning when it is 7:30am", () => {
    const at = nextLocalHour(EARLY, IST, 9);
    expect(at.getTime() - EARLY.getTime()).toBe(90 * 60 * 1000);
  });

  it("works in a timezone that is not the default", () => {
    const at = nextLocalHour(AFTERNOON, "America/New_York", 18);
    expect(formatSnoozeTime(at, "America/New_York")).toBe("6:00 pm");
  });

  it("offers exactly four options, each naming its time", () => {
    const options = snoozeOptions(AFTERNOON, IST);
    expect(options).toHaveLength(4);
    expect(options.map((o) => o.key)).toEqual(["15m", "1h", "evening", "morning"]);
    for (const o of options) {
      expect(o.label.length).toBeGreaterThan(0);
      expect(o.until.getTime()).toBeGreaterThan(AFTERNOON.getTime());
    }
  });

  it("spells out the hour options rather than saying 'later'", () => {
    const options = snoozeOptions(AFTERNOON, IST);
    expect(options[2].label).toMatch(/\(\d{1,2}:\d{2} [ap]m\)/);
    expect(options[3].label).toMatch(/\(\d{1,2}:\d{2} [ap]m\)/);
    expect(options.some((o) => /^later$/i.test(o.label))).toBe(false);
  });

  it("says 'Tomorrow evening' when 6pm has gone", () => {
    const evening = new Date("2026-08-10T14:00:00.000Z"); // 19:30 IST
    expect(snoozeOptions(evening, IST)[2].label).toMatch(/^Tomorrow evening/);
  });

  it("resolves a known key and rejects an unknown one", () => {
    expect(resolveSnoozeOption("1h", AFTERNOON, IST)?.key).toBe("1h");
    expect(resolveSnoozeOption("next-year", AFTERNOON, IST)).toBeNull();
  });
});

describe("snooze cannot become a way of never deciding", () => {
  it("allows the first few", () => {
    expect(canSnooze(0).allowed).toBe(true);
    expect(canSnooze(MAX_SNOOZES - 1).allowed).toBe(true);
  });

  it("stops at the cap and says why", () => {
    const result = canSnooze(MAX_SNOOZES);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/needs a decision/i);
  });
});

describe("tile visibility", () => {
  it("shows a tile that was never snoozed", () => {
    expect(isTileVisible({}, AFTERNOON)).toBe(true);
    expect(isTileVisible({ snoozedUntil: null }, AFTERNOON)).toBe(true);
  });

  it("hides one that is still snoozed", () => {
    const until = new Date(AFTERNOON.getTime() + 60_000);
    expect(isTileVisible({ snoozedUntil: until }, AFTERNOON)).toBe(false);
  });

  it("brings it back the moment the snooze runs out", () => {
    expect(isTileVisible({ snoozedUntil: AFTERNOON }, AFTERNOON)).toBe(true);
  });
});

// ------------------------------------------------------------------ audience

const candidate = (
  over: Partial<AudienceCandidate> & { userId: string },
): AudienceCandidate => ({
  membershipId: `m-${over.userId}`,
  displayName: over.userId,
  canDecide: true,
  isDepartmentHead: false,
  ...over,
});

describe("who gets asked", () => {
  it("reaches admins and the department head", () => {
    const recipients = resolveAudience({
      candidates: [
        candidate({ userId: "admin" }),
        candidate({ userId: "head", isDepartmentHead: true }),
      ],
      departmentName: "Dispatch",
    });
    expect(recipients.map((r) => r.userId).sort()).toEqual(["admin", "head"]);
  });

  it("tells the head why it reached them", () => {
    const [first] = resolveAudience({
      candidates: [candidate({ userId: "head", isDepartmentHead: true })],
      departmentName: "Dispatch",
    });
    expect(first.reason).toBe("You are the head of Dispatch.");
  });

  it("gives an admin a reason too", () => {
    const [first] = resolveAudience({
      candidates: [candidate({ userId: "admin" })],
    });
    expect(first.reason).toMatch(/approvals for this company/i);
  });

  it("never asks the person who raised it", () => {
    const recipients = resolveAudience({
      candidates: [candidate({ userId: "admin" }), candidate({ userId: "raiser" })],
      actorUserId: "raiser",
    });
    expect(recipients.map((r) => r.userId)).toEqual(["admin"]);
  });

  it("never asks the person it is about, even if they run the department", () => {
    const recipients = resolveAudience({
      candidates: [
        candidate({ userId: "admin" }),
        candidate({ userId: "head", isDepartmentHead: true }),
      ],
      aboutUserId: "head",
      departmentName: "Dispatch",
    });
    expect(recipients.map((r) => r.userId)).toEqual(["admin"]);
  });

  it("skips someone whose role cannot act, so no button fails when pressed", () => {
    const recipients = resolveAudience({
      candidates: [
        candidate({ userId: "admin" }),
        candidate({ userId: "head", isDepartmentHead: true, canDecide: false }),
      ],
      departmentName: "Dispatch",
    });
    expect(recipients.map((r) => r.userId)).toEqual(["admin"]);
  });

  it("asks a person once, with the head reason winning", () => {
    const recipients = resolveAudience({
      candidates: [
        candidate({ userId: "both" }),
        candidate({ userId: "both", isDepartmentHead: true }),
      ],
      departmentName: "Dispatch",
    });
    expect(recipients).toHaveLength(1);
    expect(recipients[0].reason).toBe("You are the head of Dispatch.");
  });

  it("returns nobody rather than guessing when there is no one able to act", () => {
    expect(
      resolveAudience({
        candidates: [candidate({ userId: "a", canDecide: false })],
      }),
    ).toEqual([]);
  });

  it("falls back to the generic reason when the department has no name", () => {
    const [first] = resolveAudience({
      candidates: [candidate({ userId: "head", isDepartmentHead: true })],
    });
    expect(first.reason).toMatch(/approvals for this company/i);
  });
});

describe("the owner is told when a head cannot act", () => {
  it("flags a department with no head", () => {
    expect(
      describeHeadGap({
        departmentName: "Dispatch",
        headName: null,
        headCanDecideAnything: false,
      }),
    ).toMatch(/no head.*admins only/i);
  });

  it("flags a head whose role approves nothing", () => {
    const message = describeHeadGap({
      departmentName: "Dispatch",
      headName: "Meera",
      headCanDecideAnything: false,
    });
    expect(message).toMatch(/Meera/);
    expect(message).toMatch(/change their role/i);
  });

  it("says nothing when the head can act", () => {
    expect(
      describeHeadGap({
        departmentName: "Dispatch",
        headName: "Meera",
        headCanDecideAnything: true,
      }),
    ).toBeNull();
  });
});

describe("action kinds", () => {
  it("has a deciding permission for every kind", () => {
    for (const kind of ACTION_KINDS) {
      expect(DECIDING_PERMISSION[kind]).toBeTruthy();
    }
  });

  it("does not raise tiles for ordinary check-ins", () => {
    expect(ACTION_KINDS).not.toContain("CHECK_IN");
    expect(isActionKind("CHECK_IN")).toBe(false);
  });

  it("offers no inline approval on an invitation — it is chased, not judged", () => {
    expect(APPROVE_INLINE.EMPLOYEE_INVITE.allowed).toBe(false);
  });

  it("refuses one-tap approval of leave, because paid-or-unpaid is the decision", () => {
    expect(APPROVE_INLINE.LEAVE_REQUEST.allowed).toBe(false);
    expect(APPROVE_INLINE.LEAVE_REQUEST.because).toMatch(/paid or unpaid/i);
  });

  it("allows one tap where approving needs nothing further", () => {
    expect(APPROVE_INLINE.ATTENDANCE_EXCEPTION.allowed).toBe(true);
    expect(APPROVE_INLINE.TASK_PROOF.allowed).toBe(true);
  });

  it("explains every inline approval it withholds", () => {
    for (const kind of ACTION_KINDS) {
      if (!APPROVE_INLINE[kind].allowed) {
        expect(APPROVE_INLINE[kind].because).toBeTruthy();
      }
    }
  });

  it("names the button that leaves the tile for every kind", () => {
    for (const kind of ACTION_KINDS) {
      expect(openLabel(kind).length).toBeGreaterThan(0);
    }
  });

  it("recognises its own kinds", () => {
    for (const kind of ACTION_KINDS) expect(isActionKind(kind)).toBe(true);
  });
});
