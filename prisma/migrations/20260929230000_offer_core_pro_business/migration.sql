-- CORE / PRO / BUSINESS pricing, step 2 of 2: offer the new plans.
--
-- Apply only once the code that understands them (base price + included
-- employees + extra employees) is live — the build before it read
-- priceMonthly as a per-employee rate and would show ₹1,499 per employee.
UPDATE "billing_plans"
SET "active" = true, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" IN ('core', 'pro', 'business');
