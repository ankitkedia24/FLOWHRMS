import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { loadPayslip } from "@/lib/payroll/payslip";
import { PayslipDetail } from "@/components/payroll/PayslipDetail";
import { loadBranding } from "@/lib/branding/load";

export const metadata: Metadata = { title: "Payslip" };

/**
 * Admin payslip view (screen A16). Same breakdown the employee sees, in
 * admin context — `loadPayslip` already enforces the permission split.
 */
export default async function AdminPayslipPage({
  params,
}: {
  params: Promise<{ lineId: string }>;
}) {
  const { lineId } = await params;
  const { session, decision } = await checkAccess({
    module: "PAYROLL",
    permission: "payroll.view",
  });
  if (!decision.allowed) redirect("/unauthorized");
  if (devFixtureOffline()) notFound();

  const payslip = await loadPayslip(session, lineId);
  if (!payslip) notFound();

  return (
    <div className="flex max-w-[760px] flex-col gap-4">
      <div>
        <Link
          href="/admin/payroll"
          className="text-label text-brand-primary underline-offset-2 hover:underline"
        >
          ← Payroll
        </Link>
        <h1 className="mt-2 font-heading text-h1 text-text-primary">
          {payslip.employeeName}
        </h1>
      </div>
      <PayslipDetail
        data={payslip}
        company={{ name: session.tenant.name, logoUrl: (await loadBranding(session.tenant.id)).logoUrl }}
      />
    </div>
  );
}
