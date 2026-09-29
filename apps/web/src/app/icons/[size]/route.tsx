import { ImageResponse } from "next/og";
import { iconArt } from "@/lib/brand/icon-art";

/**
 * PNG app icons at stable URLs for the web manifest.
 *
 * Chrome requires 192 and 512 PNGs before it will offer to install, and a
 * `maskable` variant so Android can crop to its launcher shape without
 * slicing the mark.
 *
 * A route rather than the `icon.tsx` file convention because the manifest
 * needs URLs it can name: the file convention appends a content hash.
 */

/** Only these are served. An open size parameter is a free image-render DoS. */
const ALLOWED: Record<string, { size: number; maskable: boolean }> = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  "512-maskable": { size: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(ALLOWED).map((size) => ({ size }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size } = await params;
  const spec = ALLOWED[size];
  if (!spec) {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(iconArt(spec.size, spec.maskable), {
    width: spec.size,
    height: spec.size,
    headers: {
      // The artwork is fixed at build time; there is nothing to revalidate.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
