/**
 * Build the `.env` file to import into the host, from `.env.local`.
 *
 * Exists because Hostinger's environment-variable editor does not persist
 * edits (DEPLOY.md), so the only reliable path is importing a complete
 * file when the Web App is created. Retyping six values by hand into that
 * import is how placeholders and line breaks get in — hence a script.
 *
 * Prints the SHAPE of every value and never the value itself: host and
 * port for connection strings, prefix and length for keys. The output is
 * safe to paste into a chat or a ticket.
 *
 * Usage: npx tsx scripts/build-env-file.ts [--out .env.hostinger]
 */
import { config as loadEnv } from "dotenv";
import { writeFileSync } from "node:fs";

loadEnv({ path: [".env.local"], quiet: true });

const outPath =
  process.argv[process.argv.indexOf("--out") + 1] &&
  process.argv.includes("--out")
    ? process.argv[process.argv.indexOf("--out") + 1]
    : ".env.hostinger";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hrms.flowacord.com";

/** Everything the deployed app reads. Optional ones are skipped if unset. */
const SPEC: Array<{ key: string; required: boolean; value?: string }> = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", required: true },
  { key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", required: true },
  { key: "NEXT_PUBLIC_SITE_URL", required: true, value: SITE_URL },
  { key: "DATABASE_URL", required: true },
  { key: "DIRECT_URL", required: true },
  { key: "SUPABASE_SECRET_KEY", required: true },
  { key: "SMTP_HOST", required: false },
  { key: "SMTP_PORT", required: false },
  { key: "SMTP_USER", required: false },
  { key: "SMTP_PASSWORD", required: false },
  { key: "SMTP_FROM", required: false },
];

/** Describe a value without disclosing it. */
function describe(key: string, value: string): string {
  if (/^postgres/.test(value)) {
    try {
      const u = new URL(value);
      const mode = u.port === "6543" ? "transaction pooler" : u.port === "5432" ? "session pooler" : "?";
      return `${u.hostname.split(".")[0]}.… :${u.port} (${mode})`;
    } catch {
      return "UNPARSEABLE — this will fail";
    }
  }
  if (/KEY$|PASSWORD$/.test(key)) return `${value.slice(0, 10)}… (${value.length} chars)`;
  if (/^https?:\/\//.test(value)) return value;
  return value.length > 40 ? `${value.slice(0, 30)}… (${value.length} chars)` : value;
}

const resolved = SPEC.map((s) => ({
  ...s,
  actual: s.value ?? process.env[s.key] ?? "",
})).filter((s) => s.required || s.actual);

const missing = resolved.filter((s) => s.required && !s.actual).map((s) => s.key);
const placeholders = resolved.filter((s) => /^<.*>$/.test(s.actual.trim())).map((s) => s.key);
const suspicious = resolved.filter(
  (s) => /[\r\n]/.test(s.actual) || /^["']|["']$/.test(s.actual),
).map((s) => s.key);

console.log(`Reading .env.local → writing ${outPath}\n`);
for (const s of resolved) {
  const state = !s.actual ? "MISSING" : describe(s.key, s.actual);
  console.log(`  ${s.key.padEnd(38)} ${state}`);
}

const problems: string[] = [];
if (missing.length) problems.push(`missing: ${missing.join(", ")}`);
if (placeholders.length) problems.push(`still placeholder text: ${placeholders.join(", ")}`);
if (suspicious.length) problems.push(`quotes or line breaks: ${suspicious.join(", ")}`);

const smtp = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"].every((k) => process.env[k]);
console.log(`\nInvitation emails: ${smtp ? "configured" : "NOT configured — FlowHRMS will show a copyable link instead"}`);

if (problems.length) {
  console.error(`\nNOT WRITTEN:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}

writeFileSync(outPath, resolved.map((s) => `${s.key}=${s.actual}`).join("\n") + "\n", "utf8");
console.log(`\nWrote ${resolved.length} variables. Import this file when creating the Web App.`);
console.log("It is gitignored. Delete it once imported, or after rotating credentials.");
