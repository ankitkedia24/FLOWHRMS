import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Load .env.local
try {
  const envContent = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2]?.trim() || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  }
} catch (e) {
  console.error("Could not load .env.local", e);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await client.$connect();

    const leaves = await client.leaveRequest.findMany({
      include: {
        membership: {
          include: {
            user: { select: { displayName: true, email: true } },
            tenant: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`\n=== FOUND ${leaves.length} LEAVE RECORD(S) IN POSTGRESQL ===\n`);
    for (const r of leaves) {
      console.log({
        id: r.id,
        user: r.membership?.user?.displayName || "Unknown",
        email: r.membership?.user?.email || "Unknown",
        tenant: r.membership?.tenant?.name || "Unknown",
        type: r.type,
        startDate: r.startDate.toISOString().split("T")[0],
        endDate: r.endDate.toISOString().split("T")[0],
        days: r.unpaidDays,
        status: r.status,
        reason: r.reason,
        appliedAt: r.createdAt.toISOString(),
      });
    }
  } catch (err) {
    console.error("Error querying DB:", err);
  } finally {
    await client.$disconnect();
  }
}

main();
