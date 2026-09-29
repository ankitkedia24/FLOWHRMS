import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { getDb } from "@/lib/db";
import { Alert } from "@/components/ui/Alert";
import { loadFieldVisitsPolicy } from "@/lib/field-visits/access";
import { DEFAULT_FIELD_VISITS_POLICY } from "@/lib/field-visits/policy";
import { FieldVisitsEditor } from "./FieldVisitsEditor";

export const metadata: Metadata = { title: "Field visit rules" };

/**
 * The field visit rules (FIELD-VISITS-MODULE.md §6): the company's word
 * for what its people visit, purposes, photo, approval and nudges, who
 * records, and the vehicles travel is paid for. Publishing is the
 * deliberate act; nothing can be recorded before the first version.
 */
export default async function FieldVisitRulesPage() {
  const { session, decision } = await checkAccess({
    module: "FIELD_VISITS",
    permission: "policy.edit",
  });
  if (!decision.allowed) redirect("/unauthorized");

  const offline = devFixtureOffline();
  const published = offline ? null : await loadFieldVisitsPolicy(session.tenant.id);
  const departments = offline
    ? []
    : await getDb().department.findMany({
        where: { tenantId: session.tenant.id, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

  return (
    <div className="flex max-w-[860px] flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">Field visit rules</h1>
        <Link
          href="/admin/settings"
          className="text-label text-brand-primary underline-offset-2 hover:underline"
        >
          Back to settings
        </Link>
      </div>

      {published ? (
        <Alert variant="info" title={`Version ${published.version} is live.`}>
          Publishing again creates version {published.version + 1}. Trips already made keep the
          rules they started under.
        </Alert>
      ) : (
        <Alert variant="warning" title="Not published yet — nobody can record visits.">
          These are suggested settings. Change what does not fit your company and publish.
          Location is saved only when someone taps, never in between.
        </Alert>
      )}

      <FieldVisitsEditor
        initial={published?.policy ?? DEFAULT_FIELD_VISITS_POLICY}
        published={Boolean(published)}
        departments={departments}
      />
    </div>
  );
}
