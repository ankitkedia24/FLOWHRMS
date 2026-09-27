-- Self-serve 30-day trial (27 Sept 2026): plan and trial end on the company,
-- what the registrant told us, Flowacord-controlled module access, platform
-- settings, and email verification links. Additive only; existing companies
-- become INTERNAL and never expire.

-- CreateEnum
CREATE TYPE "TenantPlan" AS ENUM ('TRIAL', 'PAID', 'INTERNAL');

-- AlterTable
ALTER TABLE "tenant_module_settings" ADD COLUMN     "allowedByPlatform" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressCountry" TEXT,
ADD COLUMN     "addressPincode" TEXT,
ADD COLUMN     "addressState" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "ownerEmailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "plan" "TenantPlan" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN     "selfSignup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signupHeardFrom" TEXT,
ADD COLUMN     "signupRole" TEXT,
ADD COLUMN     "staffCount" INTEGER,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_verifications_tokenHash_key" ON "email_verifications"("tokenHash");

-- CreateIndex
CREATE INDEX "email_verifications_tenantId_idx" ON "email_verifications"("tenantId");

