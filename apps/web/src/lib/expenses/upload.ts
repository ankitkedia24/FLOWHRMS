"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  RECEIPT_BUCKET,
  RECEIPT_MAX_BYTES,
  RECEIPT_MIME,
} from "./bucket";

/**
 * Upload a receipt to the PRIVATE bucket (EXPENSES-MODULE.md §10), the way
 * task proof and employee documents already do: the browser writes under
 * the tenant prefix, the server records the path at submission and reads
 * it back only through short-lived signed URLs. Photos are downscaled
 * client-side first (mobile-first guidelines §5).
 */
const MAX_LONG_EDGE = 2000;

export type ReceiptUploadResult =
  | { ok: true; path: string; name: string; mime: string; sizeBytes: number }
  | { ok: false; error: string };

async function downscale(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const longEdge = Math.max(bitmap.width, bitmap.height);
    if (longEdge <= MAX_LONG_EDGE) return file;

    const scale = MAX_LONG_EDGE / longEdge;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    return blob ?? file;
  } catch {
    return file; // never block an upload on a downscale failure
  }
}

/**
 * `draftId` is a client-generated UUID for this submission; the server
 * accepts only paths under `${tenantId}/` and records them against the
 * claim it creates.
 */
export async function uploadReceipt(
  tenantId: string,
  draftId: string,
  file: File,
): Promise<ReceiptUploadResult> {
  if (file.size > RECEIPT_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(0);
    return { ok: false, error: `That file is too large (${mb} MB). Choose a file under 10 MB.` };
  }
  const mime = file.type || "application/octet-stream";
  if (!(RECEIPT_MIME as readonly string[]).includes(mime)) {
    return { ok: false, error: `${file.name}: use a JPG, PNG, WebP, HEIC or PDF.` };
  }

  let supabase;
  try {
    supabase = createSupabaseBrowserClient();
  } catch {
    return { ok: false, error: "File storage isn’t configured yet. Ask your admin." };
  }

  const body = await downscale(file);
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${tenantId}/${draftId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(path, body, { contentType: body.type || mime, upsert: false });

  if (error) {
    return { ok: false, error: `${file.name} didn’t upload. Try again.` };
  }

  return { ok: true, path, name: file.name, mime: body.type || mime, sizeBytes: body.size };
}
