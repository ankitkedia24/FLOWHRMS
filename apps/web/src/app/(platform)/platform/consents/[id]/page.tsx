import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/Card";
import { DocumentView } from "@/components/consent/DocumentView";
import { parseBody } from "@/lib/consent/documents";
import {
  fieldsFromRow,
  GENESIS_HASH,
  recordHash,
  sha256,
  type PurposeChoice,
} from "@/lib/consent/chain";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "Consent certificate" };

function when(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
    timeZoneName: "short",
  }).format(date);
}

/**
 * One consent record, laid out as a certificate that can be printed or
 * saved as PDF and handed over: who, when, from where, what they chose,
 * the exact notice they were shown, and the checks that prove the record
 * has not been altered.
 */
export default async function ConsentCertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const db = getDb();
  const record = await db.consentRecord.findUnique({
    where: { id },
    include: { notice: true },
  });
  if (!record) notFound();

  const previous = await db.consentRecord.findFirst({
    where: { seq: { lt: record.seq } },
    orderBy: { seq: "desc" },
    select: { recordHash: true },
  });

  const expectedPrev = previous?.recordHash ?? GENESIS_HASH;
  const linkOk = record.prevHash === expectedPrev;
  const hashOk = recordHash(record.prevHash, fieldsFromRow(record)) === record.recordHash;
  const noticeOk = sha256(record.notice.body) === record.noticeHash;
  const purposes = record.purposes as unknown as PurposeChoice[];
  const documents = record.documents as Record<string, { version: number; sha256: string }> | null;

  const checks = [
    { ok: noticeOk, label: "The notice text below matches the fingerprint stored in the record." },
    { ok: hashOk, label: "The record's contents match its own fingerprint (not altered)." },
    { ok: linkOk, label: "The record is linked to the one before it (nothing removed before it)." },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/platform/consents" className="text-label text-brand-primary underline-offset-2 hover:underline">
          ← Consent records
        </Link>
        <PrintButton />
      </div>

      <Card>
        <CardHeader title="Certificate of consent" meta={`Record #${record.seq} · ${record.id}`} />
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-[12rem_1fr]">
          <Row label="Person" value={record.email} />
          <Row label="Company" value={record.tenantName ?? "—"} />
          <Row label="Capacity" value={record.subject === "EMPLOYEE" ? "Employee" : "Account holder"} />
          <Row label="Action" value={record.action} />
          <Row label="Date and time" value={when(record.createdAt)} />
          <Row label="How given" value={record.method} />
          <Row label="IP address" value={record.ipAddress ?? "not available"} />
          <Row label="Device" value={record.userAgent ?? "not available"} />
          <Row label="Notice" value={`${record.notice.title} — ${record.noticeKey} version ${record.noticeVersion} (${record.language})`} />
          {documents &&
            Object.entries(documents).map(([key, d]) => (
              <Row key={key} label={`Also accepted: ${key}`} value={`version ${d.version} · ${d.sha256.slice(0, 16)}…`} />
            ))}
        </dl>

        <h3 className="mt-5 font-heading text-body-lg font-semibold text-text-primary">Choices</h3>
        <ul className="mt-2 flex flex-col gap-1 text-body">
          {purposes.map((p) => (
            <li key={p.key} className="flex gap-2">
              <span aria-hidden="true">{p.granted ? "✓" : "✗"}</span>
              <span>
                {p.label}{" "}
                <span className="text-caption text-text-tertiary">
                  ({p.required ? "required" : "optional"} · {p.granted ? "granted" : "not granted"})
                </span>
              </span>
            </li>
          ))}
        </ul>

        <h3 className="mt-5 font-heading text-body-lg font-semibold text-text-primary">Integrity checks</h3>
        <ul className="mt-2 flex flex-col gap-1 text-secondary">
          {checks.map((c) => (
            <li key={c.label} className={c.ok ? "text-status-success-text" : "text-status-error-text"}>
              {c.ok ? "✓" : "✗"} {c.label}
            </li>
          ))}
        </ul>
        <dl className="mt-3 grid gap-x-8 gap-y-1 break-all font-mono text-caption text-text-secondary sm:grid-cols-[12rem_1fr]">
          <dt>Notice fingerprint</dt>
          <dd>{record.noticeHash}</dd>
          <dt>Previous record</dt>
          <dd>{record.prevHash}</dd>
          <dt>This record</dt>
          <dd>{record.recordHash}</dd>
        </dl>
      </Card>

      <Card>
        <CardHeader title="The notice exactly as shown" meta={record.notice.legalReviewed ? "Legally reviewed" : "Draft pending legal review"} />
        <DocumentView doc={parseBody(record.notice.body)} headingLevel={3} compact />
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-secondary text-text-secondary">{label}</dt>
      <dd className="break-words text-body text-text-primary">{value}</dd>
    </>
  );
}
