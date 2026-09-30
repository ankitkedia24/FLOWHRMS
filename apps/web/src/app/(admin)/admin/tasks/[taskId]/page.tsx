import { redirect } from "next/navigation";
import { z } from "zod";
import { checkAccess } from "@/lib/authz/guard";
import { loadRecordScope } from "@/lib/authz/record-scope";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { getDb } from "@/lib/db";
import { legacyTaskHref } from "@/lib/tasks/links";

const taskIdSchema = z.string().uuid();

/**
 * /admin/tasks/{taskId} — a forwarding address, not a page (Hardening
 * 7E.2). Notifications and approval tiles stored before batch 5 link here,
 * and a link in someone's bell should not end on a missing page. Access is
 * checked as the task list checks it, then the person is sent to the
 * task's proof card, or to the task list when the task is gone or not
 * theirs to see (lib/tasks/links.ts).
 */
export default async function AdminTaskLinkPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const { session, decision } = await checkAccess({
    module: "TASKS",
    permission: "tasks.view",
  });
  if (!decision.allowed) redirect("/unauthorized");

  // A malformed id names no task, and the database would only reject it.
  const task =
    taskIdSchema.safeParse(taskId).success && !devFixtureOffline()
      ? await getDb().task.findFirst({
          where: { id: taskId, tenantId: session.tenant.id },
          select: { assigneeId: true, createdById: true },
        })
      : null;

  redirect(
    legacyTaskHref({
      taskId,
      task,
      scope: task ? await loadRecordScope(session) : "all",
      actorId: session.membership.id,
    }),
  );
}
