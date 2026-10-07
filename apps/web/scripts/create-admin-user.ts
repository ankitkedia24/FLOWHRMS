import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// 1. Load .env.local
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

const EMAIL = "codeschoolrp@gmail.com";
const PASSWORD = "flowacord@2026";
const DISPLAY_NAME = "CodeSchool Admin";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment.");
    process.exit(1);
  }

  if (!connectionString) {
    console.error("Missing DATABASE_URL / DIRECT_URL in environment.");
    process.exit(1);
  }

  console.log("Connecting to Supabase Auth & PostgreSQL database...");

  // 2. Initialize Supabase Admin Client
  const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3. Initialize Prisma Client
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await db.$connect();

    // 4. Create or update user in Supabase Auth
    console.log(`\n1️⃣ Checking Supabase Auth user for ${EMAIL}...`);
    let authUserId: string | null = null;

    const { data: usersList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) {
      console.warn("Could not list users from Supabase Auth:", listErr.message);
    }

    const existingAuthUser = usersList?.users?.find(
      (u) => u.email?.toLowerCase() === EMAIL.toLowerCase()
    );

    if (existingAuthUser) {
      console.log(`User already exists in Supabase Auth (ID: ${existingAuthUser.id}). Updating password and metadata...`);
      const { data: updatedUser, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        existingAuthUser.id,
        {
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { name: DISPLAY_NAME, role: "Owner" },
        }
      );
      if (updateErr) {
        console.error("Error updating Supabase user:", updateErr.message);
      } else {
        authUserId = updatedUser.user.id;
        console.log("✅ Supabase Auth user updated successfully!");
      }
    } else {
      console.log(`Creating new user in Supabase Auth...`);
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { name: DISPLAY_NAME, role: "Owner" },
      });

      if (createErr) {
        console.error("Error creating Supabase Auth user:", createErr.message);
      } else if (newUser.user) {
        authUserId = newUser.user.id;
        console.log(`✅ Supabase Auth user created! ID: ${authUserId}`);
      }
    }

    // 5. Query active tenant in PostgreSQL
    console.log(`\n2️⃣ Querying Tenants in PostgreSQL...`);
    const tenant = await db.tenant.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });

    if (!tenant) {
      console.error("No active tenant found in database!");
      process.exit(1);
    }
    console.log(`Using Tenant: "${tenant.name}" (${tenant.id})`);

    // 6. Query or create Owner/Admin role in that tenant
    console.log(`\n3️⃣ Querying Owner/Admin Role in Tenant...`);
    let role = await db.role.findFirst({
      where: {
        tenantId: tenant.id,
        key: { in: ["OWNER", "SUPER_ADMIN", "ADMIN"] },
      },
    });

    if (!role) {
      console.log("Creating default OWNER role for tenant...");
      role = await db.role.create({
        data: {
          tenantId: tenant.id,
          key: "OWNER",
          name: "Owner",
          description: "Full organization ownership and administrative rights",
          isSystem: true,
        },
      });
    }
    console.log(`Using Role: "${role.name}" (${role.key})`);

    // 7. Upsert User record in PostgreSQL
    console.log(`\n4️⃣ Upserting User in PostgreSQL...`);
    let dbUser = await db.user.findFirst({
      where: {
        OR: [
          { email: { equals: EMAIL, mode: "insensitive" } },
          ...(authUserId ? [{ authUserId }] : []),
        ],
      },
    });

    if (dbUser) {
      dbUser = await db.user.update({
        where: { id: dbUser.id },
        data: {
          displayName: DISPLAY_NAME,
          status: "ACTIVE",
          isPlatformAdmin: true,
          ...(authUserId ? { authUserId } : {}),
        },
      });
      console.log(`✅ Updated existing PostgreSQL User: ${dbUser.id}`);
    } else {
      dbUser = await db.user.create({
        data: {
          email: EMAIL,
          displayName: DISPLAY_NAME,
          authUserId: authUserId,
          status: "ACTIVE",
          isPlatformAdmin: true,
        },
      });
      console.log(`✅ Created new PostgreSQL User: ${dbUser.id}`);
    }

    // 8. Upsert TenantMembership record in PostgreSQL
    console.log(`\n5️⃣ Upserting TenantMembership in PostgreSQL...`);
    let membership = await db.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: dbUser.id,
        },
      },
    });

    if (membership) {
      membership = await db.tenantMembership.update({
        where: { id: membership.id },
        data: {
          roleId: role.id,
          status: "ACTIVE",
          canCheckInAtAnyBranch: true,
          designation: "Administrator / Owner",
        },
      });
      console.log(`✅ Updated TenantMembership: ${membership.id}`);
    } else {
      membership = await db.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId: dbUser.id,
          roleId: role.id,
          status: "ACTIVE",
          canCheckInAtAnyBranch: true,
          designation: "Administrator / Owner",
          employeeCode: "ADM-001",
        },
      });
      console.log(`✅ Created TenantMembership: ${membership.id}`);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 ADMIN USER CREATED SUCCESSFULLY!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📧 Email:        ${EMAIL}`);
    console.log(`🔑 Password:     ${PASSWORD}`);
    console.log(`👤 Name:         ${DISPLAY_NAME}`);
    console.log(`🏢 Organization: ${tenant.name}`);
    console.log(`🛡️ Role:         ${role.name} (${role.key})`);
    console.log(`🆔 User ID:      ${dbUser.id}`);
    console.log(`🆔 Supabase ID:  ${authUserId || "N/A"}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } catch (err) {
    console.error("Execution error:", err);
  } finally {
    await db.$disconnect();
  }
}

main();
