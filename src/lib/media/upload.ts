"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MEDIA_BUCKET, MEDIA_MAX_BYTES, type MediaKind } from "./bucket";

/**
 * Browser → private storage, for company media. Images are cut down here
 * first: an ID photo needs 600 px, not a 12-megapixel camera frame.
 */

export type MediaUpload = { ok: true; path: string } | { ok: false; error: string };

function randomName(ext: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `${Date.now()}-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}.${ext}`;
}

export async function uploadMedia(
  tenantId: string,
  kind: MediaKind,
  body: Blob,
  ext: string,
): Promise<MediaUpload> {
  if (body.size > MEDIA_MAX_BYTES) return { ok: false, error: "That file is over 10 MB. Choose a smaller one." };
  let supabase;
  try {
    supabase = createSupabaseBrowserClient();
  } catch {
    return { ok: false, error: "File storage isn't set up yet." };
  }
  const path = `${tenantId}/${kind}/${randomName(ext)}`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, body, { contentType: body.type || "application/octet-stream", upsert: false });
  return error ? { ok: false, error: "The upload didn't go through. Try again." } : { ok: true, path };
}

async function draw(
  file: Blob,
  width: number,
  height: number,
  crop: (w: number, h: number) => { sx: number; sy: number; sw: number; sh: number },
  type: "image/jpeg" | "image/png",
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { sx, sy, sw, sh } = crop(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  if (type === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.88));
  if (!blob) throw new Error("encode failed");
  return blob;
}

/** A square passport-style photo: centre crop, 600 × 600 JPEG. */
export function squarePhoto(file: Blob, size = 600): Promise<Blob> {
  return draw(file, size, size, (w, h) => {
    const side = Math.min(w, h);
    // Portrait photos keep the top (the face), not the exact centre.
    return { sx: (w - side) / 2, sy: h > w ? (h - side) * 0.25 : (h - side) / 2, sw: side, sh: side };
  }, "image/jpeg");
}

/** Fit within `maxEdge`, keeping proportions (and transparency, as PNG). */
export async function fitImage(file: Blob, maxEdge: number, type: "image/jpeg" | "image/png"): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  return draw(file, w, h, () => ({ sx: 0, sy: 0, sw: bitmap.width, sh: bitmap.height }), type);
}
