-- DPDP consent (27 Sept 2026): published notices, append-only consent
-- records with a hash chain, and data-rights requests. Additive only.

-- CreateEnum
CREATE TYPE "ConsentNoticeStatus" AS ENUM ('PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ConsentSubject" AS ENUM ('ACCOUNT_HOLDER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "ConsentAction" AS ENUM ('GRANTED', 'UPDATED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DataRequestType" AS ENUM ('ACCESS', 'CORRECTION', 'ERASURE', 'GRIEVANCE', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "consent_notices" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "ConsentNoticeStatus" NOT NULL DEFAULT 'PUBLISHED',
    "legalReviewed" BOOLEAN NOT NULL DEFAULT false,
    "legalReviewedAt" TIMESTAMP(3),
    "legalReviewedBy" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "noticeId" UUID NOT NULL,
    "noticeKey" TEXT NOT NULL,
    "noticeVersion" INTEGER NOT NULL,
    "noticeHash" TEXT NOT NULL,
    "userId" UUID,
    "email" TEXT NOT NULL,
    "tenantId" UUID,
    "tenantName" TEXT,
    "subject" "ConsentSubject" NOT NULL,
    "action" "ConsentAction" NOT NULL,
    "purposes" JSONB NOT NULL,
    "documents" JSONB,
    "method" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "prevHash" TEXT NOT NULL,
    "recordHash" TEXT NOT NULL,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_requests" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "email" TEXT NOT NULL,
    "tenantId" UUID,
    "tenantName" TEXT,
    "type" "DataRequestType" NOT NULL,
    "details" TEXT NOT NULL,
    "status" "DataRequestStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "response" TEXT,
    "handledById" UUID,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consent_notices_key_version_language_key" ON "consent_notices"("key", "version", "language");

-- CreateIndex
CREATE UNIQUE INDEX "consent_records_seq_key" ON "consent_records"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "consent_records_recordHash_key" ON "consent_records"("recordHash");

-- CreateIndex
CREATE INDEX "consent_records_email_idx" ON "consent_records"("email");

-- CreateIndex
CREATE INDEX "consent_records_userId_idx" ON "consent_records"("userId");

-- CreateIndex
CREATE INDEX "consent_records_tenantId_idx" ON "consent_records"("tenantId");

-- CreateIndex
CREATE INDEX "consent_records_noticeKey_noticeVersion_idx" ON "consent_records"("noticeKey", "noticeVersion");

-- CreateIndex
CREATE INDEX "data_requests_status_dueAt_idx" ON "data_requests"("status", "dueAt");

-- CreateIndex
CREATE INDEX "data_requests_email_idx" ON "data_requests"("email");

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "consent_notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------- protection
-- Consent records are evidence. The application never updates or deletes
-- them, and the database refuses to as well: an UPDATE, DELETE or TRUNCATE
-- raises. (Anyone with owner rights could drop the trigger — the hash
-- chain in recordHash/prevHash is what makes that visible afterwards.)

CREATE OR REPLACE FUNCTION "consent_records_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'consent_records is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "consent_records_no_update_delete"
  BEFORE UPDATE OR DELETE ON "consent_records"
  FOR EACH ROW EXECUTE FUNCTION "consent_records_append_only"();

CREATE TRIGGER "consent_records_no_truncate"
  BEFORE TRUNCATE ON "consent_records"
  FOR EACH STATEMENT EXECUTE FUNCTION "consent_records_append_only"();

-- A published notice's text is what a consent points at. Its words can
-- never change; only its status (published → retired) and the legal-review
-- flag may. Deleting one is refused too.
CREATE OR REPLACE FUNCTION "consent_notices_text_frozen"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'consent_notices cannot be deleted'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."key" IS DISTINCT FROM OLD."key"
     OR NEW."version" IS DISTINCT FROM OLD."version"
     OR NEW."language" IS DISTINCT FROM OLD."language"
     OR NEW."title" IS DISTINCT FROM OLD."title"
     OR NEW."body" IS DISTINCT FROM OLD."body"
     OR NEW."sha256" IS DISTINCT FROM OLD."sha256"
     OR NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt" THEN
    RAISE EXCEPTION 'a published notice cannot be changed; publish a new version'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "consent_notices_frozen"
  BEFORE UPDATE OR DELETE ON "consent_notices"
  FOR EACH ROW EXECUTE FUNCTION "consent_notices_text_frozen"();
