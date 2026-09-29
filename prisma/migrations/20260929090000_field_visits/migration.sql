-- Field visits, Phase 1 (FIELD-VISITS-MODULE.md §8; MODULES.md Amendment 4):
-- saved places, trips, visits and road legs; one new ActionRequestKind value
-- for the going-out approval tile; the module, its dependency on Attendance,
-- the `fieldvisits.view` permission with its default grants, and a
-- switched-off module setting for every company that already exists.
--
-- Additive: nothing existing is altered. RLS is applied by
-- scripts/setup-rls.ts, which owns the tenant-table list.

-- CreateEnum
CREATE TYPE "FieldTripApproval" AS ENUM ('NOT_NEEDED', 'PENDING', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "FieldTripEnd" AS ENUM ('BACK_AT_OFFICE', 'CHECKED_OUT', 'NOT_RECORDED');

-- CreateEnum
CREATE TYPE "FieldVisitEnd" AS ENUM ('ENDED', 'CHECKED_OUT', 'NOT_RECORDED', 'CORRECTED');

-- CreateEnum
CREATE TYPE "FieldLegMethod" AS ENUM ('ROAD', 'STRAIGHT');

-- CreateEnum
CREATE TYPE "FieldLegStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- AlterEnum
ALTER TYPE "ActionRequestKind" ADD VALUE 'FIELD_TRIP';

-- CreateTable
CREATE TABLE "field_places" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "address" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_trips" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "startedClientAt" TIMESTAMP(3),
    "startLat" DOUBLE PRECISION,
    "startLng" DOUBLE PRECISION,
    "startAccuracyM" DOUBLE PRECISION,
    "startEstimated" BOOLEAN NOT NULL DEFAULT false,
    "endedAt" TIMESTAMP(3),
    "endedClientAt" TIMESTAMP(3),
    "endLat" DOUBLE PRECISION,
    "endLng" DOUBLE PRECISION,
    "endAccuracyM" DOUBLE PRECISION,
    "endKind" "FieldTripEnd",
    "approval" "FieldTripApproval" NOT NULL DEFAULT 'NOT_NEEDED',
    "approvalDecidedById" UUID,
    "approvalDecidedAt" TIMESTAMP(3),
    "approvalReason" TEXT,
    "policyVersion" INTEGER NOT NULL,
    "offlineCaptured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_visits" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "placeId" UUID,
    "placeName" TEXT NOT NULL,
    "purposeKey" TEXT,
    "purposeName" TEXT,
    "arrivedAt" TIMESTAMP(3) NOT NULL,
    "arrivedClientAt" TIMESTAMP(3),
    "arriveLat" DOUBLE PRECISION,
    "arriveLng" DOUBLE PRECISION,
    "arriveAccuracyM" DOUBLE PRECISION,
    "distanceFromPlaceM" DOUBLE PRECISION,
    "isFar" BOOLEAN NOT NULL DEFAULT false,
    "leftAt" TIMESTAMP(3),
    "leftClientAt" TIMESTAMP(3),
    "leftLat" DOUBLE PRECISION,
    "leftLng" DOUBLE PRECISION,
    "leftAccuracyM" DOUBLE PRECISION,
    "endKind" "FieldVisitEnd",
    "note" TEXT,
    "photoPath" TEXT,
    "offlineCaptured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_legs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "fromLat" DOUBLE PRECISION NOT NULL,
    "fromLng" DOUBLE PRECISION NOT NULL,
    "fromAt" TIMESTAMP(3) NOT NULL,
    "toLat" DOUBLE PRECISION NOT NULL,
    "toLng" DOUBLE PRECISION NOT NULL,
    "toAt" TIMESTAMP(3) NOT NULL,
    "meters" INTEGER,
    "durationSeconds" INTEGER,
    "method" "FieldLegMethod",
    "status" "FieldLegStatus" NOT NULL DEFAULT 'PENDING',
    "polyline" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_legs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_places_tenantId_isActive_idx" ON "field_places"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "field_places_tenantId_nameKey_idx" ON "field_places"("tenantId", "nameKey");

-- CreateIndex
CREATE INDEX "field_trips_tenantId_membershipId_startedAt_idx" ON "field_trips"("tenantId", "membershipId", "startedAt");

-- CreateIndex
CREATE INDEX "field_trips_tenantId_startedAt_idx" ON "field_trips"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "field_trips_tenantId_approval_idx" ON "field_trips"("tenantId", "approval");

-- CreateIndex
CREATE INDEX "field_visits_tenantId_membershipId_arrivedAt_idx" ON "field_visits"("tenantId", "membershipId", "arrivedAt");

-- CreateIndex
CREATE INDEX "field_visits_tenantId_placeId_idx" ON "field_visits"("tenantId", "placeId");

-- CreateIndex
CREATE UNIQUE INDEX "field_visits_tripId_sequence_key" ON "field_visits"("tripId", "sequence");

-- CreateIndex
CREATE INDEX "field_legs_tenantId_status_idx" ON "field_legs"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "field_legs_tripId_sequence_key" ON "field_legs"("tripId", "sequence");

-- AddForeignKey
ALTER TABLE "field_places" ADD CONSTRAINT "field_places_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_trips" ADD CONSTRAINT "field_trips_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_trips" ADD CONSTRAINT "field_trips_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "tenant_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_trips" ADD CONSTRAINT "field_trips_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "attendance_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_visits" ADD CONSTRAINT "field_visits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_visits" ADD CONSTRAINT "field_visits_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "field_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_visits" ADD CONSTRAINT "field_visits_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "field_places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_legs" ADD CONSTRAINT "field_legs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_legs" ADD CONSTRAINT "field_legs_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "field_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Amendment 4: the catalog rows. New companies get them from the catalog at
-- provisioning (src/lib/platform/provision.ts); the seed upserts the same.
INSERT INTO "modules" ("id", "key", "name", "description", "category", "sortOrder")
VALUES (
    gen_random_uuid(),
    'FIELD_VISITS',
    'Field visits',
    'Going out, visits and the way back, recorded only at each tap — never continuous tracking. Road distance feeds travel claims (FIELD-VISITS-MODULE.md).',
    'OPTIONAL',
    160
)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "module_dependencies" ("id", "moduleId", "requiresModuleId", "anyOfGroup")
SELECT gen_random_uuid(), m."id", r."id", NULL
FROM "modules" m, "modules" r
WHERE m."key" = 'FIELD_VISITS' AND r."key" = 'ATTENDANCE'
ON CONFLICT ("moduleId", "requiresModuleId") DO NOTHING;

INSERT INTO "permissions" ("id", "key", "name", "isSensitive")
VALUES (gen_random_uuid(), 'fieldvisits.view', 'See everyone''s field visits', true)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."key" = 'fieldvisits.view'
WHERE r."isSystem" = true AND r."key" IN ('OWNER', 'SUPER_ADMIN', 'ADMIN')
ON CONFLICT DO NOTHING;

-- Optional modules are switched on by the FlowHRMS platform contact, which
-- needs a setting row to switch. Off, and not yet in anyone's plan.
INSERT INTO "tenant_module_settings" ("tenantId", "moduleId", "enabled", "allowedByPlatform", "updatedAt")
SELECT t."id", m."id", false, false, now()
FROM "tenants" t
CROSS JOIN "modules" m
WHERE m."key" = 'FIELD_VISITS'
ON CONFLICT DO NOTHING;
