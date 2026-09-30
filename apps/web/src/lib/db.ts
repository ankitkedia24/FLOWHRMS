import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Flowacord support works inside a company as a hidden SUPPORT member
 * (lib/auth/support.ts). It must never appear in the company's lists,
 * counts, billing, payroll, reports or notifications — so every read of
 * tenant memberships leaves it out, here, once, rather than in each of the
 * dozens of queries that list people. A query that names "SUPPORT" in its
 * filter sees it (the session loader); findUnique by id is never filtered.
 * Relation counts and includes (`_count: { memberships }`) are not covered:
 * those few places filter the status themselves.
 */
const HIDDEN_READS = ["findMany", "findFirst", "findFirstOrThrow", "count", "aggregate", "groupBy"] as const;
const NOT_SUPPORT = { status: { not: "SUPPORT" as const } };

export function withoutSupportMember<T extends { where?: unknown } | undefined>(args: T): T {
  const where = (args as { where?: unknown } | undefined)?.where;
  if (where && JSON.stringify(where).includes('"SUPPORT"')) return args;
  return { ...(args ?? {}), where: where ? { AND: [where, NOT_SUPPORT] } : NOT_SUPPORT } as T;
}

function hideSupportMembers(client: PrismaClient): PrismaClient {
  return client.$extends({
    name: "hide-support-members",
    query: {
      tenantMembership: Object.fromEntries(
        HIDDEN_READS.map((op) => [
          op,
          ({ args, query }: { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> }) =>
            query(withoutSupportMember(args)),
        ]),
      ),
    },
  }) as unknown as PrismaClient;
}

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
  const client = hideSupportMembers(
    new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    }),
  );
  globalForPrisma.prisma = client;
  return client;
}

export function hasDatabaseConfig(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
