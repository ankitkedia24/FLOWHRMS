import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { AppSession } from "@/lib/auth/types";
import { CURRENT_DOCUMENTS, canonicalBody, type DocumentKey } from "./documents";
import {
  consentStatus,
  GENESIS_HASH,
  recordHash,
  sha256,
  requiredNoticeKeys,
  type ConsentStatus,
  type HashedConsentFields,
  type PurposeChoice,
} from "./chain";

/**
 * Writing and reading consent records. Everything that makes a record
 * evidence — the exact notice (by hash), the choices, the time, the IP and
 * device — is captured here on the server, never taken from the browser's
 * word for it.
 */

type Tx = Prisma.TransactionClient;

/** Serialises chain writes so two consents at once cannot fork the chain. */
const CHAIN_LOCK_ID = 72_001;

export class NoticeNotPublished extends Error {
  constructor(key: string) {
    super(
      `The ${key} notice has not been published. Run scripts/publish-notices.ts before accepting sign-ups.`,
    );
  }
}

/** The published row for the CURRENT version of a document. */
export async function publishedNotice(key: DocumentKey, db: Tx | ReturnType<typeof getDb> = getDb()) {
  const doc = CURRENT_DOCUMENTS[key];
  const row = await db.consentNotice.findUnique({
    where: {
      key_version_language: { key, version: doc.version, language: doc.language },
    },
  });
  if (!row || row.status !== "PUBLISHED") throw new NoticeNotPublished(key);
  // What the page showed (this build's text) must be what the record will
  // point at (the published text). The publish script refuses to change a
  // published version, so a mismatch means a deploy is ahead of publishing.
  if (sha256(canonicalBody(doc)) !== row.sha256) {
    throw new Error(
      `The ${key} notice in this build differs from the published v${doc.version}. Publish the new version before accepting consent.`,
    );
  }
  return row;
}

/** Where the request came from — recorded as part of the evidence. */
export async function requestMeta(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipAddress = forwarded || h.get("x-real-ip") || null;
  const userAgent = h.get("user-agent")?.slice(0, 400) ?? null;
  return { ipAddress, userAgent };
}

export interface ConsentEntry {
  noticeKey: DocumentKey;
  subject: "ACCOUNT_HOLDER" | "EMPLOYEE";
  action: "GRANTED" | "UPDATED" | "WITHDRAWN";
  purposes: PurposeChoice[];
  userId: string | null;
  email: string;
  tenantId: string | null;
  tenantName: string | null;
  method: string;
  ipAddress: string | null;
  userAgent: string | null;
  /** Link the Terms and Privacy Policy versions accepted alongside. */
  withDocuments?: DocumentKey[];
}

/**
 * Append records to the chain, in order, inside `tx`. Callers that create
 * the thing being consented to (a company, an account) pass their own
 * transaction, so the consent and the thing exist together or not at all.
 */
export async function appendConsents(tx: Tx, entries: ConsentEntry[]): Promise<string[]> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${CHAIN_LOCK_ID})::text`;
  const last = await tx.consentRecord.findFirst({
    orderBy: { seq: "desc" },
    select: { recordHash: true },
  });
  let prev = last?.recordHash ?? GENESIS_HASH;
  const ids: string[] = [];

  for (const entry of entries) {
    const notice = await publishedNotice(entry.noticeKey, tx);
    const documents: Record<string, { version: number; sha256: string }> | null =
      entry.withDocuments && entry.withDocuments.length > 0 ? {} : null;
    for (const key of entry.withDocuments ?? []) {
      const linked = await publishedNotice(key, tx);
      documents![key] = { version: linked.version, sha256: linked.sha256 };
    }

    const createdAt = new Date();
    const fields: HashedConsentFields = {
      noticeKey: notice.key,
      noticeVersion: notice.version,
      noticeHash: notice.sha256,
      userId: entry.userId,
      email: entry.email.toLowerCase(),
      tenantId: entry.tenantId,
      tenantName: entry.tenantName,
      subject: entry.subject,
      action: entry.action,
      purposes: entry.purposes,
      documents,
      method: entry.method,
      language: notice.language,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      createdAt: createdAt.toISOString(),
    };
    const hash = recordHash(prev, fields);

    const row = await tx.consentRecord.create({
      data: {
        noticeId: notice.id,
        noticeKey: fields.noticeKey,
        noticeVersion: fields.noticeVersion,
        noticeHash: fields.noticeHash,
        userId: fields.userId,
        email: fields.email,
        tenantId: fields.tenantId,
        tenantName: fields.tenantName,
        subject: fields.subject,
        action: fields.action,
        purposes: fields.purposes as unknown as Prisma.InputJsonValue,
        documents: (documents ?? undefined) as Prisma.InputJsonValue | undefined,
        method: fields.method,
        language: fields.language,
        ipAddress: fields.ipAddress,
        userAgent: fields.userAgent,
        createdAt,
        prevHash: prev,
        recordHash: hash,
      },
      select: { id: true },
    });
    ids.push(row.id);
    prev = hash;
  }
  return ids;
}

/** Same, in a transaction of its own. */
export async function recordConsents(entries: ConsentEntry[]): Promise<string[]> {
  return getDb().$transaction((tx) => appendConsents(tx, entries), {
    timeout: 15_000,
    maxWait: 10_000,
  });
}

export interface NoticeStanding {
  key: DocumentKey;
  currentVersion: number;
  status: ConsentStatus;
}

/** Where a person stands on every notice that applies to them. */
export async function consentStandings(
  userId: string,
  keys: readonly DocumentKey[],
): Promise<NoticeStanding[]> {
  const records = await getDb().consentRecord.findMany({
    where: { userId, noticeKey: { in: [...keys] } },
    select: {
      noticeKey: true,
      noticeVersion: true,
      action: true,
      createdAt: true,
      seq: true,
      purposes: true,
    },
  });
  return keys.map((key) => {
    const currentVersion = CURRENT_DOCUMENTS[key].version;
    return {
      key,
      currentVersion,
      status: consentStatus(
        records.filter((r) => r.noticeKey === key),
        currentVersion,
      ),
    };
  });
}

/**
 * The notices this signed-in person still has to accept, or [] when they
 * are up to date. Cached per request: the guard asks on every page.
 */
export const outstandingNotices = cache(
  async (session: AppSession): Promise<DocumentKey[]> => {
    if (session.source !== "supabase") return [];
    const keys = requiredNoticeKeys({
      isOwner: session.membership.roleKey === "OWNER",
    });
    const standings = await consentStandings(session.user.id, keys);
    return standings.filter((s) => s.status.state !== "current").map((s) => s.key);
  },
);
