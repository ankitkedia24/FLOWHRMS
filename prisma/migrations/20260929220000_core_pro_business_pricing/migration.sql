-- CORE / PRO / BUSINESS pricing, step 1 of 2 (docs/md/PRICING_MIGRATION_PLAN.md).
--
-- A plan is now a base price that covers a number of active employees, plus
-- a price for each employee above that. priceMonthly / priceAnnual keep
-- their names and become the BASE price for a month / a year.
--
-- Additive, so the build still live when this is applied keeps working:
-- the new plans are created hidden, and the old ones are hidden too. With
-- no plan offered, the website shows the list built into whichever code is
-- live (old code: the old prices; new code: CORE/PRO/BUSINESS), and
-- /subscription says "plans are being updated" — online payment is not
-- open yet anyway. Step 2 (20260929230000) offers the new plans once the
-- new code is live.
--
-- On 29 Sept 2026 no company was on a paid plan and billing_payments was
-- empty (checked before writing this).

-- AlterTable: the payment keeps the price it was made at.
ALTER TABLE "billing_payments" ALTER COLUMN "rateRupees" DROP NOT NULL,
ADD COLUMN     "baseRupees" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "extraEmployees" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "extraRateRupees" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "includedEmployees" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "billing_plans" ADD COLUMN     "extraEmployeeAnnual" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "extraEmployeeMonthly" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "includedEmployees" INTEGER NOT NULL DEFAULT 0;

-- The per-employee plans stop being offered. Kept (hidden) so the record of
-- what was sold stays whole.
UPDATE "billing_plans"
SET "active" = false, "flagship" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" IN ('starter', 'operations', 'multi-branch');

-- The three public plans, hidden until step 2. Annual = 10 months (2 months
-- free) for the base and for each extra employee alike (owner, 29 Sept
-- 2026). Until the owner decides modules tier by tier, every plan unlocks
-- the old Starter set, and no bullet points are shown.
INSERT INTO "billing_plans" (
    "id", "key", "name", "target",
    "priceMonthly", "priceAnnual",
    "includedEmployees", "extraEmployeeMonthly", "extraEmployeeAnnual",
    "modules", "features", "flagship", "active", "sortOrder", "updatedAt"
) VALUES
  (gen_random_uuid(), 'core', 'CORE', 'Small businesses and first-time HRMS buyers',
   1499, 14990, 25, 49, 490,
   ARRAY['EMPLOYEES','ATTENDANCE','LEAVE','DAILY_REPORTING','NOTIFICATIONS'],
   '[]'::jsonb, false, false, 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'pro', 'PRO', 'Growing businesses and distributed teams',
   2999, 29990, 50, 59, 590,
   ARRAY['EMPLOYEES','ATTENDANCE','LEAVE','DAILY_REPORTING','NOTIFICATIONS'],
   '[]'::jsonb, true, false, 2, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'business', 'BUSINESS', 'Organisations with 100 or more employees',
   6999, 69990, 100, 49, 490,
   ARRAY['EMPLOYEES','ATTENDANCE','LEAVE','DAILY_REPORTING','NOTIFICATIONS'],
   '[]'::jsonb, false, false, 3, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- New trials get the same Starter set (owner, 29 Sept 2026): Payroll and
-- Tasks leave the trial package. Companies already on a trial keep what
-- they have — this only changes what the next sign-up starts with.
INSERT INTO "audit_events" ("id", "tenantId", "actorType", "action", "entityType", "entityId", "reason", "before", "after", "createdAt")
SELECT gen_random_uuid(), NULL, 'SYSTEM', 'platform.trial_settings_changed', 'platform_setting', 'trial',
       'CORE/PRO/BUSINESS pricing: new trials get the Starter set (owner decision, 29 Sept 2026)',
       s."value",
       jsonb_set(s."value", '{modules}', '["EMPLOYEES","ATTENDANCE","LEAVE","DAILY_REPORTING","NOTIFICATIONS"]'::jsonb),
       CURRENT_TIMESTAMP
FROM "platform_settings" s
WHERE s."key" = 'trial';

UPDATE "platform_settings"
SET "value" = jsonb_set("value", '{modules}', '["EMPLOYEES","ATTENDANCE","LEAVE","DAILY_REPORTING","NOTIFICATIONS"]'::jsonb),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'trial';
