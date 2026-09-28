"use client";

import { useRef, useState } from "react";
import { Camera, ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { uploadMedia } from "@/lib/media/upload";
import { ImageCropper } from "@/components/media/ImageCropper";

/**
 * An employee's photo: taken on the spot with the phone camera, or chosen
 * from the gallery, then cropped by the person uploading it (square: drag,
 * zoom, rotate) and shrunk before it leaves the phone. Kept private (signed
 * links only). Used on the ID card, the profile and the directory.
 */
export function PhotoPicker({
  tenantId,
  name,
  initialUrl,
  onChange,
  disabled = false,
}: {
  tenantId: string;
  /** For the initials shown when there is no photo. */
  name: string;
  initialUrl: string | null;
  /** The uploaded file's path, or null when removed. */
  onChange: (path: string | null) => void | Promise<void>;
  disabled?: boolean;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropping, setCropping] = useState<File | null>(null);

  function take(file: File | undefined) {
    if (camera.current) camera.current.value = "";
    if (gallery.current) gallery.current.value = "";
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Choose a photo (JPG or PNG).");
      return;
    }
    setCropping(file);
  }

  async function upload(blob: Blob) {
    setBusy(true);
    try {
      const local = URL.createObjectURL(blob);
      const up = await uploadMedia(tenantId, "photos", blob, "jpg");
      if (!up.ok) {
        URL.revokeObjectURL(local);
        setError(up.error);
        return;
      }
      setPreview(local);
      await onChange(up.path);
    } catch {
      setError("That photo couldn't be read. Try another one.");
    } finally {
      setBusy(false);
    }
  }

  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label text-text-primary">
        Photo <span className="font-normal text-text-secondary">· Optional</span>
      </span>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-default bg-brand-primary-subtle">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed or local blob URL
            <img src={preview} alt={`Photo of ${name || "this person"}`} className="size-full object-cover" />
          ) : (
            <span className="font-heading text-h2 text-brand-primary" aria-hidden="true">
              {initials}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || busy}
            loading={busy}
            leadingIcon={<Camera className="size-4" aria-hidden="true" />}
            onClick={() => camera.current?.click()}
          >
            Take photo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || busy}
            leadingIcon={<ImageUp className="size-4" aria-hidden="true" />}
            onClick={() => gallery.current?.click()}
          >
            Choose photo
          </Button>
          {preview && (
            <Button
              type="button"
              size="sm"
              variant="tertiary"
              disabled={disabled || busy}
              leadingIcon={<Trash2 className="size-4" aria-hidden="true" />}
              onClick={async () => {
                setPreview(null);
                await onChange(null);
              }}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      <p className="text-caption text-text-secondary">
        A clear, front-facing photo. It&apos;s used on their ID card.
      </p>
      {error && <p className="text-caption text-status-error-text">{error}</p>}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => take(e.target.files?.[0])}
      />
      <input ref={gallery} type="file" accept="image/*" className="hidden" onChange={(e) => take(e.target.files?.[0])} />
      {cropping && (
        <ImageCropper
          file={cropping}
          shape="square"
          title="Crop the photo"
          onCancel={() => setCropping(null)}
          onDone={(blob) => {
            setCropping(null);
            void upload(blob);
          }}
        />
      )}
    </div>
  );
}
