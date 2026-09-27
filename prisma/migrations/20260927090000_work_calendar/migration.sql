-- Work calendar (27 Sept 2026): weekly offs and holidays no longer count as
-- absence. Additive only — no existing row changes meaning.

-- A person's own weekly off, replacing the company's when set.
ALTER TABLE "tenant_memberships"
  ADD COLUMN "hasOwnWeeklyOff" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "weeklyOffDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

-- The day split a payslip shows. Lines approved before this stay at 0 and
-- keep their original display.
ALTER TABLE "payroll_lines"
  ADD COLUMN "workingDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "weeklyOffDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "holidayDays" INTEGER NOT NULL DEFAULT 0;
