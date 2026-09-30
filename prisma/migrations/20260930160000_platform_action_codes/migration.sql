-- No platform admin can suspend a company or end its trial without a one-time
-- code emailed to info@flowacord.com (lib/platform/lockout-code.ts).
-- Additive: one enum, one table, no change to existing rows.
-- Rollback: DROP TABLE "platform_action_codes"; DROP TYPE "PlatformLockoutAction";
-- CreateEnum
CREATE TYPE "PlatformLockoutAction" AS ENUM ('SUSPEND', 'END_TRIAL');

-- CreateTable
CREATE TABLE "platform_action_codes" (
    "id" UUID NOT NULL,
    "action" "PlatformLockoutAction" NOT NULL,
    "tenantId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_action_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_action_codes_requestedById_createdAt_idx" ON "platform_action_codes"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "platform_action_codes_tenantId_createdAt_idx" ON "platform_action_codes"("tenantId", "createdAt");


-- Behind row-level security from the start, like every other table
-- (scripts/setup-rls.ts lists it too). The app connects as the owner.
ALTER TABLE "platform_action_codes" ENABLE ROW LEVEL SECURITY;
