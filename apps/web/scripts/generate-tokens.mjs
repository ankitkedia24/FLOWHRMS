/**
 * FlowHRMS design-token generator.
 *
 * Reads the approved token JSONs in design/tokens/ (copied verbatim from
 * FlowHRMS-Design-Handoff-v1/02-design-tokens/) and emits src/styles/tokens.css:
 *
 *   1. `:root` custom properties (light theme — the designed theme)
 *   2. `[data-theme="dark"]` overrides — colour block ONLY
 *   3. one `@media (min-width: 1024px)` block — typography sizes ONLY
 *   4. an `@theme inline` block that maps Tailwind v4 utilities onto the
 *      generated variables and wipes Tailwind's default palette so no
 *      off-token colour, radius or shadow utility exists.
 *
 * The JSON files are the single source of truth (design handoff §3). Never
 * edit tokens.css by hand — rerun `npm run tokens` instead.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokensDir = join(root, "design", "tokens");
const outFile = join(root, "src", "styles", "tokens.css");

const read = (name) =>
  JSON.parse(readFileSync(join(tokensDir, name), "utf8"));

const colors = read("colors.json").color;
const typography = read("typography.json").font;
const spacing = read("spacing.json");
const radius = read("radius.json").radius;
const shadows = read("shadows.json").shadow;
const breakpoints = read("breakpoints.json").breakpoint;
const motion = read("motion.json").motion;

/** camelCase → kebab-case, dots → hyphens (design handoff §3 mapping rule). */
const kebab = (s) =>
  s.replaceAll(".", "-").replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/* ---------------------------------------------------------------- colours */

const lightColors = [];
const darkColors = [];

function walkColors(node, path) {
  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === "object" && "value" in value) {
      const name = `--fh-color-${path.concat(key).map(kebab).join("-")}`;
      lightColors.push([name, value.value]);
      if ("dark" in value) darkColors.push([name, value.dark]);
    } else if (value && typeof value === "object") {
      walkColors(value, path.concat(key));
    }
  }
}
walkColors(colors, []);

// Derived state colours specified in 04-components/component-states.md §2
// (exact values from the approved matrix; missing from colors.json).
// Logged in DECISIONS.md entry D-P1-02.
const derived = [
  ["--fh-color-brand-primary-subtle-hover", "#E3DEFC", "#2F2C74"],
  ["--fh-color-brand-primary-subtle-active", "#D8D2FA", "#38348A"],
  ["--fh-color-border-strong-hover", "#B7BFD6", "#4A5280"],
];
for (const [name, light, dark] of derived) {
  lightColors.push([name, light]);
  darkColors.push([name, dark]);
}

/* ------------------------------------------------------------- typography */

const fontVars = [];
// Family stacks: next/font exposes CSS variables; the token stack is the
// metric-tolerant fallback required by 01-brand/typography.md §1.
fontVars.push([
  "--fh-font-family-heading",
  `var(--font-poppins), ${typography.family.heading.value.replace('"Poppins", ', "")}`,
]);
fontVars.push([
  "--fh-font-family-body",
  `var(--font-wix-madefor-text), ${typography.family.body.value.replace('"Wix Madefor Text", ', "")}`,
]);
fontVars.push([
  "--fh-font-family-mono",
  `var(--font-poppins), ${typography.family.mono.value.replace('"Poppins", ', "")}`,
]);
for (const [key, value] of Object.entries(typography.weight)) {
  fontVars.push([`--fh-font-weight-${kebab(key)}`, String(value.value)]);
}

const sizeMobile = [];
const sizeDesktop = [];
const sizeMeta = {}; // name → { weight, family, letterSpacing }
for (const [key, def] of Object.entries(typography.size)) {
  const name = kebab(key);
  sizeMobile.push([`--fh-font-size-${name}`, def.mobile]);
  sizeMobile.push([`--fh-line-height-${name}`, def.lineHeight.mobile]);
  sizeDesktop.push([`--fh-font-size-${name}`, def.desktop]);
  sizeDesktop.push([`--fh-line-height-${name}`, def.lineHeight.desktop]);
  sizeMeta[name] = {
    weight: def.weight,
    family: def.family,
    letterSpacing: def.letterSpacing,
  };
}

const trackingVars = Object.entries(typography.letterSpacing).map(
  ([key, def]) => [`--fh-tracking-${kebab(key)}`, def.value],
);

/* ------------------------------------------------- spacing / layout / touch */

const spaceVars = Object.entries(spacing.space).map(([step, px]) => [
  `--fh-space-${step}`,
  px,
]);

/** Layout values may reference space steps ("space.5") — resolve to var(). */
const resolveSpaceRef = (v) =>
  /^space\.\d+$/.test(v) ? `var(--fh-space-${v.split(".")[1]})` : v;

const layoutVars = Object.entries(spacing.layout).map(([key, v]) => [
  `--fh-layout-${kebab(key)}`,
  resolveSpaceRef(v),
]);
const touchVars = Object.entries(spacing.touchTarget).map(([key, v]) => [
  `--fh-touch-${kebab(key)}`,
  v,
]);

/* ------------------------------------------------------------ radius etc. */

const radiusVars = Object.entries(radius).map(([key, v]) => [
  `--fh-radius-${kebab(key)}`,
  v,
]);

const shadowVars = Object.entries(shadows)
  .filter(([, def]) => def && typeof def === "object" && "value" in def)
  .map(([key, def]) => [`--fh-shadow-${kebab(key)}`, def.value]);

const durationVars = Object.entries(motion.duration).map(([key, v]) => [
  `--fh-motion-duration-${kebab(key)}`,
  v,
]);
const easingVars = Object.entries(motion.easing).map(([key, v]) => [
  `--fh-motion-easing-${kebab(key)}`,
  v,
]);

const breakpointVars = Object.entries(breakpoints).map(([key, v]) => [
  `--fh-breakpoint-${key}`,
  v,
]);

/* ----------------------------------------------------------------- output */

const decl = (pairs, indent = "  ") =>
  pairs.map(([k, v]) => `${indent}${k}: ${v};`).join("\n");

const themeColorMap = lightColors
  .map(([name]) => `  ${name.replace("--fh-color-", "--color-")}: var(${name});`)
  .join("\n");

const themeTextMap = Object.entries(sizeMeta)
  .map(([name, meta]) => {
    const lines = [
      `  --text-${name}: var(--fh-font-size-${name});`,
      `  --text-${name}--line-height: var(--fh-line-height-${name});`,
      `  --text-${name}--font-weight: ${meta.weight};`,
    ];
    if (meta.letterSpacing) {
      lines.push(`  --text-${name}--letter-spacing: ${meta.letterSpacing};`);
    }
    return lines.join("\n");
  })
  .join("\n");

const themeRadiusMap = radiusVars
  .map(([name]) => `  ${name.replace("--fh-radius-", "--radius-")}: var(${name});`)
  .join("\n");

const themeShadowMap = shadowVars
  .map(([name]) => `  ${name.replace("--fh-shadow-", "--shadow-")}: var(${name});`)
  .join("\n");

const themeBreakpointMap = breakpointVars
  .map(([name, v]) => `  ${name.replace("--fh-breakpoint-", "--breakpoint-")}: ${v};`)
  .join("\n");

const themeEaseMap = easingVars
  .map(([name]) => `  ${name.replace("--fh-motion-easing-", "--ease-")}: var(${name});`)
  .join("\n");

const css = `/* AUTO-GENERATED by scripts/generate-tokens.mjs — do not edit.
 * Source of truth: design/tokens/*.json (FlowHRMS-Design-Handoff-v1).
 * Regenerate with: npm run tokens
 */

:root {
  /* ---- colour (light — the designed theme) ---- */
${decl(lightColors)}

  /* ---- typography ---- */
${decl(fontVars)}
${decl(trackingVars)}

  /* ---- type scale (mobile-first; desktop overrides at lg below) ---- */
${decl(sizeMobile)}

  /* ---- spacing / layout / touch targets ---- */
${decl(spaceVars)}
${decl(layoutVars)}
${decl(touchVars)}

  /* ---- radius ---- */
${decl(radiusVars)}

  /* ---- shadows ---- */
${decl(shadowVars)}

  /* ---- motion ---- */
${decl(durationVars)}
${decl(easingVars)}

  /* ---- breakpoints (informational; media queries cannot read vars) ---- */
${decl(breakpointVars)}
}

/* Dark mode: colour block ONLY (design handoff README §3). Light is primary. */
[data-theme="dark"] {
${decl(darkColors)}
}

/* Desktop type scale applies at breakpoint.lg — typography sizes ONLY. */
@media (min-width: 1024px) {
  :root {
${decl(sizeDesktop, "    ")}
  }
}

/* ------------------------------------------------------------------------
 * Tailwind v4 theme mapping.
 * Wipes the default palette/radius/shadow/type scales so the only
 * utilities that exist come from FlowHRMS tokens (no arbitrary design values).
 * --------------------------------------------------------------------- */
@theme inline {
  --color-*: initial;
${themeColorMap}
  /* Literal white: spec'd directly for danger/warm button text
     (component-specifications.md §1). Not a brand colour. */
  --color-white: #ffffff;

  --font-*: initial;
  --font-heading: var(--fh-font-family-heading);
  --font-body: var(--fh-font-family-body);
  --font-mono: var(--fh-font-family-mono);

  --text-*: initial;
${themeTextMap}

  --tracking-*: initial;
  --tracking-tight: var(--fh-tracking-tight);
  --tracking-normal: var(--fh-tracking-normal);
  --tracking-micro: var(--fh-tracking-micro);

  --radius-*: initial;
${themeRadiusMap}

  --shadow-*: initial;
${themeShadowMap}

  --breakpoint-*: initial;
${themeBreakpointMap}

  --ease-*: initial;
${themeEaseMap}

  /* 4px base — utility steps (p-4 = 16px) line up with space.* tokens. */
  --spacing-*: initial;
  --spacing: 4px;
}
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, css, "utf8");
console.log(
  `tokens.css written: ${lightColors.length} colours (${darkColors.length} dark), ` +
    `${Object.keys(sizeMeta).length} type sizes, ${spaceVars.length} space steps, ` +
    `${radiusVars.length} radii, ${shadowVars.length} shadows.`,
);
