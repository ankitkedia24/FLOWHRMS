import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader } from "@/components/ui/Card";
import { checkDatabase } from "@/lib/platform/health";
import { LOCKOUT_WORDS } from "@/lib/platform/lockout-policy";
import { backupFreshness, lockoutCodeStatus } from "@/lib/platform/system-status";

export const metadata: Metadata = { title: "System" };

const DAY_MS = 86_400_000;

function fmt(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function mb(bytes: bigint | number): string {
  return `${(Number(bytes) / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Flowacord's view of FlowHRMS itself: is the database answering, what has
 * crashed on the live site, when the last backup was made and whether it
 * restored, every code asked for to lock a company out, and every support
 * session opened inside a company. Platform admins
 * only — no company sees any of this.
 */
export default async function PlatformSystemPage() {
  await requirePlatformAdmin();
  const db = getDb();
  const now = new Date();
  const since = new Date(now.getTime() - 30 * DAY_MS);

  const database = await checkDatabase();

  const [errors, backups, codes, supportSessions] = await Promise.all([
    db.platformError.findMany({ where: { lastSeenAt: { gte: since } }, orderBy: { lastSeenAt: "desc" }, take: 30 }),
    db.platformBackup.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    db.platformActionCode.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.supportSession.findMany({
      where: { OR: [{ startedAt: { gte: since } }, { endedAt: null }] },
      orderBy: { startedAt: "desc" },
      take: 30,
    }),
  ]);
  const [tenants, admins] = await Promise.all([
    db.tenant.findMany({
      where: { id: { in: [...new Set([...codes.map((c) => c.tenantId), ...supportSessions.map((s) => s.tenantId)])] } },
      select: { id: true, name: true },
    }),
    db.user.findMany({
      where: {
        id: { in: [...new Set([...codes.map((c) => c.requestedById), ...supportSessions.map((s) => s.platformUserId)])] },
      },
      select: { id: true, displayName: true },
    }),
  ]);
  const tenantName = new Map(tenants.map((t) => [t.id, t.name]));
  const adminName = new Map(admins.map((u) => [u.id, u.displayName]));
  const freshness = backupFreshness(backups[0]?.createdAt ?? null, now);
  const occurrences = errors.reduce((sum, e) => sum + e.count, 0);

  return (
    <>
      <h1 className="font-heading text-h1 text-text-primary">System</h1>
      <p className="mt-1 text-secondary text-text-secondary">
        FlowHRMS itself: health, crashes, backups and lockout codes. Only Flowacord sees this page.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Health" />
          {database.ok ? (
            <Alert variant="success" title={`The database answered in ${database.ms} ms.`} />
          ) : (
            <Alert variant="error" title="The database isn't answering.">
              Sign-ins and every page that reads data are failing. Check Supabase first.
            </Alert>
          )}
          <p className="mt-3 text-secondary text-text-secondary">
            The uptime monitor checks <span className="break-all font-mono">https://hrms.flowacord.com/api/health</span>{" "}
            every few minutes and alerts you when it stops answering (OPERATIONS.md → Monitoring).
          </p>
        </Card>

        <Card>
          <CardHeader title="Backups" />
          <Alert variant={freshness.tone} title={freshness.text} />
          <p className="mt-3 text-secondary text-text-secondary">
            Made on the office computer with <span className="font-mono">npm run backup --workspace=@flowhrms/web</span>,
            encrypted, and saved to Google Drive. Then{" "}
            <span className="font-mono">npm run backup-rehearse --workspace=@flowhrms/web</span> proves it restores.
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Crashes in the last 30 days"
          meta={
            errors.length
              ? `${errors.length} ${errors.length === 1 ? "kind" : "kinds"}, ${occurrences} ${occurrences === 1 ? "time" : "times"}`
              : undefined
          }
        />
        {errors.length === 0 ? (
          <p className="text-secondary text-text-secondary">No server errors on the live site in the last 30 days.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-body">
              <thead>
                <tr className="border-b border-border-default text-caption text-text-secondary">
                  <th className="py-2 pr-3 font-semibold">Last seen</th>
                  <th className="py-2 pr-3 font-semibold">Where</th>
                  <th className="py-2 pr-3 font-semibold">What</th>
                  <th className="py-2 text-right font-semibold">Times</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e) => (
                  <tr key={e.id} className="border-b border-border-subtle align-top last:border-0">
                    <td className="py-2 pr-3 font-mono text-secondary">{fmt(e.lastSeenAt)}</td>
                    <td className="py-2 pr-3">
                      <span className="break-all font-mono text-secondary">{e.route}</span>
                      <span className="block text-caption text-text-tertiary">
                        {e.method} · {e.kind} · first {fmt(e.firstSeenAt)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-secondary">{e.message}</td>
                    <td className="py-2 text-right font-mono">{e.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-caption text-text-tertiary">
          The first of each kind in an hour is emailed to info@flowacord.com. Email addresses and long numbers are
          removed from messages before they are kept.
        </p>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Backup history" />
        {backups.length === 0 ? (
          <p className="text-secondary text-text-secondary">No backup recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-body">
              <thead>
                <tr className="border-b border-border-default text-caption text-text-secondary">
                  <th className="py-2 pr-3 font-semibold">Made</th>
                  <th className="py-2 pr-3 font-semibold">What&apos;s in it</th>
                  <th className="py-2 pr-3 text-right font-semibold">Size</th>
                  <th className="py-2 font-semibold">Restore rehearsal</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => {
                  const counts = b.tableCounts as Record<string, number>;
                  const rows = Object.values(counts).reduce((a, n) => a + n, 0);
                  return (
                    <tr key={b.id} className="border-b border-border-subtle align-top last:border-0">
                      <td className="py-2 pr-3">
                        <span className="font-mono text-secondary">{fmt(b.createdAt)}</span>
                        <span className="block break-all text-caption text-text-tertiary">{b.fileName}</span>
                      </td>
                      <td className="py-2 pr-3 text-secondary">
                        {Object.keys(counts).length} tables, {rows} rows, {b.signIns} sign-ins, {b.fileCount} files
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">{mb(b.bytes)}</td>
                      <td className="py-2 text-secondary">
                        {!b.rehearsedAt ? (
                          <span className="text-text-tertiary">Not rehearsed</span>
                        ) : b.rehearsalOk ? (
                          <span className="text-text-primary">Passed {fmt(b.rehearsedAt)}</span>
                        ) : (
                          <span className="text-status-error">Problems {fmt(b.rehearsedAt)}: {b.rehearsalNote}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader title="Lockout codes in the last 30 days" />
        {codes.length === 0 ? (
          <p className="text-secondary text-text-secondary">
            Nobody has asked for a code to suspend a company or end a trial in the last 30 days.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-body">
              <thead>
                <tr className="border-b border-border-default text-caption text-text-secondary">
                  <th className="py-2 pr-3 font-semibold">Asked</th>
                  <th className="py-2 pr-3 font-semibold">Who</th>
                  <th className="py-2 pr-3 font-semibold">To</th>
                  <th className="py-2 pr-3 font-semibold">Why</th>
                  <th className="py-2 font-semibold">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-b border-border-subtle align-top last:border-0">
                    <td className="py-2 pr-3 font-mono text-secondary">{fmt(c.createdAt)}</td>
                    <td className="py-2 pr-3">{adminName.get(c.requestedById) ?? "A removed admin"}</td>
                    <td className="py-2 pr-3">
                      {LOCKOUT_WORDS[c.action].doing}{" "}
                      {tenantName.has(c.tenantId) ? (
                        <Link
                          href={`/platform/companies/${c.tenantId}`}
                          className="text-brand-primary underline-offset-2 hover:underline"
                        >
                          {tenantName.get(c.tenantId)}
                        </Link>
                      ) : (
                        "a deleted company"
                      )}
                    </td>
                    <td className="py-2 pr-3 text-secondary">{c.reason}</td>
                    <td className="py-2 text-secondary">{lockoutCodeStatus(c, now)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader title="Support sessions in the last 30 days" meta="Plus any still open. The company sees changes made as “Flowacord support”." />
        {supportSessions.length === 0 ? (
          <p className="text-secondary text-text-secondary">Nobody has opened a company as support in the last 30 days.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-body">
              <thead>
                <tr className="border-b border-border-default text-caption text-text-secondary">
                  <th className="py-2 pr-3 font-semibold">Opened</th>
                  <th className="py-2 pr-3 font-semibold">Who</th>
                  <th className="py-2 pr-3 font-semibold">Company</th>
                  <th className="py-2 font-semibold">Closed</th>
                </tr>
              </thead>
              <tbody>
                {supportSessions.map((s) => (
                  <tr key={s.id} className="border-b border-border-subtle align-top last:border-0">
                    <td className="py-2 pr-3 font-mono text-secondary">{fmt(s.startedAt)}</td>
                    <td className="py-2 pr-3">{adminName.get(s.platformUserId) ?? "A removed admin"}</td>
                    <td className="py-2 pr-3">
                      {tenantName.has(s.tenantId) ? (
                        <Link
                          href={`/platform/companies/${s.tenantId}`}
                          className="text-brand-primary underline-offset-2 hover:underline"
                        >
                          {tenantName.get(s.tenantId)}
                        </Link>
                      ) : (
                        "a deleted company"
                      )}
                    </td>
                    <td className="py-2 text-secondary">{s.endedAt ? fmt(s.endedAt) : "Still open"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
