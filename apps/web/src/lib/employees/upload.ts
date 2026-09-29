"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { DOCUMENT_BUCKET, DOCUMENT_MAX_BYTES } from "./bucket";

/**
 * Upload an employee document to the PRIVATE bucket. Photos are
 * downscaled client-side before upload, as for task proof.
 */
const MAX_LONG_EDGE = 2000;

export type UploadResult =
  | { ok: true; path: string; mime: string; sizeBytes: number }
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

export async function uploadDocument(
  membershipId: string,
  file: File,
): Promise<UploadResult> {
  if (file.size > DOCUMENT_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(0);
    return {
      ok: false,
      error: `That file is too large (${mb} MB). Choose a file under 10 MB.`,
    };
  }

  let supabase;
  try {
    supabase = createSupabaseBrowserClient();
  } catch {
    return { ok: false, error: "File storage isn't configured yet. Ask your admin." };
  }

  const body = await downscale(file);
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${membershipId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, body, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    return { ok: false, error: `${file.name} didn't upload. Try again.` };
  }

  return {
    ok: true,
    path,
    mime: file.type || "application/octet-stream",
    sizeBytes: body.size,
  };
}
