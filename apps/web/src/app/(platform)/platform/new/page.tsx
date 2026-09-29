import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { NewTenantForm } from "./NewTenantForm";

export const metadata: Metadata = { title: "Add a company" };

export default async function NewTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requirePlatformAdmin();
  const { from } = await searchParams;

  // Started from an enquiry: prefill what they already told us, so nobody
  // retypes it and gets it subtly wrong.
  const enquiry = from
    ? await getDb().demoRequest.findUnique({ where: { id: from } })
    : null;

  return (
    <>
      <h1 className="font-heading text-h1 text-text-primary">Add a company</h1>
      <p className="mt-1 max-w-[60ch] text-secondary text-text-secondary">
        This creates the company, its roles and permissions, and its module
        settings, then gives you a one-time link to send the owner. They
        choose their own password on that page — you never see it, and no
        password is set for them.
      </p>

      <div className="mt-5 max-w-[560px]">
        <NewTenantForm
          fromDemoRequestId={enquiry?.id}
          initialName={enquiry?.company ?? ""}
          initialOwnerName={enquiry?.name ?? ""}
        />
      </div>
    </>
  );
}
