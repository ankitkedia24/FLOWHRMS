import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkAllRead } from "./MarkAllRead";

export const metadata: Metadata = { title: "Notifications" };

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}

function NotificationList({
  items,
  timeZone,
}: {
  items: NotificationItem[];
  timeZone: string;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <Card
            className={
              item.readAt ? undefined : "border-l-2 border-l-brand-primary"
            }
          >
            <p className="text-body font-semibold text-text-primary">
              {item.href ? (
                <Link
                  href={item.href}
                  className="underline-offset-2 hover:underline"
                >
                  {item.title}
                </Link>
              ) : (
                item.title
              )}
            </p>
            {item.body && (
              <p className="mt-0.5 text-secondary text-text-secondary">
                {item.body}
              </p>
            )}
            <p className="mt-1 font-mono text-mono text-text-tertiary uppercase">
              {new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                timeZone,
              }).format(item.createdAt)}
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** Notifications (screen E15), grouped today / earlier. */
export default async function NotificationsPage() {
  const session = await requireSession();

  const notifications = devFixtureOffline()
    ? []
    : await getDb().notification.findMany({
        where: { tenantId: session.tenant.id, userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

  const tz = session.tenant.timezone;
  const dayKey = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: tz,
    }).format(date);
  const todayKey = dayKey(new Date());

  const today = notifications.filter((n) => dayKey(n.createdAt) === todayKey);
  const earlier = notifications.filter((n) => dayKey(n.createdAt) !== todayKey);
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">
          Notifications
        </h1>
        {unread > 0 && <MarkAllRead />}
      </div>

      {notifications.length === 0 ? (
        <Card flush>
          <EmptyState
            warm
            title="Nothing new."
            body="Task, leave and payslip updates will show here."
          />
        </Card>
      ) : (
        <>
          {today.length > 0 && (
            <section aria-labelledby="today-notifications">
              <h2
                id="today-notifications"
                className="mb-3 font-heading text-h2 text-text-primary"
              >
                Today
              </h2>
              <NotificationList items={today} timeZone={tz} />
            </section>
          )}
          {earlier.length > 0 && (
            <section aria-labelledby="earlier-notifications">
              <h2
                id="earlier-notifications"
                className="mb-3 font-heading text-h2 text-text-primary"
              >
                Earlier
              </h2>
              <NotificationList items={earlier} timeZone={tz} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
