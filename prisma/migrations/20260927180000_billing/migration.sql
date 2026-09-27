-- Paid subscriptions: plans Flowacord edits, payments by Razorpay, GST
-- tax invoices numbered per financial year. Additive only.

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "BillingPaymentStatus" AS ENUM ('CREATED', 'PAID', 'FAILED');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "billingCity" TEXT,
ADD COLUMN     "billingCycle" "BillingCycle",
ADD COLUMN     "billingGstin" TEXT,
ADD COLUMN     "billingName" TEXT,
ADD COLUMN     "billingPincode" TEXT,
ADD COLUMN     "billingPlanId" UUID,
ADD COLUMN     "billingState" TEXT,
ADD COLUMN     "paidUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "billing_plans" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "priceMonthly" INTEGER NOT NULL,
    "priceAnnual" INTEGER NOT NULL,
    "modules" TEXT[],
    "features" JSONB NOT NULL,
    "flagship" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_payments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "tenantName" TEXT NOT NULL,
    "planId" UUID NOT NULL,
    "planKey" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "cycle" "BillingCycle" NOT NULL,
    "months" INTEGER NOT NULL,
    "employees" INTEGER NOT NULL,
    "rateRupees" INTEGER NOT NULL,
    "subtotalPaise" INTEGER NOT NULL,
    "cgstPaise" INTEGER NOT NULL DEFAULT 0,
    "sgstPaise" INTEGER NOT NULL DEFAULT 0,
    "igstPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL,
    "status" "BillingPaymentStatus" NOT NULL DEFAULT 'CREATED',
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "buyer" JSONB NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "invoiceNumber" TEXT,
    "invoice" JSONB,
    "failureReason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_counters" (
    "financialYear" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("financialYear")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_plans_key_key" ON "billing_plans"("key");

-- CreateIndex
CREATE UNIQUE INDEX "billing_payments_razorpayOrderId_key" ON "billing_payments"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_payments_razorpayPaymentId_key" ON "billing_payments"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_payments_invoiceNumber_key" ON "billing_payments"("invoiceNumber");

-- CreateIndex
CREATE INDEX "billing_payments_tenantId_createdAt_idx" ON "billing_payments"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "billing_payments_status_idx" ON "billing_payments"("status");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_billingPlanId_fkey" FOREIGN KEY ("billingPlanId") REFERENCES "billing_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- An issued tax invoice is a statutory record: once a payment has an
-- invoice number it can be neither changed nor deleted (CGST Rules r.46,
-- r.56). Unpaid orders stay editable so a failure can be recorded.
CREATE OR REPLACE FUNCTION billing_payments_freeze_invoice() RETURNS trigger AS $$
BEGIN
  IF OLD."invoiceNumber" IS NOT NULL THEN
    RAISE EXCEPTION 'billing_payments: invoice % is issued and cannot be %', OLD."invoiceNumber", lower(TG_OP);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_payments_freeze_invoice
  BEFORE UPDATE OR DELETE ON "billing_payments"
  FOR EACH ROW EXECUTE FUNCTION billing_payments_freeze_invoice();

-- The three published plans, as they were on the website. Flowacord edits
-- them in /platform/plans from here on.
INSERT INTO "billing_plans" ("id", "key", "name", "target", "priceMonthly", "priceAnnual", "modules", "features", "flagship", "active", "sortOrder", "updatedAt") VALUES
  (gen_random_uuid(), 'starter', 'Starter', 'Small shop / office teams', 49, 39,
   ARRAY['EMPLOYEES','ATTENDANCE','LEAVE','TASKS','DAILY_REPORTING','NOTIFICATIONS'],
   '[{"label":"Attendance"},{"label":"Tasks"},{"label":"Leave"},{"label":"Daily summary"}]'::jsonb,
   false, true, 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'operations', 'Operations', 'Warehouse, dispatch, delivery teams', 79, 69,
   ARRAY['EMPLOYEES','ATTENDANCE','LEAVE','TASKS','DAILY_REPORTING','NOTIFICATIONS','PAYROLL'],
   '[{"label":"Everything in Starter","strong":true},{"label":"Payroll inputs"},{"label":"Payslips"},{"label":"Reports & export"},{"label":"Module controls"}]'::jsonb,
   true, true, 2, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'multi-branch', 'Multi-Branch', 'Companies with multiple branches', 119, 99,
   ARRAY['EMPLOYEES','ATTENDANCE','LEAVE','TASKS','DAILY_REPORTING','NOTIFICATIONS','PAYROLL','PERFORMANCE'],
   '[{"label":"Everything in Operations","strong":true},{"label":"Branch-level review"},{"label":"Roles & permissions"},{"label":"Activity log"}]'::jsonb,
   false, true, 3, CURRENT_TIMESTAMP);
