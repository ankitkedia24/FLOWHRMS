"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PROOF_BUCKET, PROOF_MAX_LONG_EDGE } from "./bucket";

/**
 * Upload task proof to the PRIVATE Supabase bucket.
 *
 * Storage rules (SYSTEM-ARCHITECTURE.md security boundary):
 * - Files live outside any public path; the bucket must be private and
 *   read back only through signed URLs.
 * - Paths are tenant-prefixed by the server-side session at read time; the
 *   client writes under its own task id, and the server records the path.
 * - Photos are downscaled client-side to a 2000px long edge before upload
 *   (mobile-first guidelines §5).
 */
const MAX_LONG_EDGE = PROOF_MAX_LONG_EDGE;

export type UploadResult =
  | {
      ok: true;
      files: Array<{ path: string; name: string; mime: string; sizeBytes: number }>;
    }
  | { ok: false; error: string };

/** Downscale an image; non-images pass through untouched. */
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
    return file; // never block a submission on a downscale failure
  }
}

export async function uploadProofFiles(
  taskId: string,
  files: File[],
): Promise<UploadResult> {
  if (files.length === 0) return { ok: true, files: [] };

  let supabase;
  try {
    supabase = createSupabaseBrowserClient();
  } catch {
    return {
      ok: false,
      error: "File storage isn't configured yet. Ask your admin.",
    };
  }

  const uploaded: Array<{
    path: string;
    name: string;
    mime: string;
    sizeBytes: number;
  }> = [];

  for (const file of files) {
    const body = await downscale(file);
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${taskId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage
      .from(PROOF_BUCKET)
      .upload(path, body, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      // Per-file failure: say which file and what to do next.
      return {
        ok: false,
        error: `${file.name} didn't upload. Retry — other files are unaffected.`,
      };
    }

    uploaded.push({
      path,
      name: file.name,
      mime: file.type || "application/octet-stream",
      sizeBytes: body.size,
    });
  }

  return { ok: true, files: uploaded };
}
