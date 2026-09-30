import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The website may only promise what the product does (hardening batch 7).
 *
 * The use-case rail sold "Day plans" to field sales and "per-branch
 * cut-offs" to multi-branch owners. Neither exists: payroll runs are
 * company-wide, and a field day is tasks plus the optional Field visits
 * module. Each phrase below names a feature that is not built; if one gets
 * built, take it off this list in the same change.
 *
 * Comments are ignored — they may name a removed claim to explain why.
 */

const SRC = join(process.cwd(), "src");
const SURFACES = ["components/marketing", "app/(marketing)", "app/(home)"];

const NOT_BUILT = [
  /day[- ]plans?/i,
  /per[- ]branch cut[- ]?offs?/i,
  /task boards?/i,
  /shift swaps?/i,
  /auto[- ]?schedul/i,
  /route plan/i,
  /beat plan/i,
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** Source with block, JSX and line comments removed. */
function copyOnly(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const files = SURFACES.flatMap((dir) => walk(join(SRC, dir)));

describe("marketing copy", () => {
  it("finds the marketing surfaces to check", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    const relative = file.slice(SRC.length + 1).replace(/\\/g, "/");
    it(`${relative} promises nothing that isn't built`, () => {
      const copy = copyOnly(file);
      expect(NOT_BUILT.filter((claim) => claim.test(copy)).map(String)).toEqual([]);
    });
  }

  it("names Field visits as optional where it offers it", () => {
    const useCases = copyOnly(join(SRC, "components/marketing/UseCases.tsx"));
    expect(useCases).toMatch(/optional Field visits/);
  });
});
