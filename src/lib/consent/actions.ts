"use server";

import { z } from "zod";
import { getDb } from "@/lib/db";
import { getAppSession } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { emailConfigured, sendMail } from "@/lib/email/send";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CONTROLLER, CURRENT_DOCUMENTS, type DocumentKey } from "./documents";
import { choicesFor, requiredNoticeKeys, type PurposeChoice } from "./chain";
import {
  consentStandings,
  recordConsents,
  requestMeta,
  type ConsentEntry,
} from "./record";
import { DATA_REQUEST_DAYS, DATA_REQUEST_TYPES, dataRequestDueDate } from "./requests";

/**
 * Consent and data-rights actions for signed-in people, and the
 * Flowacord-side actions that answer them.
 *
 * These use getAppSession() rather than requireSession(): requireSession
 * sends anyone with outstanding consent to /consent, and these are the
 * actions that let them get out of it.
 */

type Result =
  | { ok: true; message: string; detail?: string }
  | { ok: false; error: string };

const KEY = z.enum(["account_holder", "customer_terms", "employee"]);

function subjectFor(key: DocumentKey): "ACCOUNT_HOLDER" | "EMPLOYEE" {
  return key === "employee" ? "EMPLOYEE" : "ACCOUNT_HOLDER";
}

/** Accept the notices on /consent. Only boxes actually ticked count. */
export async function acceptNoticesAction(input: {
  choices: Partial<Record<DocumentKey, string[]>>;
}): Promise<Result> {
  const session = await getAppSession();
  if (!session || session.source !== "supabase") {
    return { ok: false, error: "Sign in again to continue." };
  }
  const required = requiredNoticeKeys({
    isOwner: session.membership.roleKey === "OWNER",
  });
  const keys = Object.keys(input.choices).filter((k): k is DocumentKey =>
    KEY.safeParse(k).success && required.includes(k as DocumentKey),
  );
  if (keys.length === 0) return { ok: false, error: "Nothing to accept." };

  const meta = await requestMeta();
  const entries: ConsentEntry[] = [];
  for (const key of keys) {
    const doc = CURRENT_DOCUMENTS[key];
    const result = choicesFor(doc, input.choices[key] ?? []);
    if (!result.ok) {
      return {
        ok: false,
        error: `Tick every required box in "${doc.title}" to continue.`,
      };
    }
    entries.push({
      noticeKey: key,
      subject: subjectFor(key),
      action: "GRANTED",
      purposes: result.choices,
      userId: session.user.id,
      email: session.user.email ?? "",
      tenantId: session.tenant.id,
      tenantName: session.tenant.name,
      method: "checkbox+submit:/consent",
      withDocuments: key === "customer_terms" ? ["terms", "privacy"] : undefined,
      ...meta,
    });
  }

  await recordConsents(entries);
  await recordAuditEvent(session, {
    action: "consent.granted",
    entityType: "user",
    entityId: session.user.id,
    metadata: {
      notices: entries.map((e) => `${e.noticeKey} v${CURRENT_DOCUMENTS[e.noticeKey].version}`),
    },
  });
  return { ok: true, message: "Thank you — your consent is recorded." };
}

/** Change the optional choice (product updates) without touching the rest. */
export async function updateOptionalConsentAction(input: {
  productUpdates: boolean;
}): Promise<Result> {
  const session = await getAppSession();
  if (!session || session.source !== "supabase") {
    return { ok: false, error: "Sign in again to continue." };
  }
  if (session.membership.roleKey !== "OWNER") {
    return { ok: false, error: "There are no optional choices on your notice." };
  }
  const [standing] = await consentStandings(session.user.id, ["account_holder"]);
  if (standing.status.state !== "current") {
    return { ok: false, error: "Accept the current notice first." };
  }
  const choices: PurposeChoice[] = standing.status.choices.map((c) =>
    c.key === "product_updates" ? { ...c, granted: input.productUpdates } : c,
  );
  const meta = await requestMeta();
  await recordConsents([
    {
      noticeKey: "account_holder",
      subject: "ACCOUNT_HOLDER",
      action: "UPDATED",
      purposes: choices,
      userId: session.user.id,
      email: session.user.email ?? "",
      tenantId: session.tenant.id,
      tenantName: session.tenant.name,
      method: "toggle:/account/privacy",
      ...meta,
    },
  ]);
  return {
    ok: true,
    message: input.productUpdates
      ? "You'll receive product updates."
      : "Product updates are off. Nothing else has changed.",
  };
}

/**
 * Withdraw consent entirely — as easy as giving it (s.6(4)). The records
 * are written, a request goes to Flowacord to close the account and erase
 * what the law allows, and the person is signed out. If they sign in
 * again they are asked to consent again.
 */
export async function withdrawAllConsentAction(input: {
  reason?: string;
}): Promise<Result> {
  const session = await getAppSession();
  if (!session || session.source !== "supabase") {
    return { ok: false, error: "Sign in again to continue." };
  }
  const keys = requiredNoticeKeys({ isOwner: session.membership.roleKey === "OWNER" });
  const meta = await requestMeta();
  await recordConsents(
    keys.map((key) => ({
      noticeKey: key,
      subject: subjectFor(key),
      action: "WITHDRAWN" as const,
      purposes: CURRENT_DOCUMENTS[key].purposes.map((p) => ({
        key: p.key,
        label: p.label,
        required: p.required,
        granted: false,
      })),
      userId: session.user.id,
      email: session.user.email ?? "",
      tenantId: session.tenant.id,
      tenantName: session.tenant.name,
      method: "button:/account/privacy",
      ...meta,
    })),
  );

  const reason = input.reason?.trim().slice(0, 2000) ?? "";
  await createDataRequest({
    type: "WITHDRAWAL",
    details: `Consent withdrawn; close the account and erase data the law allows.${reason ? `\n\nReason given: ${reason}` : ""}`,
    session,
  });
  await recordAuditEvent(session, {
    action: "consent.withdrawn",
    entityType: "user",
    entityId: session.user.id,
    metadata: { notices: keys },
  });

  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  return { ok: true, message: "Your consent is withdrawn and you've been signed out." };
}

const requestSchema = z.object({
  type: z.enum(DATA_REQUEST_TYPES),
  details: z
    .string()
    .trim()
    .min(10, "Tell us a little more, so we can act on it.")
    .max(2000, "Please keep this under 2000 characters."),
});

/** Access / correction / erasure / grievance, answered within 90 days. */
export async function submitDataRequestAction(
  input: z.input<typeof requestSchema>,
): Promise<Result> {
  const session = await getAppSession();
  if (!session || session.source !== "supabase") {
    return { ok: false, error: "Sign in again to continue." };
  }
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the request." };
  }
  const due = await createDataRequest({ ...parsed.data, session });
  return {
    ok: true,
    message: "Your request is recorded.",
    detail: `We'll respond by ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: session.tenant.timezone }).format(due)} at the latest (${DATA_REQUEST_DAYS} days). You'll hear from ${CONTROLLER.email}.`,
  };
}

async function createDataRequest(input: {
  type: (typeof DATA_REQUEST_TYPES)[number];
  details: string;
  session: NonNullable<Awaited<ReturnType<typeof getAppSession>>>;
}): Promise<Date> {
  const dueAt = dataRequestDueDate(new Date());
  const row = await getDb().dataRequest.create({
    data: {
      userId: input.session.user.id,
      email: input.session.user.email ?? "",
      tenantId: input.session.tenant.id,
      tenantName: input.session.tenant.name,
      type: input.type,
      details: input.details,
      dueAt,
    },
  });
  await recordAuditEvent(input.session, {
    action: "data_request.created",
    entityType: "data_request",
    entityId: row.id,
    metadata: { type: input.type },
  });
  if (emailConfigured() && process.env.SMTP_USER) {
    const lines = [
      `Type:    ${input.type}`,
      `From:    ${input.session.user.displayName} <${input.session.user.email ?? "no email"}>`,
      `Company: ${input.session.tenant.name}`,
      `Due by:  ${dueAt.toISOString().slice(0, 10)}`,
      "",
      input.details,
    ];
    await sendMail({
      to: process.env.SMTP_USER,
      subject: `FlowHRMS data request (${input.type}) — ${input.session.tenant.name}`,
      text: lines.join("\n"),
      html: `<pre style="font:14px ui-monospace,monospace">${lines
        .join("\n")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</pre>`,
    });
  }
  return dueAt;
}

// ------------------------------------------------------------ Flowacord side

export async function markNoticeReviewedAction(input: {
  noticeId: string;
}): Promise<Result> {
  const session = await requirePlatformAdmin();
  const id = z.string().uuid().safeParse(input.noticeId);
  if (!id.success) return { ok: false, error: "That notice no longer exists." };
  const db = getDb();
  const notice = await db.consentNotice.findUnique({ where: { id: id.data } });
  if (!notice) return { ok: false, error: "That notice no longer exists." };
  if (notice.legalReviewed) return { ok: true, message: "Already marked as reviewed." };
  await db.consentNotice.update({
    where: { id: notice.id },
    data: {
      legalReviewed: true,
      legalReviewedAt: new Date(),
      legalReviewedBy: session.user.displayName,
    },
  });
  await db.auditEvent.create({
    data: {
      tenantId: null,
      actorType: "USER",
      actorUserId: session.user.id,
      action: "consent_notice.legal_reviewed",
      entityType: "consent_notice",
      entityId: notice.id,
      metadata: { key: notice.key, version: notice.version },
    },
  });
  return { ok: true, message: `${notice.title} v${notice.version} marked as legally reviewed.` };
}

const updateRequestSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"]),
  response: z.string().trim().max(4000).optional(),
});

export async function updateDataRequestAction(
  input: z.input<typeof updateRequestSchema>,
): Promise<Result> {
  const session = await requirePlatformAdmin();
  const parsed = updateRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the update." };
  if (
    (parsed.data.status === "RESOLVED" || parsed.data.status === "REJECTED") &&
    !parsed.data.response
  ) {
    return { ok: false, error: "Say what was done. It goes on the record." };
  }
  const db = getDb();
  const request = await db.dataRequest.findUnique({ where: { id: parsed.data.id } });
  if (!request) return { ok: false, error: "That request no longer exists." };
  await db.dataRequest.update({
    where: { id: request.id },
    data: {
      status: parsed.data.status,
      response: parsed.data.response || request.response,
      handledById: session.user.id,
      handledAt: new Date(),
    },
  });
  await db.auditEvent.create({
    data: {
      tenantId: request.tenantId,
      actorType: "USER",
      actorUserId: session.user.id,
      action: "data_request.updated",
      entityType: "data_request",
      entityId: request.id,
      before: { status: request.status },
      after: { status: parsed.data.status },
    },
  });
  return { ok: true, message: "Request updated." };
}
