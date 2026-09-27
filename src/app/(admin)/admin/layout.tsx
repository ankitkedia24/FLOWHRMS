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
import { TrialBanner, type PlanNotice } from "@/components/shell/TrialBanner";
import { accessState } from "@/lib/billing/pricing";
import { canManageBilling } from "@/lib/billing/policy";
import { loadBranding } from "@/lib/branding/load";
import { SplashScreen } from "@/components/shell/SplashScreen";

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
      billing: canManageBilling(session),
      designations: session.permissions.has("employees.manage"),
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
  const branding = await loadBranding(session.tenant.id);

  const day = (at: Date) =>
    new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: session.tenant.timezone }).format(at);
  const access = accessState(session.tenant, new Date());
  const notice: PlanNotice | null =
    access.kind === "trial" && access.endsAt && access.daysLeft !== null
      ? { kind: "trial", daysLeft: access.daysLeft, endsLabel: day(access.endsAt) }
      : access.kind === "paid" && access.until && access.daysLeft !== null && access.daysLeft <= 7
        ? { kind: "renew_soon", daysLeft: access.daysLeft, untilLabel: day(access.until) }
        : access.kind === "grace"
          ? { kind: "grace", endedLabel: day(access.until), pausesLabel: day(access.pausesAt) }
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
        {branding.splash && (
          <SplashScreen
            src={branding.splash.url}
            mime={branding.splash.mime}
            storageKey={`fh-splash:${session.tenant.id}:${branding.splash.version}`}
          />
        )}
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
                logoUrl={branding.logoUrl}
                notificationCount={unread}
                nav={nav}
              />
              {(notice || needsVerification) && (
                <TrialBanner
                  notice={notice}
                  canPay={navInput.can.billing}
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
