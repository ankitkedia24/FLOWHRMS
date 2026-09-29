import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { loadPayslip } from "@/lib/payroll/payslip";
import { PayslipDetail } from "@/components/payroll/PayslipDetail";
import { loadBranding } from "@/lib/branding/load";

export const metadata: Metadata = { title: "Payslip" };

/** Payslip details (screen E19). */
export default async function PayslipPage({
  params,
}: {
  params: Promise<{ lineId: string }>;
}) {
  const { lineId } = await params;
  const { session, decision } = await checkAccess({ module: "PAYROLL" });
  if (!decision.allowed) redirect("/unauthorized");
  if (devFixtureOffline()) notFound();

  const payslip = await loadPayslip(session, lineId);
  if (!payslip) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mt-2 font-heading text-h1 text-text-primary">
        {payslip.periodLabel}
      </h1>
      <PayslipDetail
        data={payslip}
        company={{ name: session.tenant.name, logoUrl: (await loadBranding(session.tenant.id)).logoUrl }}
      />
    </div>
  );
}
