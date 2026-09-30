-- Flowacord's own records for /platform/system: server errors on the live
-- site (lib/platform/errors.ts) and encrypted backups (scripts/backup.ts).
-- Additive: two new tables, no change to existing rows.
-- Rollback: DROP TABLE "platform_errors"; DROP TABLE "platform_backups";
-- CreateTable
CREATE TABLE "platform_errors" (
    "id" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "digest" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEmailedAt" TIMESTAMP(3),

    CONSTRAINT "platform_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_backups" (
    "id" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "bytes" BIGINT NOT NULL,
    "databaseBytes" BIGINT NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "tableCounts" JSONB NOT NULL,
    "signIns" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rehearsedAt" TIMESTAMP(3),
    "rehearsalOk" BOOLEAN,
    "rehearsalNote" TEXT,

    CONSTRAINT "platform_backups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_errors_fingerprint_key" ON "platform_errors"("fingerprint");

-- CreateIndex
CREATE INDEX "platform_errors_lastSeenAt_idx" ON "platform_errors"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "platform_backups_fileName_key" ON "platform_backups"("fileName");


-- Behind row-level security from the start (scripts/setup-rls.ts lists them).
ALTER TABLE "platform_errors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_backups" ENABLE ROW LEVEL SECURITY;
