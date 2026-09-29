-- Field visits, Phase 5 (FIELD-VISITS-MODULE.md §7): the monthly travel
-- allowance claim. Each person's vehicle (chosen once), and the evidence behind
-- a travel claim, fixed at submission beside the expense claim it belongs to.
--
-- Additive: one nullable column and one new table. RLS is applied by
-- scripts/setup-rls.ts, which owns the tenant-table list.

-- AlterTable
ALTER TABLE "tenant_memberships" ADD COLUMN     "fieldVehicleKey" TEXT;

-- CreateTable
CREATE TABLE "field_conveyances" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "vehicleKey" TEXT NOT NULL,
    "vehicleName" TEXT NOT NULL,
    "ratePerKm" DECIMAL(8,2) NOT NULL,
    "recordedKm" DECIMAL(10,1) NOT NULL,
    "estimatedKm" DECIMAL(10,1) NOT NULL,
    "claimedKm" DECIMAL(10,1) NOT NULL,
    "changeReason" TEXT,
    "tripsCounted" INTEGER NOT NULL,
    "tripsAwaiting" INTEGER NOT NULL,
    "tripsDeclined" INTEGER NOT NULL,
    "days" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_conveyances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "field_conveyances_claimId_key" ON "field_conveyances"("claimId");

-- CreateIndex
CREATE INDEX "field_conveyances_tenantId_membershipId_month_idx" ON "field_conveyances"("tenantId", "membershipId", "month");

-- AddForeignKey
ALTER TABLE "field_conveyances" ADD CONSTRAINT "field_conveyances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_conveyances" ADD CONSTRAINT "field_conveyances_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_conveyances" ADD CONSTRAINT "field_conveyances_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

