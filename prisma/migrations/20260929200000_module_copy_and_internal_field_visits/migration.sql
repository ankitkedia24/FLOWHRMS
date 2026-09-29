-- Customers read these descriptions on Admin → Modules; they named the
-- internal spec files (EXPENSES-MODULE.md, FIELD-VISITS-MODULE.md).
UPDATE "modules"
SET "description" = 'Claims with receipts, approval, and a record of settlement. Works with or without Payroll.'
WHERE "key" = 'EXPENSES'
  AND "description" = 'Claims with receipts, approval, and a record of settlement. Works with or without Payroll (EXPENSES-MODULE.md).';

UPDATE "modules"
SET "description" = 'Going out, visits and the way back, recorded only at each tap — never continuous tracking. Road distance feeds travel claims.'
WHERE "key" = 'FIELD_VISITS'
  AND "description" = 'Going out, visits and the way back, recorded only at each tap — never continuous tracking. Road distance feeds travel claims (FIELD-VISITS-MODULE.md).';

-- 20260929090000_field_visits put Field visits out of every company's plan.
-- Flowacord's own companies (plan INTERNAL: the placeholder and the sample)
-- have every other optional module in their plan, so this one joins them.
-- Still switched off: each company turns it on itself. Trial and paid
-- companies are unchanged — Flowacord adds it to their plan from /platform.
UPDATE "tenant_module_settings" s
SET "allowedByPlatform" = true, "updatedAt" = now()
FROM "modules" m, "tenants" t
WHERE s."moduleId" = m."id"
  AND s."tenantId" = t."id"
  AND m."key" = 'FIELD_VISITS'
  AND t."plan" = 'INTERNAL'
  AND s."allowedByPlatform" = false;
