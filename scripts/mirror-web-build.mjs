/**
 * Put the web app's build where Hostinger looks for it.
 *
 * Hostinger's Next.js hosting (Framework: Next.js, output directory `.next`)
 * checks for `.next` at the repository ROOT after `npm run build`, and then
 * runs Next itself from the root — it never calls our `npm start` (the
 * runtime log shows no "[flowhrms] starting" line). Since the monorepo
 * change the build lands in `apps/web/.next`, so the deploy failed with
 * "No output directory found after build" although the build succeeded.
 *
 * So after building, the root gets a copy of what `next start` needs:
 * - `.next`  — the build (its `cache` folder is left out: build-time only)
 * - `public` — the static files Next serves from the root
 *
 * The web app's config needs nothing at run time: its headers are compiled
 * into `.next/routes-manifest.json`, and `transpilePackages` is build-only.
 * Every web package is hoisted to the root `node_modules`, so a server
 * started at the root resolves the same modules as one started in apps/web.
 *
 * Both copies are git-ignored and rebuilt on every `npm run build`.
 */
import { cpSync, existsSync, rmSync } from "node:fs";
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
