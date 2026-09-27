import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { checkAccess } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { normaliseLayout } from "@/lib/idcard/layout";
import { mediaUrls } from "@/lib/media/urls";
import { Alert } from "@/components/ui/Alert";
import { IdCardDesigner } from "./IdCardDesigner";

export const metadata: Metadata = { title: "ID card design" };

/** Design the company's ID card: its own artwork, with each person's photo and details placed on it. */
export default async function IdCardDesignPage() {
  const { session, decision } = await checkAccess({ module: "EMPLOYEES", permission: "settings.manage" });
  if (!decision.allowed) redirect("/unauthorized");
  if (devFixtureOffline()) return <Alert variant="info" title="Connect a database to design ID cards." />;

  const db = getDb();
  const [tenant, members] = await Promise.all([
    db.tenant.findUniqueOrThrow({
      where: { id: session.tenant.id },
      select: { idCardLayout: true, idCardBackgroundPath: true, logoPath: true },
    }),
    db.tenantMembership.findMany({
      where: { tenantId: session.tenant.id, status: "ACTIVE" },
      include: { user: true, department: true },
      // People with a photo first: the preview is more useful with one.
      orderBy: [{ photoPath: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: 20,
    }),
  ]);
  const urls = await mediaUrls([tenant.idCardBackgroundPath, tenant.logoPath, ...members.map((m) => m.photoPath)]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-1 text-label text-brand-primary underline-offset-2 hover:underline"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Company settings
        </Link>
        <h1 className="mt-2 font-heading text-h1 text-text-primary">ID card design</h1>
        <p className="mt-1 max-w-[70ch] text-body text-text-secondary">
          Upload your card artwork, then place the photo and details. Every employee&apos;s card uses this design; print
          them from here or from each person&apos;s profile.
        </p>
      </div>
      <IdCardDesigner
        tenantId={session.tenant.id}
        initialLayout={normaliseLayout(tenant.idCardLayout)}
        backgroundUrl={tenant.idCardBackgroundPath ? (urls.get(tenant.idCardBackgroundPath) ?? null) : null}
        logoUrl={tenant.logoPath ? (urls.get(tenant.logoPath) ?? null) : null}
        samples={members.map((m) => ({
          id: m.id,
          photoUrl: m.photoPath ? (urls.get(m.photoPath) ?? null) : null,
          person: {
            name: m.user.displayName,
            designation: m.designation,
            employeeCode: m.employeeCode,
            department: m.department?.name ?? null,
            bloodGroup: m.bloodGroup,
            phone: m.user.phone,
          },
        }))}
      />
    </div>
  );
}
