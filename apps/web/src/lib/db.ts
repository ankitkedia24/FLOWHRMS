import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Lazy Prisma client singleton (survives Next.js dev-server hot reloads).
 * Lazy so that the dev preview session (fixture mode, SECURITY-NOTES.md)
 * can render the shell without a database configured. Uses the pooled
 * DATABASE_URL; migrations use DIRECT_URL via prisma.config.ts.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDb(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Configure .env.local (see SETUP.md) or use the dev preview session (SECURITY-NOTES.md).",
    );
  }
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  globalForPrisma.prisma = client;
  return client;
}

export function hasDatabaseConfig(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
