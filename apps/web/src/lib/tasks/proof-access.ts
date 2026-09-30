"use server";

import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { proofPathOk } from "@/lib/storage/paths";
import { signPrivateFile } from "@/lib/storage/sign";
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

  // Defence in depth: never sign a stored path outside this task's
  // folder, however it got into the row.
  if (!proofPathOk(file.path, session.tenant.id, file.proof.taskId)) {
    return { ok: false, error: "That file can't be opened. Ask for it to be uploaded again." };
  }

  // Signed with the service role only now, after every check above.
  const signed = await signPrivateFile(PROOF_BUCKET, file.path, SIGNED_URL_TTL_SECONDS);
  if (!signed.ok) {
    return {
      ok: false,
      error:
        signed.reason === "unconfigured"
          ? "File storage isn't configured yet. Ask your admin."
          : "We couldn't open that file. Try again.",
    };
  }

  await recordAuditEvent(session, {
    action: "task.proof_file_viewed",
    entityType: "proof_file",
    entityId: file.id,
    metadata: { name: file.name, taskId: file.proof.taskId },
  });

  return { ok: true, url: signed.url };
}
