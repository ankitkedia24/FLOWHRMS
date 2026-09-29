import { requireSession } from "@/lib/authz/guard";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { enabledModuleKeys } from "@/lib/authz/flags";
import { unreadNotificationCount } from "@/lib/notifications";
import {
  bottomBarItems,
  employeeCrossLinks,
  employeeNavItems,
} from "@/lib/shell/nav";
import { BottomNav } from "@/components/shell/BottomNav";
import { Sidebar } from "@/components/shell/Sidebar";
import { EmployeeTopBar } from "@/components/shell/TopBar";
import { SplashScreen } from "@/components/shell/SplashScreen";
import { cookies } from "next/headers";
import { SPLASH_COOKIE, splashAlreadySeen } from "@/lib/branding/splash";
import { loadBranding } from "@/lib/branding/load";
import { ToastProvider } from "@/components/ui/Toast";
import { OfflineProvider } from "@/lib/offline/OfflineProvider";
import { OfflineBar } from "@/components/offline/OfflineBar";
import { ActionQueueProvider } from "@/lib/actions/ActionQueueProvider";
import { ActionTiles } from "@/components/actions/ActionTiles";

/**
 * Employee shell: warm surface, top bar, bottom navigation on a phone and a
 * sidebar from md up — an employee on a laptop previously had no navigation
 * at all, because the bottom bar is `md:hidden` and there was no sidebar.
 *
 * Nav items exist only for enabled modules (Constitution §5; the server
 * guards stay authoritative). The bottom bar takes at most four of them;
 * the sidebar and the drawer carry the rest.
 */
export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const entitlements = await loadEntitlements(
    session.tenant.id,
    session.user.id,
  );
  const unread = await unreadNotificationCount(
    session.tenant.id,
    session.user.id,
  );

  const branding = await loadBranding(session.tenant.id);
  // Played once per browser session; the animation sets the cookie when done.
  const showSplash =
    branding.splash !== null &&
    !splashAlreadySeen((await cookies()).get(SPLASH_COOKIE)?.value, branding.splash.version);
  const items = employeeNavItems({
    enabledModules: enabledModuleKeys(entitlements),
  });
  const barItems = bottomBarItems(items);
  const nav = {
    items,
    // Without this an owner who lands here — from /home, or from the bell,
    // since /notifications is an employee route — has no way to any admin
    // screen at all, including the one that adds a work location.
    configItems: employeeCrossLinks({
      canAccessAdmin: session.permissions.has("admin.access"),
    }),
    configLabel: "Manage the company",
    userName: session.user.displayName,
    roleName: session.membership.roleName,
  };

  return (
    <div data-surface="employee" className="flex min-h-dvh">
      <ToastProvider>
        {showSplash && branding.splash && (
          <SplashScreen src={branding.splash.url} mime={branding.splash.mime} seenKey={branding.splash.version} />
        )}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface-default focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <Sidebar {...nav} label="Your FlowHRMS" />
        <OfflineProvider>
          <ActionQueueProvider enabled={session.source === "supabase"}>
            <div className="flex min-w-0 flex-1 flex-col">
              <EmployeeTopBar
                title={session.tenant.name}
                logoUrl={branding.logoUrl}
                notificationCount={unread}
                nav={nav}
              />
              {/* Persistent while offline, and not dismissible. */}
              <OfflineBar />
              <main
                id="main"
                className="mx-auto w-full max-w-[640px] flex-1 px-4 pt-4 pb-[calc(var(--fh-layout-bottom-nav-height)+env(safe-area-inset-bottom)+var(--fh-space-6))] sm:px-5 md:pb-6"
              >
                {children}
              </main>
            </div>
            <BottomNav items={barItems} />
            <ActionTiles />
          </ActionQueueProvider>
        </OfflineProvider>
      </ToastProvider>
    </div>
  );
}
