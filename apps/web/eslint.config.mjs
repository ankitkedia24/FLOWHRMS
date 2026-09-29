import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Approved documents and design mockups — specifications, not code.
    "docs/**",
    // Design handoff bundles. These are vendor prototypes shipped as
    // reference (their own README says support.js must never ship), and
    // linting someone else's prototype runtime tells us nothing.
    // Generated Prisma client.
    "src/generated/**",
  ]),
]);

export default eslintConfig;
