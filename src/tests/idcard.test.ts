import { describe, expect, it } from "vitest";
import { cardSizeMm, defaultLayout, fieldText, normaliseLayout } from "@/lib/idcard/layout";
import { gifDurationSeconds } from "@/lib/media/duration";
import { mediaPathOk } from "@/lib/media/bucket";

describe("ID card layout", () => {
  it("prints at bank-card size", () => {
    expect(cardSizeMm("portrait")).toEqual({ w: 54, h: 85.6 });
    expect(cardSizeMm("landscape")).toEqual({ w: 85.6, h: 54 });
  });

  it("keeps the default photo square on the printed card", () => {
    for (const o of ["portrait", "landscape"] as const) {
      const { photo } = defaultLayout(o);
      const { w, h } = cardSizeMm(o);
      expect((photo.w / 100) * w).toBeCloseTo((photo.h / 100) * h, 0);
    }
  });

  it("clamps anything out of range and drops junk", () => {
    const l = normaliseLayout({
      orientation: "portrait",
      photo: { x: -20, y: 500, w: 0, h: "big", shape: "hexagon" },
      fields: { name: { size: 99, color: "red", align: "middle", prefix: "x".repeat(40) } },
    });
    expect(l.photo).toMatchObject({ x: 0, y: 95, w: 5, shape: "rounded" });
    expect(l.fields.name.size).toBe(15);
    expect(l.fields.name.color).toBe("#17163E");
    expect(l.fields.name.align).toBe("center");
    expect(l.fields.name.prefix).toHaveLength(24);
    expect(l.fields.designation).toEqual(defaultLayout("portrait").fields.designation);
  });

  it("falls back to the default for nothing at all", () => {
    expect(normaliseLayout(null)).toEqual(defaultLayout("portrait"));
    expect(normaliseLayout({ orientation: "landscape" })).toEqual(defaultLayout("landscape"));
  });

  it("prints a prefix only when there is a value", () => {
    const person = { name: "Ravi", designation: null, employeeCode: "STF001", department: null, bloodGroup: " ", phone: null };
    expect(fieldText(person, "employeeCode", defaultLayout().fields.employeeCode)).toBe("ID: STF001");
    expect(fieldText(person, "bloodGroup", defaultLayout().fields.bloodGroup)).toBeNull();
    expect(fieldText(person, "designation", defaultLayout().fields.designation)).toBeNull();
  });
});

describe("opening animation length", () => {
  const gif = (delays: number[]) => {
    const head = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0];
    const frames = delays.flatMap((d) => [0x21, 0xf9, 0x04, 0, d & 0xff, d >> 8, 0, 0, 0x2c]);
    return new Uint8Array([...head, ...frames, 0x3b]);
  };

  it("adds up the frame delays", () => {
    expect(gifDurationSeconds(gif([100, 150, 50]))).toBe(3);
    expect(gifDurationSeconds(gif([250, 250]))).toBe(5);
  });

  it("counts a 0 or 1 delay as a tenth of a second, as browsers show it", () => {
    expect(gifDurationSeconds(gif([0, 1, 10]))).toBeCloseTo(0.3);
  });

  it("rejects what isn't a GIF", () => {
    expect(gifDurationSeconds(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]))).toBeNull();
  });
});

describe("uploaded file paths", () => {
  const t = "11111111-2222-4333-8444-555555555555";

  it("accepts only this company's folder for that kind of file", () => {
    expect(mediaPathOk(`${t}/photos/123-abc.jpg`, t, "photos")).toBe(true);
    expect(mediaPathOk(`${t}/logo/123-abc.png`, t, "photos")).toBe(false);
    expect(mediaPathOk(`other/photos/123-abc.jpg`, t, "photos")).toBe(false);
    expect(mediaPathOk(`${t}/photos/../../x.jpg`, t, "photos")).toBe(false);
    expect(mediaPathOk(`${t}/photos/a/b.jpg`, t, "photos")).toBe(false);
    expect(mediaPathOk(42, t, "photos")).toBe(false);
  });
});
