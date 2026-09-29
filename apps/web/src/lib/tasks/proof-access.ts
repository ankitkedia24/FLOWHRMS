"use server";

import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROOF_BUCKET } from "./bucket";

/**
 * Signed access to task proof files.
 *
 * The bucket is private: nothing is served from a public path. A URL is
 * minted only after the caller's tenant and permission are checked, and
 * the access is recorded (Constitution §7 — sensitive access is logged).
 */
const SIGNED_URL_TTL_SECONDS = 120;

export type ProofUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function getProofFileUrl(fileId: string): Promise<ProofUrlResult> {
  const { session, decision } = await checkAccess({ module: "TASKS" });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const file = await db.proofFile.findFirst({
    where: { id: fileId, tenantId: session.tenant.id }, // tenant-scoped
    include: {
      proof: {
        include: { task: { select: { assigneeId: true, createdById: true } } },
      },
    },
  });
  if (!file) {
    // Never reveal whether a record exists in another tenant.
    return { ok: false, error: "That file is no longer available." };
  }

  // The assignee, the task's creator, or anyone who can manage tasks.
  const task = file.proof.task;
  const isOwnRecord =
    task.assigneeId === session.membership.id ||
    task.createdById === session.membership.id;
  if (!isOwnRecord && !session.permissions.has("tasks.manage")) {
    return { ok: false, error: "You don't have access to this file." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "File storage isn't configured yet. Ask your admin." };
  }

  const { data, error } = await supabase.storage
    .from(PROOF_BUCKET)
    .createSignedUrl(file.path, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    return { ok: false, error: "We couldn't open that file. Try again." };
  }

  await recordAuditEvent(session, {
    action: "task.proof_file_viewed",
    entityType: "proof_file",
    entityId: file.id,
    metadata: { name: file.name, taskId: file.proof.taskId },
  });

  return { ok: true, url: data.signedUrl };
}
