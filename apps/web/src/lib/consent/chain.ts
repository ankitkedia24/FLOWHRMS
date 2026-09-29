import { createHash } from "node:crypto";
import type { ConsentDocument, DocumentKey, Purpose } from "./documents";

/**
 * Consent proof logic — pure, so the rules that decide whether someone has
 * given valid consent, and whether the record has been tampered with, are
 * tested rather than trusted.
 *
 * Each consent record stores the hash of the record before it (prevHash)
 * and its own hash over its content plus that link (recordHash). Altering,
 * removing or re-ordering any record changes every hash after it, so a
 * check over the chain shows exactly where it was broken. The database also
 * refuses updates and deletes outright (migration 20260927120000); the chain
 * is what makes it visible if that protection is ever bypassed.
 */

export const GENESIS_HASH = "0".repeat(64);

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export interface PurposeChoice {
  key: string;
  label: string;
  required: boolean;
  granted: boolean;
}

/** The fields a record's hash covers — everything that is evidence. */
export interface HashedConsentFields {
  noticeKey: string;
  noticeVersion: number;
  noticeHash: string;
  userId: string | null;
  email: string;
  tenantId: string | null;
  tenantName: string | null;
  subject: "ACCOUNT_HOLDER" | "EMPLOYEE";
  action: "GRANTED" | "UPDATED" | "WITHDRAWN";
  purposes: PurposeChoice[];
  documents: Record<string, { version: number; sha256: string }> | null;
  method: string;
  language: string;
  ipAddress: string | null;
  userAgent: string | null;
  /** ISO timestamp, set by the server — the record's own time. */
  createdAt: string;
}

/** Fixed field order, so the same record always hashes the same way. */
export function canonicalRecord(fields: HashedConsentFields): string {
  return JSON.stringify([
    fields.noticeKey,
    fields.noticeVersion,
    fields.noticeHash,
    fields.userId,
    fields.email,
    fields.tenantId,
    fields.tenantName,
    fields.subject,
    fields.action,
    fields.purposes.map((p) => [p.key, p.label, p.required, p.granted]),
    fields.documents
      ? Object.keys(fields.documents)
          .sort()
          .map((k) => [k, fields.documents![k].version, fields.documents![k].sha256])
      : null,
    fields.method,
    fields.language,
    fields.ipAddress,
    fields.userAgent,
    fields.createdAt,
  ]);
}

export function recordHash(prevHash: string, fields: HashedConsentFields): string {
  return sha256(`${prevHash}\n${canonicalRecord(fields)}`);
}

export type ChainCheck =
  | { ok: true; checked: number }
  | { ok: false; checked: number; brokenAtSeq: number; reason: string };

/** Walk records in `seq` order and confirm every link and every hash. */
export function verifyChain(
  records: ReadonlyArray<HashedConsentFields & { seq: number; prevHash: string; recordHash: string }>,
): ChainCheck {
  let expectedPrev = GENESIS_HASH;
  let checked = 0;
  for (const r of records) {
    if (r.prevHash !== expectedPrev) {
      return {
        ok: false,
        checked,
        brokenAtSeq: r.seq,
        reason: "Its link to the previous record does not match — a record before it was removed or changed.",
      };
    }
    if (recordHash(r.prevHash, r) !== r.recordHash) {
      return {
        ok: false,
        checked,
        brokenAtSeq: r.seq,
        reason: "Its contents do not match its hash — this record was changed after it was written.",
      };
    }
    expectedPrev = r.recordHash;
    checked += 1;
  }
  return { ok: true, checked };
}

/**
 * Turn ticked boxes into the purpose list recorded, refusing when a
 * required purpose is not granted. Consent under s.6 must be a clear
 * affirmative act for each specified purpose, so nothing is pre-ticked
 * server-side: only keys the person actually sent count as granted.
 */
export function choicesFor(
  doc: ConsentDocument,
  grantedKeys: readonly string[],
): { ok: true; choices: PurposeChoice[] } | { ok: false; missing: Purpose[] } {
  const granted = new Set(grantedKeys);
  const missing = doc.purposes.filter((p) => p.required && !granted.has(p.key));
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    choices: doc.purposes.map((p) => ({
      key: p.key,
      label: p.label,
      required: p.required,
      granted: granted.has(p.key),
    })),
  };
}

/** Which consent notices a person must hold, by how they use FlowHRMS. */
export function requiredNoticeKeys(input: { isOwner: boolean }): DocumentKey[] {
  // The owner registered the company: they consent for their own account
  // and confirm the company's responsibilities. Everyone else is staff,
  // and gets the employee notice. An owner is not asked to consent to
  // their own company's processing of their records.
  return input.isOwner ? ["account_holder", "customer_terms"] : ["employee"];
}

export type ConsentStatus =
  | { state: "current"; grantedAt: Date; version: number; choices: PurposeChoice[] }
  | { state: "outdated"; version: number }
  | { state: "withdrawn"; at: Date }
  | { state: "missing" };

/**
 * The status of one notice for one person, from their records for that key
 * (any order). The latest record wins: GRANTED or UPDATED at the current
 * version is valid; WITHDRAWN, or an older version, is not.
 */
export function consentStatus(
  records: ReadonlyArray<{
    noticeVersion: number;
    action: "GRANTED" | "UPDATED" | "WITHDRAWN";
    createdAt: Date;
    seq: number;
    purposes: unknown;
  }>,
  currentVersion: number,
): ConsentStatus {
  if (records.length === 0) return { state: "missing" };
  const latest = [...records].sort((a, b) => b.seq - a.seq)[0];
  if (latest.action === "WITHDRAWN") return { state: "withdrawn", at: latest.createdAt };
  if (latest.noticeVersion !== currentVersion) {
    return { state: "outdated", version: latest.noticeVersion };
  }
  return {
    state: "current",
    grantedAt: latest.createdAt,
    version: latest.noticeVersion,
    choices: (latest.purposes as PurposeChoice[]) ?? [],
  };
}

/** A stored record back into the fields its hash covers. */
export function fieldsFromRow(r: {
  noticeKey: string;
  noticeVersion: number;
  noticeHash: string;
  userId: string | null;
  email: string;
  tenantId: string | null;
  tenantName: string | null;
  subject: "ACCOUNT_HOLDER" | "EMPLOYEE";
  action: "GRANTED" | "UPDATED" | "WITHDRAWN";
  purposes: unknown;
  documents: unknown;
  method: string;
  language: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}): HashedConsentFields {
  return {
    noticeKey: r.noticeKey,
    noticeVersion: r.noticeVersion,
    noticeHash: r.noticeHash,
    userId: r.userId,
    email: r.email,
    tenantId: r.tenantId,
    tenantName: r.tenantName,
    subject: r.subject,
    action: r.action,
    purposes: r.purposes as PurposeChoice[],
    documents: (r.documents as HashedConsentFields["documents"]) ?? null,
    method: r.method,
    language: r.language,
    ipAddress: r.ipAddress,
    userAgent: r.userAgent,
    createdAt: r.createdAt.toISOString(),
  };
}
