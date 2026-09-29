import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { evaluateAccess } from "@/lib/authz/flags";
import { getPolicy, getPolicyVersion } from "@/lib/policies";
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
        Everyone sees updates inside FlowHRMS. Push, email, WhatsApp and SMS need
        a provider before they can be switched on — an unconfigured channel
        is shown as off and is never silently failed.
      </Alert>

      <NotificationMatrix
        version={version}
        policy={policy}
        available={{
          in_app: true,
          push: channelOn("push"),
          email: channelOn("email"),
          whatsapp: channelOn("whatsapp"),
          sms: channelOn("sms"),
        }}
      />
    </div>
  );
}
