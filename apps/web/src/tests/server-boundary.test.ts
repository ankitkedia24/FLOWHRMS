import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A `"use server"` module may only export async functions.
 *
 * Exporting a VALUE from one and importing it into a client component
 * compiles cleanly — `tsc` sees a perfectly good array and lint does not
 * model the boundary — and then fails at render time with
 * `TypeError: x.map is not a function`, because what crosses the boundary
 * is a server reference rather than the value.
 *
 * That reached production: `/admin/settings` and
 * `/admin/settings/notifications` both 500'd because `TIMEZONES`,
 * `NOTIFICATION_EVENTS` and `NOTIFICATION_CHANNELS` were exported from
 * `settings/actions.ts`. Nothing in the build caught it; a real admin
 * opening the page did.
 *
 * This test is the check that was missing. Values shared with client
 * components belong in a plain module (see settings/constants.ts).
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

const serverActionFiles = walk(SRC).filter((file) => {
  const head = readFileSync(file, "utf8").slice(0, 200);
  return /^\s*["']use server["']/.test(head);
});

describe('"use server" modules export only async functions', () => {
  it("finds the server-action modules to check", () => {
    expect(serverActionFiles.length).toBeGreaterThan(0);
  });

  for (const file of serverActionFiles) {
    const relative = file.slice(SRC.length + 1).replace(/\\/g, "/");

    it(`${relative} exports no runtime values`, () => {
      const source = readFileSync(file, "utf8");
      const offenders: string[] = [];

      for (const line of source.split(/\r?\n/)) {
        // `export type` and `export interface` vanish at compile time and
        // are safe. Everything else that exports a binding is not.
        if (/^export\s+(type|interface)\b/.test(line)) continue;
        if (/^export\s+async\s+function\b/.test(line)) continue;
        if (/^export\s+(const|let|var|class)\b/.test(line)) offenders.push(line.trim());
        // A non-async exported function is also invalid in this context.
        if (/^export\s+function\b/.test(line)) offenders.push(line.trim());
      }

      expect(
        offenders,
        `${relative} exports a runtime value from a "use server" module. ` +
          `Move it to a plain module — importing it into a client component ` +
          `fails at render time, not at build time.`,
      ).toEqual([]);
    });
  }
});
