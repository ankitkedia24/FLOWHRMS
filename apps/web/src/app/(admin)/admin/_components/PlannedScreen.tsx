import type { ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";

/**
 * Shared frame for admin screens whose full functionality ships in a later
 * phase. The route, guard and navigation are real; the body is an approved
 * empty state or a labelled placeholder — never fake data.
 */
export function PlannedScreen({
  title,
  phase,
  children,
}: {
  title: string;
  /** e.g. "Phase 2 — Daily Operations" */
  phase: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-h1 text-text-primary">{title}</h1>
      <Alert variant="info" title={`Planned for ${phase}`}>
        This screen&apos;s layout, access control and navigation are live.
        Its full functionality is built in {phase} after approval.
      </Alert>
      {children && <Card flush>{children}</Card>}
    </div>
  );
}
