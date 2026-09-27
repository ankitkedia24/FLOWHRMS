import { describe, expect, it } from "vitest";
import {
  OTP_PROOF_TTL_MS,
  OTP_RESEND_SECONDS,
  generateOtp,
  hashOtp,
  otpMatches,
  proofValid,
  resendWaitSeconds,
} from "@/lib/signup/otp";

describe("sign-up one-time codes", () => {
  it("are six digits, leading zeros kept", () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it("match only the right code for the right row", () => {
    const hash = hashOtp("row-1", "042913");
    expect(otpMatches("row-1", "042913", hash)).toBe(true);
    expect(otpMatches("row-1", " 042 913 ", hash)).toBe(true);
    expect(otpMatches("row-1", "042914", hash)).toBe(false);
    expect(otpMatches("row-2", "042913", hash)).toBe(false);
    expect(otpMatches("row-1", "42913", hash)).toBe(false);
    expect(otpMatches("row-1", "abcdef", hash)).toBe(false);
  });

  it("salt the hash with the row, so equal codes hash differently", () => {
    expect(hashOtp("a", "123456")).not.toBe(hashOtp("b", "123456"));
  });

  it("make you wait before resending", () => {
    const now = new Date("2026-09-28T10:00:30Z");
    expect(resendWaitSeconds(null, now)).toBe(0);
    expect(resendWaitSeconds(new Date("2026-09-28T10:00:20Z"), now)).toBe(OTP_RESEND_SECONDS - 10);
    expect(resendWaitSeconds(new Date("2026-09-28T09:59:00Z"), now)).toBe(0);
  });
});

describe("proof at sign-up", () => {
  const now = new Date("2026-09-28T10:00:00Z");
  const row = {
    channel: "EMAIL",
    target: "owner@shop.in",
    verifiedAt: new Date(now.getTime() - 60_000),
    usedAt: null as Date | null,
  };

  it("accepts a fresh, unused proof for the same address", () => {
    expect(proofValid(row, "EMAIL", "owner@shop.in", now)).toEqual({ ok: true });
  });

  it("refuses another address, another channel, unverified, used or stale proof", () => {
    expect(proofValid(null, "EMAIL", "owner@shop.in", now)).toEqual({ ok: false, reason: "missing" });
    expect(proofValid(row, "EMAIL", "other@shop.in", now)).toEqual({ ok: false, reason: "mismatch" });
    expect(proofValid(row, "SMS", "owner@shop.in", now)).toEqual({ ok: false, reason: "mismatch" });
    expect(proofValid({ ...row, verifiedAt: null }, "EMAIL", "owner@shop.in", now)).toEqual({ ok: false, reason: "unverified" });
    expect(proofValid({ ...row, usedAt: now }, "EMAIL", "owner@shop.in", now)).toEqual({ ok: false, reason: "used" });
    expect(
      proofValid({ ...row, verifiedAt: new Date(now.getTime() - OTP_PROOF_TTL_MS - 1) }, "EMAIL", "owner@shop.in", now),
    ).toEqual({ ok: false, reason: "expired" });
  });
});
