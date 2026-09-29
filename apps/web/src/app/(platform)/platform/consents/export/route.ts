import { requirePlatformAdmin } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";

/**
 * Consent records as CSV or JSON, for a regulator, an auditor or the
 * customer themselves. Every field that the record's hash covers is
 * included, plus the hashes, so the export can be checked independently.
 */
export async function GET(request: Request) {
  await requirePlatformAdmin();
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "json" ? "json" : "csv";
  const q = (url.searchParams.get("q") ?? "").trim();

  const records = await getDb().consentRecord.findMany({
    where:
      q.length >= 2
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { tenantName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
    orderBy: { seq: "asc" },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `flowhrms-consent-records-${stamp}.${format}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };

  if (format === "json") {
    return new Response(JSON.stringify(records, null, 2), {
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const columns = [
    "seq", "id", "createdAt", "email", "userId", "tenantName", "tenantId",
    "subject", "action", "noticeKey", "noticeVersion", "noticeHash", "language",
    "method", "ipAddress", "userAgent", "purposes", "documents", "prevHash", "recordHash",
  ] as const;
  const cell = (value: unknown): string => {
    const text =
      value instanceof Date
        ? value.toISOString()
        : typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : String(value ?? "");
    // Quote everything; neutralise spreadsheet formulas.
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = [
    columns.join(","),
    ...records.map((r) => columns.map((c) => cell(r[c])).join(",")),
  ];
  return new Response(lines.join("\r\n"), {
    headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
  });
}
