-- Field visits, Phase 3 (FIELD-VISITS-MODULE.md §7): when each leg's road distance
-- was last asked for, so retries back off instead of hammering the Routes
-- API while it is down. Additive and nullable.

-- AlterTable
ALTER TABLE "field_legs" ADD COLUMN     "lastTriedAt" TIMESTAMP(3);

