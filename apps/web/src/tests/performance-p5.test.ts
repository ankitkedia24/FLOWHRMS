import { describe, expect, it } from "vitest";
import {
  canSendKudos,
  KUDOS_MAX_LENGTH,
  KUDOS_PER_SENDER_PER_WEEK,
} from "@/lib/performance/kudos";

const base = {
  sentThisWeek: 0,
  sentToThisPersonThisWeek: 0,
  toSelf: false,
  messageLength: 40,
};

describe("kudos rules", () => {
  it("a normal thank-you passes", () => {
    expect(canSendKudos(base).ok).toBe(true);
  });

  it("never to yourself", () => {
    expect(canSendKudos({ ...base, toSelf: true }).ok).toBe(false);
  });

  it("needs actual words, and not too many", () => {
    expect(canSendKudos({ ...base, messageLength: 2 }).ok).toBe(false);
    expect(canSendKudos({ ...base, messageLength: KUDOS_MAX_LENGTH + 1 }).ok).toBe(false);
    expect(canSendKudos({ ...base, messageLength: KUDOS_MAX_LENGTH }).ok).toBe(true);
  });

  it("one per recipient per week — the three cannot pile onto a favourite", () => {
    const check = canSendKudos({ ...base, sentToThisPersonThisWeek: 1 });
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("Spread it around");
  });

  it("three per sender per week, and the refusal says why the cap exists", () => {
    const check = canSendKudos({ ...base, sentThisWeek: KUDOS_PER_SENDER_PER_WEEK });
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("Scarcity");
  });

  it("the pair cap is checked before the weekly cap — the more specific answer wins", () => {
    const check = canSendKudos({
      ...base,
      sentThisWeek: KUDOS_PER_SENDER_PER_WEEK,
      sentToThisPersonThisWeek: 1,
    });
    expect(check.reason).toContain("already thanked");
  });
});
