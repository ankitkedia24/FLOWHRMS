import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { cardSizeMm, normaliseLayout } from "@/lib/idcard/layout";
import { mediaUrls } from "@/lib/media/urls";
import { IdCardView } from "@/components/idcard/IdCardView";
import { PrintButton } from "@/app/subscription/invoice/[id]/PrintButton";

export const metadata: Metadata = { title: "ID cards", robots: { index: false } };

/**
 * ID cards, laid out on A4 at true size (85.6 × 54 mm, with light cut
 * lines) — nine upright cards or ten sideways ones per sheet.
 *
 * ?member=me     your own card (anyone)
 * ?member=<id>   one person's card (needs employees.view)
 * ?all=1         everyone active, optionally &department=<id>
 */
export default async function PrintIdCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; all?: string; department?: string }>;
}) {
  const session = await requireSession();
  const q = await searchParams;
  const db = getDb();
  const tenantId = session.tenant.id;
  const own = q.member === "me";
  const canViewOthers = session.permissions.has("employees.view");

  if (!own && !canViewOthers) redirect("/unauthorized");
  const isUuid = (v: string | undefined) => Boolean(v && /^[0-9a-f-]{36}$/i.test(v));

  const where = own
    ? { tenantId, id: session.membership.id }
    : isUuid(q.member)
      ? { tenantId, id: q.member }
      : q.all === "1"
        ? { tenantId, status: "ACTIVE" as const, ...(isUuid(q.department) ? { departmentId: q.department } : {}) }
        : null;
  if (!where) notFound();

  const [tenant, members] = await Promise.all([
    db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true, idCardLayout: true, idCardBackgroundPath: true, logoPath: true },
    }),
    db.tenantMembership.findMany({
      where,
      include: { user: true, department: true },
      orderBy: [{ user: { displayName: "asc" } }],
      take: 500,
    }),
  ]);
  if (members.length === 0) notFound();

  const layout = normaliseLayout(tenant.idCardLayout);
  const urls = await mediaUrls([tenant.idCardBackgroundPath, tenant.logoPath, ...members.map((m) => m.photoPath)]);
  const mm = cardSizeMm(layout.orientation);
  const back = own ? "/profile" : members.length === 1 ? `/admin/employees/${members[0].id}` : "/admin/employees";
  const noDesign = !tenant.idCardBackgroundPath;

  return (
    <main className="min-h-dvh bg-surface-canvas print:bg-white">
      <style>{`@page { size: A4; margin: 10mm; }`}</style>
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-4 print:hidden">
        <Link href={back} className="text-label text-brand-primary underline-offset-2 hover:underline">
          ← Back
        </Link>
        <p className="text-secondary text-text-secondary">
          {members.length} {members.length === 1 ? "card" : "cards"} · print at 100% (&ldquo;Actual size&rdquo;) for true card size
        </p>
        <PrintButton />
      </div>
      {noDesign && (
        <p className="mx-auto mb-3 max-w-[210mm] px-4 text-secondary text-status-warning-text print:hidden">
          No card design uploaded yet, so these are plain cards with your logo. Upload your design in Company settings → ID
          card design.
        </p>
      )}
      <div
        className="mx-auto grid w-fit justify-center gap-[4mm] bg-white p-[6mm] print:p-0"
        style={{ gridTemplateColumns: `repeat(${layout.orientation === "portrait" ? 3 : 2}, ${mm.w}mm)` }}
      >
        {members.map((m) => (
          <div key={m.id} className="break-inside-avoid outline outline-[0.2mm] outline-dashed outline-[#c9c7dc] outline-offset-[1mm]">
            <IdCardView
              layout={layout}
              height={`${mm.h}mm`}
              backgroundUrl={tenant.idCardBackgroundPath ? (urls.get(tenant.idCardBackgroundPath) ?? null) : null}
              logoUrl={tenant.logoPath ? (urls.get(tenant.logoPath) ?? null) : null}
              photoUrl={m.photoPath ? (urls.get(m.photoPath) ?? null) : null}
              person={{
                name: m.user.displayName,
                designation: m.designation,
                employeeCode: m.employeeCode,
                department: m.department?.name ?? null,
                bloodGroup: m.bloodGroup,
                phone: m.user.phone,
              }}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
