/**
 * What the activity log says for each recorded action. The log stores a
 * stable key ("employee.invite_accepted"); people read a sentence
 * ("Invitation accepted"). Internal words — tenant, membership — never
 * reach the screen. Pure and tested (src/tests/activity-labels.test.ts).
 */

const LABELS: Record<string, string> = {
  "account.password_changed": "Password changed",
  "action_request.approved_from_tile": "Request approved from the dashboard",
  "attendance.checkin": "Checked in",
  "attendance.checkout": "Checked out",
  "attendance.correction_requested": "Attendance correction requested",
  "attendance.sync_conflict": "Offline attendance needed review",
  "billing.checkout_started": "Payment started",
  "billing.payment_received": "Payment received",
  "billing.plan_changed": "Plan changed",
  "billing.plan_created": "Plan created",
  "billing.plan_modules_applied": "Plan modules applied",
  "billing.seller_changed": "Invoice details changed",
  "consent.granted": "Consent given",
  "consent.withdrawn": "Consent withdrawn",
  "consent_notice.legal_reviewed": "Notice marked as legally reviewed",
  "data_request.created": "Data request raised",
  "data_request.updated": "Data request updated",
  "demo_request.updated": "Enquiry updated",
  "department.created": "Department added",
  "department.updated": "Department changed",
  "department.deactivated": "Department turned off",
  "designation.access_changed": "Designation access changed",
  "designation.created": "Designation added",
  "designation.renamed": "Designation renamed",
  "designation.turned_off": "Designation turned off",
  "designation.turned_on": "Designation turned on",
  "document.uploaded": "Document uploaded",
  "document.viewed": "Document opened",
  "employee.deactivated": "Employee marked as left",
  "employee.designation_changed": "Designation changed",
  "employee.invite_accepted": "Invitation accepted",
  "employee.invite_resent": "Invitation sent again",
  "employee.invite_sent": "Invitation sent",
  "employee.invite_revoked": "Invitation cancelled",
  "employee.invited": "Employee added",
  "employee.photo_removed": "Photo removed",
  "employee.photo_set": "Photo added",
  "employee.role_changed": "Access changed",
  "employee.updated": "Employee details changed",
  "expense.policy_published": "Expense rules updated",
  "expense.receipt_uploaded": "Receipt uploaded",
  "expense.receipt_viewed": "Receipt opened",
  "feature.disabled": "Feature switched off",
  "feature.enabled": "Feature switched on",
  "field_visits.arrived": "Reached a field visit",
  "field_visits.back_at_office": "Back at office from a field trip",
  "field_visits.ended_at_check_out": "Field trip ended at check-out",
  "field_visits.going_out": "Went out on a field trip",
  "field_visits.place_added": "Place added for field visits",
  "field_visits.place_edited": "Field visit place changed",
  "field_visits.place_restored": "Field visit place restored",
  "field_visits.place_retired": "Field visit place retired",
  "field_visits.places_merged": "Field visit places merged",
  "field_visits.policy_published": "Field visit rules updated",
  "field_visits.travel_claimed": "Travel allowance claimed",
  "field_visits.trip_approved": "Field trip approved",
  "field_visits.trip_declined": "Field trip declined",
  "field_visits.vehicle_changed": "Travel allowance vehicle changed",
  "field_visits.vehicle_chosen": "Travel allowance vehicle chosen",
  "field_visits.visit_corrected": "Field visit time corrected",
  "field_visits.visit_ended": "Field visit ended",
  "leave.cancelled": "Leave cancelled",
  "leave.requested": "Leave requested",
  "membership.provisioned": "Owner account created",
  "module.disabled": "Module switched off",
  "module.enabled": "Module switched on",
  "module.included_by_platform": "Module added to your plan",
  "module.removed_by_platform": "Module removed from your plan",
  "payroll.adjustment_added": "Pay adjustment added",
  "payroll.approved": "Payroll approved",
  "payroll.calculated": "Payroll calculated",
  "payroll.component_saved": "Pay item saved",
  "payroll.pay_setup_changed": "Pay setup changed",
  "payroll.salaries_bulk_set": "Salaries updated",
  "payroll.structure_saved": "Salary structure saved",
  "performance.boost_created": "Performance boost added",
  "performance.boost_deleted": "Performance boost removed",
  "performance.kudos_sent": "Kudos sent",
  "performance.scoring_published": "Performance scoring updated",
  "platform.trial_settings_changed": "Trial settings changed",
  "policy.attendance_changed": "Attendance rules changed",
  "policy.default_shift_changed": "Default shift changed",
  "policy.payroll_changed": "Pay rules changed",
  "policy.shift_saved": "Shift saved",
  "policy.work_calendar_changed": "Work calendar changed",
  "report.exported": "Report exported",
  "reward.created": "Reward added",
  "reward.redeemed": "Reward redeemed",
  "reward.redemption_cancelled": "Reward redemption cancelled",
  "reward.retired": "Reward retired",
  "role.permissions_changed": "Access level permissions changed",
  "settings.branch_created": "Work location added",
  "settings.branch_updated": "Work location changed",
  "settings.company_changed": "Company details changed",
  "settings.id_card_saved": "ID card design saved",
  "settings.logo_removed": "Logo removed",
  "settings.logo_set": "Logo updated",
  "settings.notifications_changed": "Notification settings changed",
  "settings.splash_off": "Opening animation switched off",
  "settings.splash_on": "Opening animation switched on",
  "settings.splash_removed": "Opening animation removed",
  "settings.splash_set": "Opening animation updated",
  "task.created": "Task created",
  "task.proof_file_viewed": "Task proof opened",
  "task.proof_submitted": "Task proof submitted",
  "task.started": "Task started",
  "tenant.created": "Company created",
  "tenant.owner_email_verified": "Owner email confirmed",
  "tenant.owner_email_verified_by_platform": "Owner email confirmed by Flowacord",
  "tenant.plan_set_by_platform": "Plan set by Flowacord",
  "tenant.self_signup": "Company signed up for a free trial",
  "tenant.trial_ended": "Free trial ended",
  "tenant.trial_extended": "Free trial extended",
  "tenant.converted_to_paid": "Moved to a paid plan",
  "tenant.suspended": "Company suspended",
  "tenant.restored": "Company restored",
};

/** Internal words and what people call them. */
const WORDS: Record<string, string> = {
  tenant: "company",
  membership: "employee",
  checkin: "check-in",
  checkout: "check-out",
};

/** "Invitation accepted" for "employee.invite_accepted"; a readable fallback otherwise. */
export function describeAction(key: string): string {
  const known = LABELS[key];
  if (known) return known;
  const words = key
    .split(/[._]+/)
    .filter(Boolean)
    .map((w) => WORDS[w.toLowerCase()] ?? w.toLowerCase());
  const sentence = words.join(" ").trim();
  return sentence ? sentence[0].toUpperCase() + sentence.slice(1) : "Change recorded";
}

export const ACTIVITY_LABEL_KEYS = Object.keys(LABELS);

const ENTITIES: Record<string, string> = {
  tenant: "Company",
  tenant_membership: "Employee",
  membership: "Employee",
  branch: "Work location",
  shift: "Shift",
  role: "Access level",
  designation: "Designation",
  department: "Department",
  employee_document: "Document",
  billing_payment: "Payment",
  billing_plan: "Plan",
  platform_setting: "Flowacord setting",
  tenant_policy: "Company rules",
  attendance_record: "Attendance",
  leave_request: "Leave",
  payroll_run: "Payroll",
  field_trip: "Field trip",
  field_visit: "Field visit",
  field_place: "Saved place",
};

/** "Employee" for "tenant_membership", and so on. */
export function describeEntity(entityType: string): string {
  const known = ENTITIES[entityType];
  if (known) return known;
  const words = entityType
    .split(/[._]+/)
    .filter(Boolean)
    .map((w) => WORDS[w.toLowerCase()] ?? w.toLowerCase());
  const text = words.join(" ");
  return text ? text[0].toUpperCase() + text.slice(1) : "Record";
}
