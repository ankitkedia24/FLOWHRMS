"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { awardForOnboarding } from "@/lib/performance/award";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DOCUMENT_BUCKET } from "./bucket";

/**
 * Employee documents (V1 core per the Pack 01 README).
 *
 * Privacy (Constitution §7): files live in a PRIVATE bucket, are read only
 * through short-lived signed URLs, access is permission-checked and every
 * view is recorded. An employee always sees their own; HR and permitted
 * roles see others'.
 */

export type ActionResult =
  | { ok: true; message: string; detail?: string }
  | { ok: false; error: string };

const SIGNED_URL_TTL_SECONDS = 120;

const uploadSchema = z.object({
  /** Omitted = the signed-in person's own record. */
  membershipId: z.string().uuid().optional(),
  kind: z.string().trim().min(1, "Say what the document is.").max(80),
  name: z.string().trim().min(1).max(200),
  path: z.string().trim().min(1),
  mime: z.string().trim().min(1),
  sizeBytes: z.number().int().positive(),
});

export async function saveDocumentAction(
  input: z.input<typeof uploadSchema>,
): Promise<ActionResult> {
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the document details.",
    };
  }

  const { session, decision } = await checkAccess({ module: "EMPLOYEES" });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const targetId = parsed.data.membershipId ?? session.membership.id;
  const isOwn = targetId === session.membership.id;

  // Uploading for someone else needs the manage permission.
  if (!isOwn && !session.permissions.has("employees.manage")) {
    return { ok: false, error: "You can only add your own documents." };
  }

  const membership = await db.tenantMembership.findFirst({
    where: { id: targetId, tenantId: session.tenant.id },
  });
  if (!membership) {
    return { ok: false, error: "That employee is no longer available." };
  }

  const document = await db.employeeDocument.create({
    data: {
      tenantId: session.tenant.id,
      membershipId: membership.id,
      kind: parsed.data.kind,
      name: parsed.data.name,
      path: parsed.data.path,
      mime: parsed.data.mime,
      sizeBytes: parsed.data.sizeBytes,
      uploadedById: session.user.id,
    },
  });

  await recordAuditEvent(session, {
    action: "document.uploaded",
    entityType: "employee_document",
    entityId: document.id,
    after: { kind: document.kind, name: document.name, own: isOwn },
  });

  revalidatePath("/documents");
  revalidatePath(`/admin/employees/${membership.id}`);

  return {
    ok: true,
    message: "Document added.",
    detail: "HR will review it and let you know.",
  };
}

const reviewSchema = z.object({
  documentId: z.string().uuid(),
  decision: z.enum(["VERIFIED", "REJECTED"]),
  reason: z.string().trim().max(500).optional(),
});

/** Verify a document, or ask for a better copy with a reason. */
export async function reviewDocumentAction(
  input: z.input<typeof reviewSchema>,
): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That decision could not be read." };
  }

  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "employees.manage",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  // Rejecting always needs a reason the employee can act on.
  const reason = parsed.data.reason?.trim();
  if (parsed.data.decision === "REJECTED" && !reason) {
    return { ok: false, error: "Say what is wrong so they can send a better copy." };
  }

  const db = getDb();
  const document = await db.employeeDocument.findFirst({
    where: { id: parsed.data.documentId, tenantId: session.tenant.id },
  });
  if (!document) {
    return { ok: false, error: "That document is no longer available." };
  }
  if (document.status !== "PENDING_REVIEW") {
    return { ok: false, error: "This document has already been reviewed." };
  }

  await db.employeeDocument.update({
    where: { id: document.id },
    data: {
      status: parsed.data.decision,
      reviewedById: session.membership.id,
      reviewedAt: new Date(),
      reviewReason: reason,
    },
  });

  await recordAuditEvent(session, {
    action: `document.${parsed.data.decision.toLowerCase()}`,
    entityType: "employee_document",
    entityId: document.id,
    reason,
    before: { status: document.status },
    after: { status: parsed.data.decision },
  });

  if (parsed.data.decision === "VERIFIED") {
    // Amendment 2, rule 19: a verified document may have just completed
    // onboarding (one-time; the award layer judges and dedupes).
    await awardForOnboarding({
      session,
      membershipId: document.membershipId,
    });
  }

  revalidatePath("/documents");
  revalidatePath(`/admin/employees/${document.membershipId}`);

  return {
    ok: true,
    message:
      parsed.data.decision === "VERIFIED"
        ? "Document verified."
        : "A better copy has been requested.",
  };
}

export type DocumentUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** Open a document: permission-checked, audited, short-lived signed URL. */
export async function getDocumentUrl(
  documentId: string,
): Promise<DocumentUrlResult> {
  const { session, decision } = await checkAccess({ module: "EMPLOYEES" });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to this." };
  }

  const db = getDb();
  const document = await db.employeeDocument.findFirst({
    where: { id: documentId, tenantId: session.tenant.id }, // tenant-scoped
    include: { membership: { include: { user: true } } },
  });
  if (!document) {
    // Never reveal whether a record exists in another tenant.
    return { ok: false, error: "That document is no longer available." };
  }

  const isOwn = document.membershipId === session.membership.id;
  if (!isOwn && !session.permissions.has("documents.view")) {
    return { ok: false, error: "You don't have access to this document." };
  }
  // Downloading someone else's document is the separately-permissioned,
  // sensitive action (USER-ROLES.md).
  if (!isOwn && !session.permissions.has("documents.download")) {
    return {
      ok: false,
      error: "You can see that this document exists, but not open it.",
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "File storage isn't configured yet. Ask your admin." };
  }

  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(document.path, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    return { ok: false, error: "We couldn't open that file. Try again." };
  }

  await recordAuditEvent(session, {
    action: "document.viewed",
    entityType: "employee_document",
    entityId: document.id,
    metadata: {
      name: document.name,
      employee: document.membership.user.displayName,
      own: isOwn,
    },
  });

  return { ok: true, url: data.signedUrl };
}
