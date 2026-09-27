-- One-time codes proving a sign-up's email and mobile, and when a user's
-- mobile was proven. Additive.

-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('EMAIL', 'SMS');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "signup_verifications" (
    "id" UUID NOT NULL,
    "channel" "ContactChannel" NOT NULL,
    "target" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signup_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signup_verifications_channel_target_createdAt_idx" ON "signup_verifications"("channel", "target", "createdAt");

-- CreateIndex
CREATE INDEX "signup_verifications_ipAddress_createdAt_idx" ON "signup_verifications"("ipAddress", "createdAt");

