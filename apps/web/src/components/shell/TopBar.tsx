import { cn } from "@/lib/cn";
import { NotificationBell } from "@/components/actions/NotificationBell";
import { MobileNav } from "./MobileNav";
import type { NavItem } from "@/lib/shell/nav";
import { FlowacordMark } from "@/components/brand/FlowacordMark";

/**
 * Top bars (component-specifications.md §17).
 * Admin: page context + THE TENANT COMPANY NAME ALWAYS VISIBLE
 * (multi-tenant safety) + notifications.
 * Employee mobile: logo symbol, screen title, one action.
 *
 * Both carry the menu button below `md`, because the sidebar is hidden
 * there and it is otherwise the only way to reach the rest of the app.
 */

interface NavProps {
  items: NavItem[];
  configItems?: NavItem[];
  configLabel?: string;
  userName: string;
  roleName: string;
}

/** The company's own logo, beside its name. */
function CompanyLogo({ url }: { url: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
    <img src={url} alt="" className="h-7 w-auto max-w-[96px] shrink-0 object-contain" />
  );
}

export function AdminTopBar({
  tenantName,
  logoUrl = null,
  notificationCount = 0,
  nav,
}: {
  tenantName: string;
  logoUrl?: string | null;
  notificationCount?: number;
  nav: NavProps;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-[var(--fh-layout-top-bar-height-desktop)] items-center justify-between gap-4",
        "border-b border-border-default bg-surface-default px-5 lg:px-8",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <MobileNav {...nav} />
        {logoUrl && <CompanyLogo url={logoUrl} />}
        <span className="truncate text-label text-text-secondary">
          {tenantName}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell initialUnread={notificationCount} />
      </div>
    </header>
  );
}

export function EmployeeTopBar({
  title,
  logoUrl = null,
  notificationCount = 0,
  nav,
}: {
  title: string;
  logoUrl?: string | null;
  notificationCount?: number;
  nav: NavProps;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-[var(--fh-layout-top-bar-height-mobile)] items-center gap-2",
        "border-b border-border-default bg-surface-default px-5",
      )}
    >
      <MobileNav {...nav} />
      {logoUrl ? <CompanyLogo url={logoUrl} /> : <FlowacordMark size={24} className="md:hidden" />}
      <span className="min-w-0 flex-1 truncate text-label text-text-primary">
        {title}
      </span>
      {/* A team leader approves work from the same phone they check in on,
          so the bell belongs here too, not only in the admin shell. */}
      <NotificationBell initialUnread={notificationCount} />
    </header>
  );
}
