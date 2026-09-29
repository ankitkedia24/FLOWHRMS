import type { Metadata } from "next";
import { describeAction, describeEntity } from "@/lib/activity-labels";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Activity log" };

/** Activity log (screen A23). Append-only: who / what / when / reason. */
export default async function AdminActivityPage() {
  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "audit.view",
  });
  if (!decision.allowed) redirect("/unauthorized");

  const events = devFixtureOffline()
    ? []
    : await getDb().auditEvent.findMany({
        where: { tenantId: session.tenant.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { actor: true },
      });

  const tz = session.tenant.timezone;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-h1 text-text-primary">Activity log</h1>

      <Alert variant="info" title="Audit events are immutable">
        Audit events cannot be edited or deleted. Every entry keeps who
        acted, what changed, when, and the reason given.
      </Alert>

      {events.length === 0 ? (
        <Card flush>
          <EmptyState
            title="No activity yet."
            body="Configuration changes, approvals and sensitive-data access will appear here."
          />
        </Card>
      ) : (
        <>
          {/* Mobile: stacked cards. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {events.map((event) => (
              <li key={event.id}>
                <Card>
                  <p className="text-body font-semibold text-text-primary">
                    {describeAction(event.action)}
                  </p>
                  <p className="text-secondary text-text-secondary">
                    {event.actor?.displayName ?? "System"} · {describeEntity(event.entityType)}
                  </p>
                  {event.reason && (
                    <p className="mt-1 text-secondary text-text-secondary">
                      Reason: {event.reason}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-mono text-text-tertiary uppercase">
                    {formatStamp(event.createdAt, tz)}
                  </p>
                </Card>
              </li>
            ))}
          </ul>

          {/* md+: table. */}
          <div className="hidden overflow-hidden rounded-surface-card border border-border-default bg-surface-default shadow-elevation-1 md:block">
            <table className="w-full border-collapse">
              <caption className="sr-only">Audit events, newest first</caption>
              <thead>
                <tr className="bg-surface-sunken">
                  <th scope="col" className="micro-label px-4 py-2.5 text-left text-text-tertiary">
                    When
                  </th>
                  <th scope="col" className="micro-label px-4 py-2.5 text-left text-text-tertiary">
                    Who
                  </th>
                  <th scope="col" className="micro-label px-4 py-2.5 text-left text-text-tertiary">
                    Action
                  </th>
                  <th scope="col" className="micro-label px-4 py-2.5 text-left text-text-tertiary">
                    Record
                  </th>
                  <th scope="col" className="micro-label px-4 py-2.5 text-left text-text-tertiary">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr
                    key={event.id}
                    className="border-t border-border-subtle hover:bg-surface-sunken"
                  >
                    <th
                      scope="row"
                      className="px-4 py-2.5 text-left font-mono text-data font-normal text-text-secondary tabular-nums"
                    >
                      {formatStamp(event.createdAt, tz)}
                    </th>
                    <td className="px-4 py-2.5 text-body">
                      {event.actor?.displayName ?? "System"}
                    </td>
                    <td className="px-4 py-2.5 text-body">{describeAction(event.action)}</td>
                    <td className="px-4 py-2.5 text-secondary text-text-secondary">
                      {describeEntity(event.entityType)}
                    </td>
                    <td className="px-4 py-2.5 text-secondary text-text-secondary">
                      {event.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function formatStamp(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(date);
}
