-- Flowacord support login (lib/auth/support.ts, lib/platform/support-actions.ts):
-- a SUPPORT membership status (hidden from the company's lists and counts),
-- a "Flowacord support" identity per platform admin, and the sessions opened.
-- Additive. Rollback: DROP TABLE "support_sessions"; ALTER TABLE "users" DROP
-- COLUMN "supportOfUserId"; (an enum value can't be dropped; SUPPORT stays unused).
-- AlterEnum
ALTER TYPE "MembershipStatus" ADD VALUE 'SUPPORT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "supportOfUserId" UUID;

-- CreateTable
CREATE TABLE "support_sessions" (
    "id" UUID NOT NULL,
    "platformUserId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "supportMembershipId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "support_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_sessions_platformUserId_endedAt_idx" ON "support_sessions"("platformUserId", "endedAt");

-- CreateIndex
CREATE INDEX "support_sessions_tenantId_startedAt_idx" ON "support_sessions"("tenantId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_supportOfUserId_key" ON "users"("supportOfUserId");

-- AddForeignKey
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_supportMembershipId_fkey" FOREIGN KEY ("supportMembershipId") REFERENCES "tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Behind row-level security from the start (scripts/setup-rls.ts lists it).
ALTER TABLE "support_sessions" ENABLE ROW LEVEL SECURITY;
