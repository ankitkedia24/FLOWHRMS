import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// The Prisma CLI does not read Next.js env files by itself — load the same
// files the app uses (first match wins per variable).
loadEnv({ path: ["apps/web/.env.local", "apps/web/.env", ".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // The CLI (migrate/seed) talks to the DIRECT connection; the app uses
    // the pooled DATABASE_URL via the driver adapter in src/lib/db.ts
    // (Supabase: port 5432 direct / 6543 pooled). See SETUP.md.
    url: process.env.DIRECT_URL || "postgresql://postgres:postgres@localhost:5432/postgres",
  },
});
