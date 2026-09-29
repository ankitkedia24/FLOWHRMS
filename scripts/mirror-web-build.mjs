/**
 * Put the web app's build where Hostinger looks for it.
 *
 * Hostinger's Next.js hosting (Framework: Next.js, output directory `.next`,
 * root `./`) does two things after `npm run build`, both at the repository
 * ROOT:
 * 1. checks that `.next` exists — since the monorepo change the build lands
 *    in `apps/web/.next`, so the deploy failed with "No output directory
 *    found after build" (29 Sept 2026);
 * 2. publishes the STANDALONE server ("Detected Next.js standalone server
 *    output") by running `server.js` at the top of `.next/standalone`. In a
 *    monorepo Next writes that server to `.next/standalone/apps/web/server.js`
 *    instead, so the next deploy failed with "Next.js build produced no
 *    standalone server or static output".
 *
 * So after building, the root gets:
 * - `.next`  — a copy of the build (its `cache` folder left out: build-only),
 *   including `standalone/`, completed below;
 * - `public` — a copy of the static files;
 * - `.next/standalone/server.js` — starts the real server in apps/web;
 * - `.next/standalone/apps/web/.next/static` and `…/apps/web/public` — the
 *   stylesheets, scripts and files the standalone server serves, which Next
 *   leaves for the host to copy (they are copied here so nothing depends on
 *   where Hostinger puts them).
 *
 * All of it is git-ignored and rebuilt on every `npm run build`.
 */
import { cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const web = join(root, "apps", "web");

function mirror(name, skip = () => false) {
  const from = join(web, name);
  const to = join(root, name);
  if (!existsSync(from)) {
    console.error(`[mirror] ${relative(root, from)} is missing — did the web build run?`);
    process.exit(1);
  }
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true, filter: (src) => !skip(relative(from, src)) });
  console.log(`[mirror] ${relative(root, from)} -> ${name}`);
}

mirror(".next", (rel) => rel === "cache" || rel.startsWith(`cache${sep}`));
mirror("public");

// The standalone server, laid out the way Hostinger expects.
const standalone = join(root, ".next", "standalone");
const appServer = join(standalone, "apps", "web", "server.js");
if (!existsSync(appServer)) {
  console.error(
    `[mirror] ${relative(root, appServer)} is missing — is output: "standalone" set in apps/web/next.config.ts?`,
  );
  process.exit(1);
}
cpSync(join(web, ".next", "static"), join(standalone, "apps", "web", ".next", "static"), { recursive: true });
cpSync(join(web, "public"), join(standalone, "apps", "web", "public"), { recursive: true });
writeFileSync(
  join(standalone, "server.js"),
  [
    "// Written by scripts/mirror-web-build.mjs. Hostinger starts server.js at the",
    "// top of the standalone output; in the monorepo, Next's server is apps/web/server.js.",
    'const path = require("node:path");',
    'process.chdir(path.join(__dirname, "apps", "web"));',
    'require("./apps/web/server.js");',
    "",
  ].join("\n"),
);
console.log("[mirror] .next/standalone/server.js -> apps/web/server.js (with static and public)");
