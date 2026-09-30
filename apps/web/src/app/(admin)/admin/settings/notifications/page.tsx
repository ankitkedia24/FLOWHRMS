import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { evaluateAccess } from "@/lib/authz/flags";
import { getPolicy, getPolicyVersion } from "@/lib/policies";
import { notificationChannelStates } from "@/lib/notifications/channels";
import { Alert } from "@/components/ui/Alert";
import type { NotificationPolicy } from "@/lib/settings/constants";
import { NotificationMatrix } from "./NotificationMatrix";

export const metadata: Metadata = { title: "Notifications" };

/** Notification settings (screen A18): event × channel plus quiet hours. */
export default async function NotificationSettingsPage() {
  const { session, decision } = await checkAccess({
    module: "NOTIFICATIONS",
    permission: "settings.manage",
  });
  if (!decision.allowed) redirect("/unauthorized");

  const entitlements = await loadEntitlements(
    session.tenant.id,
    session.user.id,
  );
  const channelOn = (feature: string) =>
    evaluateAccess({
      session,
      entitlements,
      module: "NOTIFICATIONS",
      feature,
    }).allowed;

  const [policy, version] = await Promise.all([
    getPolicy<NotificationPolicy>(session.tenant.id, "notifications"),
    getPolicyVersion(session.tenant.id, "notifications"),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">
          Notifications
        </h1>
        <Link
          href="/admin/settings"
          className="text-label text-brand-primary underline-offset-2 hover:underline"
        >
          Company settings
        </Link>
      </div>

      <Alert variant="info" title="In-app notifications are always on">
        Everything appears in the app&apos;s notifications. Notifications by
        email, push, SMS and WhatsApp aren&apos;t available yet, so they
        can&apos;t be switched on. Account emails — invitations, email
        confirmation, password changes and payment receipts — are still sent.
      </Alert>

      <NotificationMatrix
        version={version}
        policy={policy}
        channels={notificationChannelStates(channelOn)}
      />
    </div>
  );
}
