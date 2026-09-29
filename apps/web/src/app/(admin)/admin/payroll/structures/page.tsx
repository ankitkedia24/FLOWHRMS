import { redirect } from "next/navigation";

/**
 * The salary screen moved to /admin/payroll/salaries when pay setup was
 * simplified (D-P10-01). Old bookmarks and links land here.
 */
export default function SalaryStructuresMoved() {
  redirect("/admin/payroll/salaries");
}
