import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { getPolicy, getPolicyVersion } from "@/lib/policies";
import { Alert } from "@/components/ui/Alert";
import {
  DEFAULT_SCORING,
  normalizeScoring,
  type ScoringPolicy,
} from "@/lib/performance/scoring";
import { ScoringEditor } from "./ScoringEditor";

export const metadata: Metadata = { title: "Performance scoring" };

/**
 * The scoring definition editor (PERFORMANCE-MODULE.md §E).
 *
 * Every rule is its own switch with its own value — reward culture varies
 * company to company, so the module bends. Publishing is the deliberate
 * act: points only count once a version exists.
 */
export default async function PerformanceScoringPage() {
  const { session, decision } = await checkAccess({
    module: "PERFORMANCE",
    permission: "settings.manage",
  });
  if (!decision.allowed) redirect("/unauthorized");

  const published = devFixtureOffline()
    ? null
    : await getPolicy<ScoringPolicy>(session.tenant.id, "performance");
  const version = published
    ? await getPolicyVersion(session.tenant.id, "performance")
    : 0;

  const current = published ? normalizeScoring(published) : DEFAULT_SCORING;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-text-primary">
          Performance scoring
        </h1>
        <Link
          href="/admin/settings"
          className="text-label text-brand-primary underline-offset-2 hover:underline"
        >
          Back to settings
        </Link>
      </div>

      {published ? (
        <Alert
          variant="info"
          title={`Version ${version} is live. Employees can see these rules.`}
        >
          Publishing again creates version {version + 1}. Points already
          earned keep the version that awarded them — history is never
          rewritten.
        </Alert>
      ) : (
        <Alert variant="warning" title="Not published yet — points are not counting.">
          Points derive only from attendance and tasks, and they only start
          counting once you publish. Review the rules, switch off anything
          that doesn&apos;t fit your company, and publish.
        </Alert>
      )}

      <ScoringEditor initial={current} published={Boolean(published)} />
    </div>
  );
}
