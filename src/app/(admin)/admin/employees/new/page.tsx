import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { emailConfigured } from "@/lib/email/send";
import { supabaseAdminConfigured } from "@/lib/supabase/admin";
import { loadEmployeeFormOptions } from "@/lib/employees/form-options";
import { Alert } from "@/components/ui/Alert";
import { InviteEmployeeForm } from "./InviteEmployeeForm";

export const metadata: Metadata = { title: "Add employee" };

/**
 * Add an employee, and invite them to sign in.
 *
 * Guarded server-side on `employees.manage` — the missing "Add" button on
 * the directory is a courtesy, this is the control (Constitution §5).
 */
export default async function NewEmployeePage() {
  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "employees.manage",
  });
  if (!decision.allowed) redirect("/unauthorized");

  if (devFixtureOffline()) {
    return (
      <Alert variant="info" title="Connect a database to add employees." />
    );
  }

  const [options, managers] = await Promise.all([
    loadEmployeeFormOptions(session),
    getDb().tenantMembership.findMany({
      where: { tenantId: session.tenant.id, status: "ACTIVE" },
      include: { user: true },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ]);

  return (
    <div className="flex max-w-[720px] flex-col gap-5">
      <div>
        <Link
          href="/admin/employees"
          className="inline-flex items-center gap-1 text-label text-brand-primary underline-offset-2 hover:underline"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Employees
        </Link>
        <h1 className="mt-2 font-heading text-h1 text-text-primary">Add employee</h1>
        <p className="mt-1 text-body text-text-secondary">
          Only a name, mobile number and designation are needed. Everything else can come later.
        </p>
      </div>

      {!supabaseAdminConfigured() && (
        <Alert variant="warning" title="Sign-in accounts aren't connected yet">
          You can add people and record their attendance, but nobody can sign in until the Supabase secret key is
          configured (DEPLOY.md, step 3).
        </Alert>
      )}

      <InviteEmployeeForm
        tenantId={session.tenant.id}
        options={options}
        managers={managers.map((m) => ({ value: m.id, label: m.user.displayName }))}
        emailConfigured={emailConfigured()}
      />
    </div>
  );
}
