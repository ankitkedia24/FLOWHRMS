/**
 * FlowHRMS platform catalog — the single definition of modules, features,
 * permissions and role templates. Seeded into the database and referenced
 * by navigation, guards and the flag evaluator.
 *
 * Source documents: MODULES.md, FEATURE-FLAGS.md, USER-ROLES.md (Pack 01),
 * as amended — Amendment 3 (EXPENSES-MODULE.md) adds the two expenses
 * permissions; Amendment 4 (FIELD-VISITS-MODULE.md) adds the Field visits
 * module and `fieldvisits.view`. Do not add modules, features, roles or
 * permissions beyond those documents (design handoff README §8).
 */

export type ModuleCategory = "CORE" | "STANDARD" | "OPTIONAL";

/**
 * `built: false` marks a module with nothing behind it — no screens, no
 * rules. It stays in the catalog (the key and any company's saved setting
 * remain valid) but nobody can switch it on or sell it in a plan: the
 * screens say "Not built yet" and the actions refuse. Switching one off
 * always works. Leaving `built` out means built. Read it through
 * isModuleBuilt().
 */
export const MODULES = {
  EMPLOYEES: {
    key: "EMPLOYEES",
    name: "Employee Management",
    description:
      "Profiles, employment information, reporting manager, documents, status and timeline.",
    category: "STANDARD" as ModuleCategory,
    sortOrder: 10,
  },
  ATTENDANCE: {
    key: "ATTENDANCE",
    name: "Attendance",
    description:
      "Check-in/out, time and location capture, shifts, exceptions, calendar, late rules and admin review.",
    category: "STANDARD" as ModuleCategory,
    sortOrder: 20,
  },
  LEAVE: {
    key: "LEAVE",
    name: "Leave",
    description:
      "Request, approve or reject, half-day and emergency leave, and payroll effect.",
    category: "STANDARD" as ModuleCategory,
    sortOrder: 30,
  },
  PAYROLL: {
    key: "PAYROLL",
    name: "Payroll",
    description:
      "Salaries, period calculations, adjustments, review and payslips.",
    category: "STANDARD" as ModuleCategory,
    sortOrder: 40,
  },
  TASKS: {
    key: "TASKS",
    name: "Tasks",
    description:
      "Assignments, priority, due dates, notes, files, proof and status.",
    category: "STANDARD" as ModuleCategory,
    sortOrder: 50,
  },
  DAILY_REPORTING: {
    key: "DAILY_REPORTING",
    name: "Daily Reporting",
    description:
      "Today's attendance, task status and exceptions in one live summary.",
    category: "STANDARD" as ModuleCategory,
    sortOrder: 60,
  },
  PERFORMANCE: {
    key: "PERFORMANCE",
    name: "Performance & Leaderboards",
    description:
      "Attendance and task-derived indicators only, with transparent definitions.",
    category: "STANDARD" as ModuleCategory,
    sortOrder: 70,
  },
  NOTIFICATIONS: {
    key: "NOTIFICATIONS",
    name: "Notifications",
    description:
      "In-app notices for requests and decisions. Push, email, SMS and WhatsApp delivery are not built yet.",
    category: "CORE" as ModuleCategory,
    sortOrder: 80,
  },
  EXPENSES: {
    key: "EXPENSES",
    name: "Expenses",
    description:
      "Claims with receipts, approval, and a record of settlement. Works with or without Payroll.",
    category: "OPTIONAL" as ModuleCategory,
    sortOrder: 110,
  },
  ASSETS: {
    key: "ASSETS",
    name: "Assets",
    description: "Planned — not built yet.",
    category: "OPTIONAL" as ModuleCategory,
    built: false,
    sortOrder: 120,
  },
  ANNOUNCEMENTS: {
    key: "ANNOUNCEMENTS",
    name: "Announcements",
    description: "Planned — not built yet.",
    category: "OPTIONAL" as ModuleCategory,
    built: false,
    sortOrder: 130,
  },
  APPROVALS: {
    key: "APPROVALS",
    name: "Approvals",
    description: "Planned — not built yet.",
    category: "OPTIONAL" as ModuleCategory,
    built: false,
    sortOrder: 140,
  },
  GPS_TRACKING: {
    key: "GPS_TRACKING",
    name: "GPS Tracking",
    description:
      "Planned: event-based attendance and task proof, never continuous tracking. Not built yet.",
    category: "OPTIONAL" as ModuleCategory,
    built: false,
    sortOrder: 150,
  },
  FIELD_VISITS: {
    key: "FIELD_VISITS",
    name: "Field visits",
    description:
      "Going out, visits and the way back, recorded only at each tap — never continuous tracking. Road distance feeds travel claims.",
    category: "OPTIONAL" as ModuleCategory,
    sortOrder: 160,
  },
} as const;

export type ModuleKey = keyof typeof MODULES;

/** Has this module been built? Unknown keys: no. */
export function isModuleBuilt(key: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(MODULES, key)) return false;
  const def: { key: string; built?: boolean } = MODULES[key as ModuleKey];
  return def.built !== false;
}

/**
 * Dependency rules (MODULES.md). Entries sharing a non-null `anyOfGroup`
 * are satisfied when ANY module of the group is enabled.
 */
export const MODULE_DEPENDENCIES: ReadonlyArray<{
  module: ModuleKey;
  requires: ModuleKey;
  anyOfGroup?: string;
}> = [
  { module: "PAYROLL", requires: "EMPLOYEES" },
  { module: "PAYROLL", requires: "ATTENDANCE" },
  { module: "LEAVE", requires: "EMPLOYEES" },
  { module: "TASKS", requires: "EMPLOYEES" },
  // A trip happens inside an open working day (FIELD-VISITS-MODULE.md §2).
  { module: "FIELD_VISITS", requires: "ATTENDANCE" },
  { module: "PERFORMANCE", requires: "ATTENDANCE", anyOfGroup: "perf-source" },
  { module: "PERFORMANCE", requires: "TASKS", anyOfGroup: "perf-source" },
];

/**
 * Initial feature flags (FEATURE-FLAGS.md).
 *
 * `built: false` marks a switch that no code reads yet. Flipping it would
 * change nothing, and a switch that does nothing tells the owner something
 * false about their company. It keeps its key — reserved for when it is
 * built, and tenant settings already saved against it stay valid — but it
 * is never offered as a control and saving it is refused
 * (src/lib/modules/actions.ts). Leaving `built` out means built.
 */
export const FEATURES: ReadonlyArray<{
  module: ModuleKey;
  key: string;
  name: string;
  defaultEnabled: boolean;
  built?: boolean;
}> = [
  { module: "ATTENDANCE", key: "gps_capture", name: "GPS capture", defaultEnabled: true, built: false },
  { module: "ATTENDANCE", key: "geofence", name: "Permitted-area check", defaultEnabled: true },
  { module: "ATTENDANCE", key: "any_branch_check_in", name: "Check in at any company location", defaultEnabled: false },
  { module: "ATTENDANCE", key: "outside_area_approval", name: "Outside-area approval", defaultEnabled: true, built: false },
  { module: "ATTENDANCE", key: "multiple_punch", name: "Multiple punches per day", defaultEnabled: false },
  { module: "ATTENDANCE", key: "offline_capture", name: "Offline capture", defaultEnabled: true, built: false },
  { module: "ATTENDANCE", key: "missed_punch_correction", name: "Missed-punch correction", defaultEnabled: true, built: false },
  { module: "ATTENDANCE", key: "late_penalty", name: "Late penalty", defaultEnabled: true, built: false },
  { module: "ATTENDANCE", key: "late_exemption", name: "Late exemption", defaultEnabled: true, built: false },
  { module: "PAYROLL", key: "overtime", name: "Overtime", defaultEnabled: false, built: false },
  { module: "PAYROLL", key: "advances", name: "Advances", defaultEnabled: false, built: false },
  { module: "PAYROLL", key: "loans", name: "Loans", defaultEnabled: false, built: false },
  { module: "PAYROLL", key: "incentives", name: "Incentives", defaultEnabled: false, built: false },
  { module: "PAYROLL", key: "bonus", name: "Bonus", defaultEnabled: false, built: false },
  { module: "PAYROLL", key: "payslip_delivery", name: "Payslip delivery", defaultEnabled: true, built: false },
  { module: "TASKS", key: "multiple_assignees", name: "Multiple assignees", defaultEnabled: false, built: false },
  { module: "TASKS", key: "recurring_tasks", name: "Recurring tasks", defaultEnabled: false, built: false },
  { module: "TASKS", key: "proof_photo", name: "Photo proof", defaultEnabled: true },
  { module: "TASKS", key: "proof_file", name: "File proof", defaultEnabled: true },
  { module: "TASKS", key: "proof_video", name: "Video proof", defaultEnabled: false, built: false },
  { module: "TASKS", key: "gps_proof", name: "GPS proof", defaultEnabled: false, built: false },
  { module: "TASKS", key: "daily_report", name: "Task daily report", defaultEnabled: true, built: false },
  { module: "NOTIFICATIONS", key: "push", name: "Push notifications", defaultEnabled: true },
  { module: "NOTIFICATIONS", key: "email", name: "Email notifications", defaultEnabled: true },
  { module: "NOTIFICATIONS", key: "whatsapp", name: "WhatsApp notifications", defaultEnabled: false },
  { module: "NOTIFICATIONS", key: "sms", name: "SMS notifications", defaultEnabled: false },
  { module: "PERFORMANCE", key: "leaderboard", name: "Leaderboard", defaultEnabled: false },
  { module: "PERFORMANCE", key: "rewards", name: "Rewards store", defaultEnabled: false },
];

/**
 * Permission catalog. `sensitive` marks the separately-permissioned set
 * from USER-ROLES.md §"Minimum sensitive permissions".
 *
 * `built: false` marks a permission no code checks yet: granting it gives
 * nobody anything, so the access-level matrix does not offer it. It stays
 * in the catalog and on every role that already holds it, ready for the
 * day something checks it.
 */
export const PERMISSIONS = [
  { key: "admin.access", name: "Access the admin area", isSensitive: false },
  { key: "employees.view", name: "View employees", isSensitive: false },
  { key: "employees.manage", name: "Add and edit employees", isSensitive: false },
  { key: "attendance.view", name: "View attendance", isSensitive: false },
  { key: "attendance.review", name: "Review attendance exceptions", isSensitive: false },
  { key: "attendance.override", name: "Override attendance records", isSensitive: true, built: false },
  { key: "leave.view", name: "View leave requests", isSensitive: false },
  { key: "leave.approve", name: "Approve leave", isSensitive: false },
  { key: "payroll.view", name: "Salary amounts — view", isSensitive: true },
  { key: "payroll.edit", name: "Salary amounts — edit", isSensitive: true },
  { key: "payroll.approve", name: "Payroll — approve and lock", isSensitive: true },
  { key: "bank.view", name: "Bank details — view", isSensitive: true },
  { key: "bank.edit", name: "Bank details — edit", isSensitive: true, built: false },
  { key: "documents.view", name: "View employee documents", isSensitive: false },
  { key: "documents.download", name: "Download employee documents", isSensitive: true },
  { key: "location.view", name: "View attendance locations", isSensitive: true, built: false },
  { key: "tasks.view", name: "View tasks", isSensitive: false },
  { key: "tasks.manage", name: "Create and manage tasks", isSensitive: false },
  { key: "tasks.reassign", name: "Reassign tasks", isSensitive: false, built: false },
  { key: "reports.view", name: "View reports", isSensitive: false },
  { key: "reports.export", name: "Export reports", isSensitive: true },
  { key: "audit.view", name: "View the activity log", isSensitive: true },
  { key: "policy.edit", name: "Edit company rules and shifts", isSensitive: false },
  { key: "modules.manage", name: "Manage modules and features", isSensitive: false },
  { key: "roles.manage", name: "Manage roles and permissions", isSensitive: false },
  { key: "settings.manage", name: "Manage company settings", isSensitive: false },
  // Expenses (MODULES.md Amendment 3, EXPENSES-MODULE.md §5): approving
  // spend is its own authority — deliberately not employees.manage.
  { key: "expenses.approve", name: "Approve and settle expense claims", isSensitive: false },
  { key: "expenses.view", name: "View expense claims", isSensitive: false },
  // Field visits (MODULES.md Amendment 4): where people went is location
  // data. Reporting managers and department heads see their own people
  // without it; this is for seeing everyone.
  { key: "fieldvisits.view", name: "See everyone's field visits", isSensitive: true },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSIONS.map(
  (p) => p.key,
);

/**
 * Is this a feature switch something actually reads? Unknown keys are not
 * built either — there is nothing to switch.
 */
export function isFeatureBuilt(moduleKey: string, featureKey: string): boolean {
  const def = FEATURES.find((f) => f.module === moduleKey && f.key === featureKey);
  return def !== undefined && def.built !== false;
}

/** The feature switches a company is offered for one module. */
export function switchableFeatures(moduleKey: ModuleKey): typeof FEATURES {
  return FEATURES.filter((f) => f.module === moduleKey && f.built !== false);
}

/** Does some code check this permission? Unknown keys: no. */
export function isPermissionBuilt(key: string): boolean {
  const def: { key: string; built?: boolean } | undefined = PERMISSIONS.find(
    (p) => p.key === key,
  );
  return def !== undefined && def.built !== false;
}

/** The permissions the access-level matrix offers. */
export const GRANTABLE_PERMISSIONS = PERMISSIONS.filter((p) =>
  isPermissionBuilt(p.key),
);

/**
 * Role templates (USER-ROLES.md). Safe starting sets — tenants may adjust
 * within their enabled modules; a role can never exceed platform controls.
 */
export const ROLE_TEMPLATES: ReadonlyArray<{
  key: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
}> = [
  {
    key: "OWNER",
    name: "Owner",
    description:
      "Full company control, including payroll approval and retention choices.",
    permissions: [...ALL_PERMISSION_KEYS],
  },
  {
    key: "SUPER_ADMIN",
    name: "Super Admin",
    description:
      "Delegated operational authority. Payroll and bank access are granted separately.",
    permissions: [
      "admin.access",
      "employees.view",
      "employees.manage",
      "attendance.view",
      "attendance.review",
      "attendance.override",
      "leave.view",
      "leave.approve",
      "documents.view",
      "documents.download",
      "tasks.view",
      "tasks.manage",
      "tasks.reassign",
      "reports.view",
      "reports.export",
      "audit.view",
      "policy.edit",
      "modules.manage",
      "roles.manage",
      "settings.manage",
      "expenses.approve",
      "expenses.view",
      "fieldvisits.view",
    ],
  },
  {
    key: "ADMIN",
    name: "Admin",
    description:
      "Runs people operations. Configurable by permission set.",
    permissions: [
      "admin.access",
      "employees.view",
      "employees.manage",
      "attendance.view",
      "attendance.review",
      "leave.view",
      "leave.approve",
      "documents.view",
      "tasks.view",
      "tasks.manage",
      "reports.view",
      "expenses.approve",
      "expenses.view",
      "fieldvisits.view",
    ],
  },
  {
    key: "HR",
    name: "HR",
    description:
      "Maintains employee records, documents, leave and payroll inputs.",
    permissions: [
      "admin.access",
      "employees.view",
      "employees.manage",
      "attendance.view",
      "attendance.review",
      "leave.view",
      "leave.approve",
      "documents.view",
      "documents.download",
      "payroll.view",
      "reports.view",
      "expenses.approve",
      "expenses.view",
    ],
  },
  {
    key: "MANAGER",
    name: "Manager",
    description:
      "Manages their reporting tree: tasks, approvals and limited reports. No payroll or bank data by default.",
    permissions: [
      "admin.access",
      "employees.view",
      "attendance.view",
      "attendance.review",
      "leave.view",
      "leave.approve",
      "tasks.view",
      "tasks.manage",
      "tasks.reassign",
      "reports.view",
      "expenses.view",
    ],
  },
  {
    key: "TEAM_LEADER",
    name: "Team Leader",
    description: "Assigns and reviews work in their team.",
    permissions: ["employees.view", "attendance.view", "tasks.view", "tasks.manage"],
  },
  {
    key: "EMPLOYEE",
    name: "Employee",
    description:
      "Acts on their own attendance, leave, tasks, documents and payslips.",
    permissions: [],
  },
  {
    key: "VIEWER",
    name: "Viewer",
    description: "Read-only, with a defined record scope.",
    permissions: ["employees.view", "reports.view"],
  },
];

/**
 * The order roles are offered in when adding someone, least powerful
 * first, and what each one means in one line.
 *
 * Alphabetical order put **Admin** at the top, and a form that defaults to
 * its first option therefore handed the most privileged non-owner role to
 * anyone added without touching the dropdown. Least-privilege-first is the
 * only safe default for a control that grants access.
 */
export const ROLE_PICKER_ORDER: readonly string[] = [
  "EMPLOYEE",
  "TEAM_LEADER",
  "MANAGER",
  "HR",
  "ADMIN",
  "SUPER_ADMIN",
  "VIEWER",
  "OWNER",
];

/**
 * How much authority each role carries, for one rule: **nobody may grant a
 * role more powerful than their own.** Without it, anyone who can add
 * employees could create an Owner and then be managed by them — an
 * escalation path that looks like ordinary admin work.
 *
 * Viewer sits at the bottom with Employee: it is read-only.
 */
export const PRIVILEGE_RANK: Record<string, number> = {
  VIEWER: 0,
  EMPLOYEE: 0,
  TEAM_LEADER: 1,
  MANAGER: 2,
  HR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
  OWNER: 5,
};

export function privilegeRank(roleKey: string): number {
  return PRIVILEGE_RANK[roleKey] ?? 0;
}

/**
 * Stated under the role picker so the grant is never silent. Team-scoped
 * roles say so: they see and act on their own team only, never the whole
 * company (record scope, USER-ROLES.md Amendments 3 and 4).
 */
export const ROLE_CONSEQUENCE: Record<string, string> = {
  EMPLOYEE:
    "Sees only their own attendance, leave, tasks and payslips. No admin area.",
  TEAM_LEADER:
    "Assigns and reviews work for their own team — the people who report to them. No admin area, no approvals.",
  MANAGER:
    "Opens the admin area for their own team — the people who report to them and any department they head. Approves that team's leave and attendance, sees its expense claims, manages its tasks. No salary or bank details.",
  HR: "Opens the admin area. Manages people, documents and leave, and can view salary amounts.",
  ADMIN:
    "Opens the admin area and runs people operations for the whole company.",
  SUPER_ADMIN:
    "Opens the admin area with near-full control, including roles and company settings.",
  VIEWER: "Read-only. Sees their own team's employees and reports, changes nothing.",
  OWNER:
    "Full control of the company, including payroll approval. Give this sparingly.",
};

/** V1 modules enabled for a new tenant by default. */
export const DEFAULT_ENABLED_MODULES: ModuleKey[] = [
  "EMPLOYEES",
  "ATTENDANCE",
  "LEAVE",
  "PAYROLL",
  "TASKS",
  "DAILY_REPORTING",
  "NOTIFICATIONS",
];

