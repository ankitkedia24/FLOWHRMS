import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const email = "rishabh17704@gmail.com";
const password = "flowacord2026";
const displayName = "Rishabh";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecret =
  process.env.SUPABASE_SECRET_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !supabaseSecret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DIRECT_URL or DATABASE_URL in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  console.log(`\n==================================================`);
  console.log(`FlowHRMS: Provisioning credentials for ${email}`);
  console.log(`==================================================\n`);

  // 1. Supabase Auth Account
  console.log(`1. Checking Supabase Auth for ${email}...`);
  let authUserId: string | null = null;

  // List existing users to check if user already exists
  const { data: userList, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Failed to list Supabase users:", listError.message);
  }

  const existingAuthUser = userList?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingAuthUser) {
    console.log(`   Found existing Supabase user with ID: ${existingAuthUser.id}`);
    const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(
      existingAuthUser.id,
      {
        password: password,
        email_confirm: true,
        user_metadata: { displayName },
      }
    );
    if (updateError) {
      console.error("   Failed to update Supabase password:", updateError.message);
      throw updateError;
    }
    authUserId = updated.user.id;
    console.log(`   Updated Supabase password successfully.`);
  } else {
    console.log(`   User not found in Supabase. Creating new Auth user...`);
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { displayName },
    });
    if (createError) {
      console.error("   Failed to create Supabase user:", createError.message);
      throw createError;
    }
    authUserId = created.user.id;
    console.log(`   Created new Supabase user with ID: ${authUserId}`);
  }

  // 2. Database User record
  console.log(`\n2. Syncing Prisma User record...`);
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {
      authUserId: authUserId,
      displayName: displayName,
      status: "ACTIVE",
      isPlatformAdmin: true,
    },
    create: {
      email: email.toLowerCase(),
      authUserId: authUserId,
      displayName: displayName,
      status: "ACTIVE",
      isPlatformAdmin: true,
    },
  });
  console.log(`   Prisma User ID: ${user.id}`);
  console.log(`   authUserId linked: ${user.authUserId}`);
  console.log(`   isPlatformAdmin: ${user.isPlatformAdmin}`);

  // 3. Find Tenants & Roles
  console.log(`\n3. Checking tenants in database...`);
  const tenants = await prisma.tenant.findMany({
    include: {
      roles: true,
      branches: true,
      shifts: true,
    },
  });

  if (tenants.length === 0) {
    console.log("   No tenants found! Please run npm run db:seed first.");
    return;
  }

  console.log(`   Found ${tenants.length} tenant(s).`);

  for (const tenant of tenants) {
    console.log(`\n   --- Tenant: "${tenant.name}" (${tenant.slug}) ---`);

    // Look for OWNER or SUPER_ADMIN or ADMIN role
    const ownerRole =
      tenant.roles.find((r) => r.key === "OWNER") ||
      tenant.roles.find((r) => r.key === "SUPER_ADMIN") ||
      tenant.roles.find((r) => r.key === "ADMIN") ||
      tenant.roles[0];

    if (!ownerRole) {
      console.log(`   No roles found for tenant ${tenant.name}. Skipping.`);
      continue;
    }

    const branch = tenant.branches[0] || null;
    const shift = tenant.shifts.find((s) => s.isDefault) || tenant.shifts[0] || null;

    const membership = await prisma.tenantMembership.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.id,
        },
      },
      update: {
        roleId: ownerRole.id,
        status: "ACTIVE",
        branchId: branch?.id ?? null,
        shiftId: shift?.id ?? null,
        canCheckInAtAnyBranch: true,
      },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        roleId: ownerRole.id,
        status: "ACTIVE",
        branchId: branch?.id ?? null,
        shiftId: shift?.id ?? null,
        canCheckInAtAnyBranch: true,
      },
      include: {
        role: true,
      },
    });

    console.log(`   Assigned Role: ${membership.role.name} (${membership.role.key})`);
    console.log(`   Membership Status: ${membership.status}`);
    console.log(`   Branch: ${branch?.name ?? "None"}`);
    console.log(`   Shift: ${shift?.name ?? "None"}`);
  }

  // 4. Audit Event
  await prisma.auditEvent.create({
    data: {
      tenantId: tenants[0]?.id ?? null,
      actorType: "SYSTEM",
      action: "credentials.seeded",
      entityType: "user",
      entityId: user.id,
      metadata: {
        email,
        authUserId,
        via: "scripts/seed-user-credentials.ts",
      },
    },
  });

  console.log(`\n==================================================`);
  console.log(` SUCCESS! Credentials seeded:`);
  console.log(` Email:    ${email}`);
  console.log(` Password: ${password}`);
  console.log(` Access:   Platform Admin + Tenant Owner`);
  console.log(` Login at: http://localhost:3000/sign-in`);
  console.log(`==================================================\n`);
}

main()
  .catch((e) => {
    console.error("Error seeding credentials:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
