import type { ModuleKey } from "@/lib/catalog";

/**
 * What each surface can navigate to.
 *
 * Pure: no JSX, no hooks, no icons — icon *names* only, resolved by the
 * component. That keeps this testable, and it is the reason the rules below
 * can be asserted rather than eyeballed.
 *
 * Two rules that were previously implicit in two different components and
 * therefore drifted:
 *
 * 1. **A destination for a disabled module does not exist.** Not greyed,
 *    not shown-and-refused — absent. Server guards remain the enforcement
 *    (Product Constitution §5); this only decides what is offered.
 * 2. **The four-item cap belongs to the bottom bar, not to the product.**
 *    component-specifications.md §15 caps the *bar*, because five thumb
 *    targets across a phone is too many. A sidebar has no such constraint,
 *    so it may legitimately show more.
 */

export type NavIcon =
  | "dashboard"
  | "attendance"
  | "employees"
  | "leave"
  | "tasks"
  | "payroll"
  | "dailyReport"
  | "reports"
  | "home"
  | "profile"
  | "documents"
  | "payslips"
  | "modules"
  | "roles"
  | "rules"
  | "company"
  | "departments"
  | "activity"
  | "performance"
  | "expenses"
  | "account"
  | "subscription"
  | "designations"
  | "fieldVisits";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

export interface AdminNavInput {
  enabledModules: ModuleKey[];
  can: {
    modules: boolean;
    roles: boolean;
    settings: boolean;
    audit: boolean;
    /** Owner, Super Admin or Admin: sees the plan and can pay for it. */
    billing: boolean;
    /** Can add employees, and so manage the designations they're given. */
    designations: boolean;
  };
}

/** Main admin destinations, filtered by which modules the tenant has on. */
export function adminNavItems({ enabledModules }: AdminNavInput): NavItem[] {
  const all: Array<NavItem & { module: ModuleKey | null }> = [
    { module: null, href: "/admin", label: "Dashboard", icon: "dashboard" },
    { module: "ATTENDANCE", href: "/admin/attendance", label: "Attendance", icon: "attendance" },
    { module: "EMPLOYEES", href: "/admin/employees", label: "Employees", icon: "employees" },
    { module: "LEAVE", href: "/admin/leave", label: "Leave", icon: "leave" },
    { module: "TASKS", href: "/admin/tasks", label: "Tasks", icon: "tasks" },
    { module: "PAYROLL", href: "/admin/payroll", label: "Payroll", icon: "payroll" },
    { module: "EXPENSES", href: "/admin/expenses", label: "Expenses", icon: "expenses" },
    { module: "DAILY_REPORTING", href: "/admin/daily-report", label: "Daily report", icon: "dailyReport" },
    { module: "PERFORMANCE", href: "/admin/performance", label: "Performance", icon: "performance" },
    { module: null, href: "/admin/reports", label: "Reports", icon: "reports" },
  ];

  return all
    .filter((item) => item.module === null || enabledModules.includes(item.module))
    .map(({ href, label, icon }) => ({ href, label, icon }));
}

/** Configuration destinations, filtered by permission. */
export function adminConfigItems({ can }: AdminNavInput): NavItem[] {
  return [
    can.modules && {
      href: "/admin/modules",
      label: "Module Management",
      icon: "modules" as const,
    },
    can.designations && {
      href: "/admin/settings/designations",
      label: "Designations",
      icon: "designations" as const,
    },
    can.roles && {
      href: "/admin/roles",
      label: "Access levels",
      icon: "roles" as const,
    },
    can.settings && {
      href: "/admin/settings/attendance",
      label: "Attendance & pay rules",
      icon: "rules" as const,
    },
    can.settings && {
      href: "/admin/settings/departments",
      label: "Departments",
      icon: "departments" as const,
    },
    can.settings && {
      href: "/admin/settings/performance",
      label: "Performance scoring",
      icon: "performance" as const,
    },
    can.settings && {
      href: "/admin/settings/expenses",
      label: "Expense rules",
      icon: "expenses" as const,
    },
    can.settings && {
      href: "/admin/settings",
      label: "Company settings",
      icon: "company" as const,
    },
    can.billing && {
      href: "/subscription",
      label: "Subscription",
      icon: "subscription" as const,
    },
    can.audit && {
      href: "/admin/activity",
      label: "Activity log",
      icon: "activity" as const,
    },
  ].filter(Boolean) as NavItem[];
}

export interface EmployeeNavInput {
  enabledModules: ModuleKey[];
}

/**
 * Everything an employee can reach.
 *
 * Leave and Payslips are here but NOT in the bottom bar: the bar is capped
 * at four, so today they are reachable only by going through Profile, which
 * is a poor place to hide "when am I paid" and "am I off on Friday". A
 * sidebar and a drawer have room, so they appear there.
 */
export function employeeNavItems({ enabledModules }: EmployeeNavInput): NavItem[] {
  const all: Array<NavItem & { module: ModuleKey | null }> = [
    { module: null, href: "/home", label: "Home", icon: "home" },
    { module: "ATTENDANCE", href: "/attendance", label: "Attendance", icon: "attendance" },
    { module: "TASKS", href: "/tasks", label: "Tasks", icon: "tasks" },
    { module: "LEAVE", href: "/leave", label: "Leave", icon: "leave" },
    { module: "PAYROLL", href: "/payslips", label: "Payslips", icon: "payslips" },
    { module: "EXPENSES", href: "/expenses", label: "Expenses", icon: "expenses" },
    { module: "FIELD_VISITS", href: "/field-visits", label: "Field visits", icon: "fieldVisits" },
    { module: "PERFORMANCE", href: "/performance", label: "Performance", icon: "performance" },
    { module: "EMPLOYEES", href: "/documents", label: "My documents", icon: "documents" },
    { module: null, href: "/profile", label: "Profile", icon: "profile" },
  ];

  return all
    .filter((item) => item.module === null || enabledModules.includes(item.module))
    .map(({ href, label, icon }) => ({ href, label, icon }));
}

/**
 * The way between the two surfaces.
 *
 * They were sealed off from each other. An owner who opened `/home` — or
 * who tapped the bell, since `/notifications` is an employee route — landed
 * in the employee shell, which lists only Home, Attendance, Tasks, Leave,
 * Payslips, documents and Profile. No Employees, no Payroll, no Settings,
 * no way back except editing the URL. The company's own owner could not
 * reach the screen that adds a location.
 *
 * The reverse was just as sealed: an admin has attendance and payslips of
 * their own, and nothing in the admin shell pointed at them.
 *
 * These go in the sidebar's second group rather than the item list, which
 * keeps them structurally out of the four-slot bottom bar — that bar is for
 * an employee's own destinations, and a tenant with few modules enabled
 * would otherwise let "Admin area" take a thumb slot.
 */
export function employeeCrossLinks({
  canAccessAdmin,
}: {
  canAccessAdmin: boolean;
}): NavItem[] {
  if (!canAccessAdmin) return [];
  return [{ href: "/admin", label: "Admin area", icon: "dashboard" }];
}

/** The way back to your own screens — check-in, payslips, leave. */
export function adminCrossLinks(): NavItem[] {
  return [{ href: "/home", label: "My workspace", icon: "home" }];
}

/**
 * The operator's own area, offered only to a Platform Super Admin.
 *
 * Not a permission and not a role: a boolean on the user record that no
 * amount of tenant configuration can grant. A customer's Owner collecting
 * every permission in the catalog still never sees this.
 */
export function platformCrossLinks({
  isPlatformAdmin,
}: {
  isPlatformAdmin: boolean;
}): NavItem[] {
  if (!isPlatformAdmin) return [];
  return [{ href: "/platform", label: "Platform", icon: "company" }];
}

/**
 * The bottom bar takes at most four, and Profile is always the last of them
 * — it is where sign-out and everything not on the bar lives, so dropping it
 * to fit another module would strand the rest.
 */
export const BOTTOM_BAR_MAX = 4;

export function bottomBarItems(items: NavItem[]): NavItem[] {
  const profile = items.find((i) => i.href === "/profile");
  const rest = items.filter((i) => i.href !== "/profile");
  const room = profile ? BOTTOM_BAR_MAX - 1 : BOTTOM_BAR_MAX;
  return [...rest.slice(0, room), ...(profile ? [profile] : [])];
}

/** Is this destination the one currently being viewed? */
export function isActiveNav(href: string, pathname: string): boolean {
  // "/admin" and "/home" are prefixes of every child route, so they only
  // match exactly — otherwise every admin page lights up Dashboard.
  if (href === "/admin" || href === "/home") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
