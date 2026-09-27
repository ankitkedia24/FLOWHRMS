-- One "Designation" field instead of Role + free-text designation; employee
-- photo and blood group; company opening animation and ID card design; and
-- "Tenant Owner" / "Tenant Super Admin" become "Owner" / "Super Admin".
-- Additive, plus a backfill that changes nobody's access.

-- AlterTable
ALTER TABLE "tenant_memberships" ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "designationId" UUID,
ADD COLUMN     "photoPath" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "idCardBackgroundPath" TEXT,
ADD COLUMN     "idCardLayout" JSONB,
ADD COLUMN     "splashEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "splashMime" TEXT,
ADD COLUMN     "splashPath" TEXT;

-- CreateTable
CREATE TABLE "designations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "roleId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "designations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "designations_tenantId_isActive_idx" ON "designations"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "designations_tenantId_name_key" ON "designations"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designations" ADD CONSTRAINT "designations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designations" ADD CONSTRAINT "designations_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- "Tenant" meant nothing to a shop owner.
UPDATE "roles" SET "name" = 'Owner', "updatedAt" = CURRENT_TIMESTAMP
  WHERE "key" = 'OWNER' AND "name" = 'Tenant Owner';
UPDATE "roles" SET "name" = 'Super Admin', "updatedAt" = CURRENT_TIMESTAMP
  WHERE "key" = 'SUPER_ADMIN' AND "name" = 'Tenant Super Admin';

-- Backfill 1: every job title already in use becomes a designation, tied to
-- the access its holders have today. The same title held with two different
-- access levels becomes two designations, named apart by the access level.
WITH titles AS (
  SELECT DISTINCT m."tenantId", btrim(m."designation") AS title, m."roleId"
  FROM "tenant_memberships" m
  WHERE m."designation" IS NOT NULL AND btrim(m."designation") <> ''
),
ranked AS (
  SELECT t.*, count(*) OVER (PARTITION BY t."tenantId", t.title) AS clashes
  FROM titles t
)
INSERT INTO "designations" ("id", "tenantId", "name", "roleId", "updatedAt")
SELECT gen_random_uuid(), r."tenantId",
       CASE WHEN r.clashes > 1 THEN r.title || ' (' || ro."name" || ')' ELSE r.title END,
       r."roleId", CURRENT_TIMESTAMP
FROM ranked r JOIN "roles" ro ON ro."id" = r."roleId"
ON CONFLICT ("tenantId", "name") DO NOTHING;

-- Backfill 2: one designation per access level, named like it, so every
-- company starts with a usable list and people without a title have one.
INSERT INTO "designations" ("id", "tenantId", "name", "roleId", "updatedAt")
SELECT gen_random_uuid(), ro."tenantId", ro."name", ro."id", CURRENT_TIMESTAMP
FROM "roles" ro
ON CONFLICT ("tenantId", "name") DO NOTHING;

-- Link people to the designation matching their title and access…
UPDATE "tenant_memberships" m
SET "designationId" = d."id"
FROM "designations" d, "roles" ro
WHERE m."designationId" IS NULL
  AND ro."id" = m."roleId"
  AND d."tenantId" = m."tenantId"
  AND d."roleId" = m."roleId"
  AND m."designation" IS NOT NULL AND btrim(m."designation") <> ''
  AND (d."name" = btrim(m."designation") OR d."name" = btrim(m."designation") || ' (' || ro."name" || ')');

-- …and everyone else to the one named after their access level.
UPDATE "tenant_memberships" m
SET "designationId" = d."id"
FROM "designations" d, "roles" ro
WHERE m."designationId" IS NULL
  AND ro."id" = m."roleId"
  AND d."tenantId" = m."tenantId"
  AND d."roleId" = m."roleId"
  AND d."name" = ro."name";

-- The title shown everywhere follows the designation.
UPDATE "tenant_memberships" m
SET "designation" = d."name"
FROM "designations" d
WHERE m."designationId" = d."id" AND m."designation" IS DISTINCT FROM d."name";
