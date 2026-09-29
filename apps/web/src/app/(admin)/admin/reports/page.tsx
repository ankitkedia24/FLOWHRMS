import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { evaluateAccess } from "@/lib/authz/flags";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportPanel } from "./ExportPanel";
import { loadBranchOptions } from "@/lib/branches/scope";

export const metadata: Metadata = { title: "Reports" };

/** Reports and export (screen A17). */
export default async function AdminReportsPage() {
  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "reports.view",
  });
  if (!decision.allowed) redirect("/unauthorized");

  const canExport = session.permissions.has("reports.export");
  const entitlements = await loadEntitlements(
    session.tenant.id,
    session.user.id,
  );
  const on = (module: "ATTENDANCE" | "LEAVE" | "TASKS") =>
    evaluateAccess({ session, entitlements, module }).allowed;

  const available = [
    on("ATTENDANCE") && {
      value: "attendance",
      label: "Attendance — daily records, hours and exceptions",
    },
    on("LEAVE") && { value: "leave", label: "Leave — requests and decisions" },
    on("TASKS") && { value: "tasks", label: "Tasks — assignments and outcomes" },
  ].filter(Boolean) as Array<{ value: string; label: string }>;

  const recentExports = devFixtureOffline()
    ? []
    : await getDb().auditEvent.findMany({
        where: { tenantId: session.tenant.id, action: "report.exported" },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { actor: true },
      });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-h1 text-text-primary">Reports</h1>

      <Alert variant="info" title="What an export contains">
        Exports include names, dates, times and hours. They do not include
        salary or bank details. Every export is recorded in the activity
        log with who exported it and when.
      </Alert>

      {available.length === 0 ? (
        <Card flush>
          <EmptyState
            title="No reports available."
            body="Turn on Attendance, Leave or Tasks to export their records."
          />
        </Card>
      ) : (
        <ExportPanel
          types={available}
          canExport={canExport}
          branches={await loadBranchOptions(session.tenant.id)}
        />
      )}

      <Card flush>
        <div className="p-5 pb-0">
          <CardHeader title="Recent exports" />
        </div>
        {recentExports.length === 0 ? (
          <EmptyState
            title="No exports yet."
            body="Exports you run will be listed here and in the activity log."
          />
        ) : (
          <ul className="flex flex-col p-5 pt-0">
            {recentExports.map((event) => {
              const meta = event.metadata as {
                type?: string;
                from?: string;
                to?: string;
                rows?: number;
              } | null;
              return (
                <li
                  key={event.id}
                  className="border-b border-border-subtle py-2.5 last:border-0"
                >
                  <p className="text-body text-text-primary">
                    {meta?.type ?? "Report"} · {meta?.from} to {meta?.to} ·{" "}
                    {meta?.rows ?? 0} rows
                  </p>
                  <p className="font-mono text-mono text-text-tertiary uppercase">
                    {event.actor?.displayName ?? "System"} ·{" "}
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                      timeZone: session.tenant.timezone,
                    }).format(event.createdAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
