import { requireAdminArea } from "@/lib/authz/guard";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { enabledModuleKeys } from "@/lib/authz/flags";
import { unreadNotificationCount } from "@/lib/notifications";
import {
  adminConfigItems,
  adminCrossLinks,
  adminNavItems,
  platformCrossLinks,
} from "@/lib/shell/nav";
import { Sidebar } from "@/components/shell/Sidebar";
import { AdminTopBar } from "@/components/shell/TopBar";
import { ToastProvider } from "@/components/ui/Toast";
import { OfflineProvider } from "@/lib/offline/OfflineProvider";
import { AdminOfflineBar } from "@/components/offline/OfflineBar";
import { ActionQueueProvider } from "@/lib/actions/ActionQueueProvider";
import { ActionTiles } from "@/components/actions/ActionTiles";
import { TrialBanner } from "@/components/shell/TrialBanner";
import { trialDaysLeft } from "@/lib/signup/validate";

/**
 * Admin shell: cool surface, 240px sidebar (lg+) / 72px rail (md) / drawer
 * below md, top bar with the tenant name always visible (multi-tenant
 * safety). Entry requires the admin.access permission; each screen adds its
 * own module/permission guard — navigation only reflects those decisions.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminArea();
  const entitlements = await loadEntitlements(
    session.tenant.id,
    session.user.id,
  );
  const unread = await unreadNotificationCount(
    session.tenant.id,
    session.user.id,
  );

  const navInput = {
    enabledModules: enabledModuleKeys(entitlements),
    can: {
      modules: session.permissions.has("modules.manage"),
      roles: session.permissions.has("roles.manage"),
      settings: session.permissions.has("settings.manage"),
      audit: session.permissions.has("audit.view"),
    },
  };
  // An admin has attendance, leave and payslips of their own, and nothing
  // here pointed at them. The way back was the URL bar.
  const items = [
    ...adminNavItems(navInput),
    ...adminCrossLinks(),
    ...platformCrossLinks({ isPlatformAdmin: session.user.isPlatformAdmin }),
  ];
  const configItems = adminConfigItems(navInput);

  const trial =
    session.tenant.plan === "TRIAL" && session.tenant.trialEndsAt
      ? {
          daysLeft: trialDaysLeft(session.tenant.trialEndsAt, new Date()),
          endsLabel: new Intl.DateTimeFormat("en-IN", {
            day: "numeric",
            month: "short",
            timeZone: session.tenant.timezone,
          }).format(session.tenant.trialEndsAt),
        }
      : null;
  const needsVerification =
    session.tenant.selfSignup &&
    !session.tenant.ownerEmailVerifiedAt &&
    session.membership.roleKey === "OWNER";
  const nav = {
    items,
    configItems,
    userName: session.user.displayName,
    roleName: session.membership.roleName,
  };

  return (
    <div data-surface="admin" className="flex min-h-dvh">
      <ToastProvider>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface-default focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <Sidebar {...nav} label="Modules" />
        <OfflineProvider>
          <ActionQueueProvider enabled={session.source === "supabase"}>
            <div className="flex min-w-0 flex-1 flex-col">
              <AdminTopBar
                tenantName={session.tenant.name}
                notificationCount={unread}
                nav={nav}
              />
              {(trial || needsVerification) && (
                <TrialBanner
                  daysLeft={trial?.daysLeft ?? null}
                  endsLabel={trial?.endsLabel ?? null}
                  needsVerification={needsVerification}
                  email={session.user.email}
                />
              )}
              {/* Admin work is never queued — the bar says so plainly. */}
              <AdminOfflineBar />
              <main
                id="main"
                className="mx-auto w-full max-w-[var(--fh-layout-content-max-width)] flex-1 px-4 py-5 sm:px-5 lg:px-8"
              >
                {children}
              </main>
            </div>
            <ActionTiles />
          </ActionQueueProvider>
        </OfflineProvider>
      </ToastProvider>
    </div>
  );
}
