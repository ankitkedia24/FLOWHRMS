import { describe, expect, it } from "vitest";
import {
  adminConfigItems,
  adminCrossLinks,
  adminNavItems,
  bottomBarItems,
  BOTTOM_BAR_MAX,
  employeeCrossLinks,
  employeeNavItems,
  isActiveNav,
} from "@/lib/shell/nav";
import type { ModuleKey } from "@/lib/catalog";

const ALL_MODULES: ModuleKey[] = [
  "EMPLOYEES",
  "ATTENDANCE",
  "LEAVE",
  "PAYROLL",
  "TASKS",
  "DAILY_REPORTING",
  "NOTIFICATIONS",
];

const ALL_CAN = { modules: true, roles: true, settings: true, audit: true, billing: true, designations: true };
const NO_CAN = { modules: false, roles: false, settings: false, audit: false, billing: false, designations: false };

describe("admin destinations", () => {
  it("offers every module screen when everything is on", () => {
    const hrefs = adminNavItems({ enabledModules: ALL_MODULES, can: ALL_CAN }).map(
      (i) => i.href,
    );
    expect(hrefs).toContain("/admin/attendance");
    expect(hrefs).toContain("/admin/employees");
    expect(hrefs).toContain("/admin/payroll");
  });

  it("does not offer a screen for a disabled module — absent, not greyed", () => {
    const hrefs = adminNavItems({
      enabledModules: ["EMPLOYEES", "ATTENDANCE"],
      can: ALL_CAN,
    }).map((i) => i.href);
    expect(hrefs).not.toContain("/admin/payroll");
    expect(hrefs).not.toContain("/admin/leave");
    expect(hrefs).not.toContain("/admin/tasks");
  });

  it("always keeps Dashboard and Reports, which belong to no module", () => {
    const hrefs = adminNavItems({ enabledModules: [], can: NO_CAN }).map((i) => i.href);
    expect(hrefs).toEqual(["/admin", "/admin/reports"]);
  });

  it("hides configuration a role cannot use", () => {
    expect(adminConfigItems({ enabledModules: ALL_MODULES, can: NO_CAN })).toEqual([]);
  });

  it("shows only the configuration a role holds", () => {
    const hrefs = adminConfigItems({
      enabledModules: ALL_MODULES,
      can: { modules: false, roles: false, settings: true, audit: false, billing: false, designations: false },
    }).map((i) => i.href);
    expect(hrefs).toContain("/admin/settings");
    expect(hrefs).toContain("/admin/settings/departments");
    expect(hrefs).not.toContain("/admin/roles");
    expect(hrefs).not.toContain("/admin/activity");
  });

  it("offers Subscription only to those who can pay", () => {
    const hrefs = (billing: boolean) =>
      adminConfigItems({ enabledModules: ALL_MODULES, can: { ...NO_CAN, billing } }).map((i) => i.href);
    expect(hrefs(true)).toEqual(["/subscription"]);
    expect(hrefs(false)).toEqual([]);
  });

  it("reaches Departments, which had no route in the sidebar before", () => {
    const hrefs = adminConfigItems({ enabledModules: ALL_MODULES, can: ALL_CAN }).map(
      (i) => i.href,
    );
    expect(hrefs).toContain("/admin/settings/departments");
  });

  it("gives every item a label and an icon", () => {
    for (const item of [
      ...adminNavItems({ enabledModules: ALL_MODULES, can: ALL_CAN }),
      ...adminConfigItems({ enabledModules: ALL_MODULES, can: ALL_CAN }),
    ]) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon.length).toBeGreaterThan(0);
    }
  });
});

describe("employee destinations", () => {
  it("includes Leave and Payslips, not only the four bar items", () => {
    const hrefs = employeeNavItems({ enabledModules: ALL_MODULES }).map((i) => i.href);
    expect(hrefs).toContain("/leave");
    expect(hrefs).toContain("/payslips");
  });

  it("drops Payslips when payroll is off", () => {
    const hrefs = employeeNavItems({
      enabledModules: ["ATTENDANCE", "TASKS"],
    }).map((i) => i.href);
    expect(hrefs).not.toContain("/payslips");
    expect(hrefs).not.toContain("/leave");
  });

  it("always keeps Home and Profile", () => {
    const hrefs = employeeNavItems({ enabledModules: [] }).map((i) => i.href);
    expect(hrefs).toEqual(["/home", "/profile"]);
  });
});

describe("the bottom bar cap belongs to the bar, not the product", () => {
  it("never exceeds four", () => {
    const bar = bottomBarItems(employeeNavItems({ enabledModules: ALL_MODULES }));
    expect(bar.length).toBeLessThanOrEqual(BOTTOM_BAR_MAX);
  });

  it("always keeps Profile — it is where everything else is reached", () => {
    const bar = bottomBarItems(employeeNavItems({ enabledModules: ALL_MODULES }));
    expect(bar[bar.length - 1].href).toBe("/profile");
  });

  it("does not cap the sidebar", () => {
    const all = employeeNavItems({ enabledModules: ALL_MODULES });
    expect(all.length).toBeGreaterThan(BOTTOM_BAR_MAX);
  });

  it("re-balances rather than leaving a gap when modules are off", () => {
    const bar = bottomBarItems(employeeNavItems({ enabledModules: ["ATTENDANCE"] }));
    expect(bar.map((i) => i.href)).toEqual(["/home", "/attendance", "/profile"]);
  });
});

describe("the two surfaces are reachable from each other", () => {
  /**
   * Reported as three separate problems by the tenant's own owner: the
   * notification bell "does not work", there is no Settings button, and
   * there is nowhere to add work locations. One cause. /notifications is
   * an employee route, so tapping the bell moved an owner into the
   * employee shell — which listed only Home, Attendance, Tasks, Leave,
   * Payslips, documents and Profile, with no route back to /admin.
   */
  it("offers an admin the way into the admin area", () => {
    expect(employeeCrossLinks({ canAccessAdmin: true }).map((i) => i.href)).toEqual(
      ["/admin"],
    );
  });

  it("offers a plain employee nothing of the sort", () => {
    expect(employeeCrossLinks({ canAccessAdmin: false })).toEqual([]);
  });

  it("offers the way back to your own screens from admin", () => {
    expect(adminCrossLinks().map((i) => i.href)).toEqual(["/home"]);
  });

  it("keeps the cross-link out of the four-slot bottom bar", () => {
    // The bar is for an employee's own destinations. A tenant with almost
    // no modules on has few enough items that "Admin area" could take a
    // thumb slot if it were ever merged into the main list.
    const items = employeeNavItems({ enabledModules: [] });
    const bar = bottomBarItems(items);
    const crossHrefs = employeeCrossLinks({ canAccessAdmin: true }).map(
      (i) => i.href,
    );
    expect(bar.map((i) => i.href)).not.toContain(crossHrefs[0]);
    expect(items.map((i) => i.href)).not.toContain(crossHrefs[0]);
  });

  it("highlights Admin area only inside the admin area", () => {
    const [admin] = employeeCrossLinks({ canAccessAdmin: true });
    expect(isActiveNav(admin.href, "/home")).toBe(false);
    expect(isActiveNav(admin.href, "/admin")).toBe(true);
  });

  it("does not light My workspace up on every employee screen", () => {
    const [home] = adminCrossLinks();
    expect(isActiveNav(home.href, "/home")).toBe(true);
    expect(isActiveNav(home.href, "/attendance")).toBe(false);
  });
});

describe("which destination is highlighted", () => {
  it("matches Dashboard only exactly, not every admin page", () => {
    expect(isActiveNav("/admin", "/admin")).toBe(true);
    expect(isActiveNav("/admin", "/admin/employees")).toBe(false);
  });

  it("matches Home only exactly", () => {
    expect(isActiveNav("/home", "/home")).toBe(true);
    expect(isActiveNav("/home", "/tasks")).toBe(false);
  });

  it("highlights a section from any page inside it", () => {
    expect(isActiveNav("/admin/employees", "/admin/employees")).toBe(true);
    expect(isActiveNav("/admin/employees", "/admin/employees/abc-123")).toBe(true);
    expect(isActiveNav("/admin/employees", "/admin/employees/new")).toBe(true);
  });

  it("does not highlight a sibling whose href is a string prefix", () => {
    // "/admin/settings" must not light up while on "/admin/settings-other".
    expect(isActiveNav("/admin/settings", "/admin/settings-other")).toBe(false);
  });
});
