"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, IdCard, ImageUp, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { SplashScreen } from "@/components/shell/SplashScreen";
import { setCompanyLogoAction, setSplashAction, setSplashEnabledAction } from "@/lib/branding/actions";
import { SPLASH_MAX_BYTES, SPLASH_MAX_SECONDS } from "@/lib/media/bucket";
import { gifDurationSeconds, videoDurationSeconds } from "@/lib/media/duration";
import { fitImage, uploadMedia } from "@/lib/media/upload";

/**
 * The company's own look (screen A24): its logo — shown in the app's top
 * bar, on payslips and ID cards — and an optional opening animation of at
 * most four seconds, played once when someone opens the app.
 */
export function BrandingCard({
  tenantId,
  logoUrl,
  splash,
}: {
  tenantId: string;
  logoUrl: string | null;
  splash: { url: string; mime: string; enabled: boolean } | null;
}) {
  const router = useRouter();
  const { show } = useToast();
  const logoInput = useRef<HTMLInputElement>(null);
  const splashInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"logo" | "splash" | "toggle" | null>(null);
  const [preview, setPreview] = useState(0);

  const report = (r: { ok: true; message: string } | { ok: false; error: string }) => {
    show({ variant: r.ok ? "success" : "error", message: r.ok ? r.message : r.error });
    if (r.ok) router.refresh();
  };

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      show({ variant: "error", message: "Use a PNG, JPG or WebP image. PNG keeps a transparent background." });
      return;
    }
    setBusy("logo");
    try {
      const blob = await fitImage(file, 512, "image/png");
      const up = await uploadMedia(tenantId, "logo", blob, "png");
      report(up.ok ? await setCompanyLogoAction({ path: up.path }) : { ok: false, error: up.error });
    } catch {
      show({ variant: "error", message: "That image couldn't be read. Try another file." });
    } finally {
      setBusy(null);
      if (logoInput.current) logoInput.current.value = "";
    }
  }

  async function pickSplash(file: File | undefined) {
    if (!file) return;
    const mime = file.type as "image/gif" | "video/mp4" | "video/webm";
    if (!["image/gif", "video/mp4", "video/webm"].includes(mime)) {
      show({ variant: "error", message: "Use a GIF, MP4 or WebM file." });
      return;
    }
    if (file.size > SPLASH_MAX_BYTES) {
      show({ variant: "error", message: "Keep it under 5 MB, so it loads quickly on phones." });
      return;
    }
    setBusy("splash");
    try {
      const seconds =
        mime === "image/gif"
          ? gifDurationSeconds(new Uint8Array(await file.arrayBuffer()))
          : await videoDurationSeconds(file);
      if (seconds === null) {
        show({ variant: "error", message: "That file couldn't be read. Try exporting it again." });
        return;
      }
      if (seconds > SPLASH_MAX_SECONDS + 0.05) {
        show({
          variant: "error",
          message: `It runs ${seconds.toFixed(1)} seconds. Keep it to ${SPLASH_MAX_SECONDS} seconds or less.`,
        });
        return;
      }
      const ext = mime === "image/gif" ? "gif" : mime === "video/mp4" ? "mp4" : "webm";
      const up = await uploadMedia(tenantId, "splash", file, ext);
      report(up.ok ? await setSplashAction({ path: up.path, mime }) : { ok: false, error: up.error });
    } finally {
      setBusy(null);
      if (splashInput.current) splashInput.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader title="Your logo and look" />

      <section className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-40 items-center justify-center rounded-surface-card border border-border-default bg-[repeating-conic-gradient(#f1f1f5_0%_25%,#ffffff_0%_50%)] bg-[length:16px_16px] p-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
            <img src={logoUrl} alt="Your company logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-caption text-text-tertiary">No logo yet</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-label text-text-primary">Company logo</p>
          <p className="max-w-[40ch] text-caption text-text-secondary">
            Shown in the app&apos;s top bar for everyone, on payslips and on ID cards. PNG with a transparent
            background looks best.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              loading={busy === "logo"}
              leadingIcon={<ImageUp className="size-4" aria-hidden="true" />}
              onClick={() => logoInput.current?.click()}
            >
              {logoUrl ? "Change logo" : "Upload logo"}
            </Button>
            {logoUrl && (
              <Button
                size="sm"
                variant="tertiary"
                disabled={busy !== null}
                leadingIcon={<Trash2 className="size-4" aria-hidden="true" />}
                onClick={async () => report(await setCompanyLogoAction({ path: null }))}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
        <input
          ref={logoInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => void pickLogo(e.target.files?.[0])}
        />
      </section>

      <section className="mt-5 border-t border-border-subtle pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-label text-text-primary">
              <Clapperboard className="size-4" aria-hidden="true" />
              Opening animation <span className="font-normal text-text-secondary">· Optional</span>
            </p>
            <p className="mt-1 max-w-[52ch] text-caption text-text-secondary">
              Your own short animation — a GIF, MP4 or WebM of {SPLASH_MAX_SECONDS} seconds or less, under 5 MB — played
              full screen once each time someone opens the app, with its sound where the phone allows it (otherwise a
              “Tap for sound” button appears). A tap anywhere else skips it.
            </p>
          </div>
          {splash && (
            <Switch
              label="Show when the app opens"
              checked={splash.enabled}
              pending={busy === "toggle"}
              onChange={async (next) => {
                setBusy("toggle");
                report(await setSplashEnabledAction({ enabled: next }));
                setBusy(null);
              }}
            />
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            loading={busy === "splash"}
            leadingIcon={<ImageUp className="size-4" aria-hidden="true" />}
            onClick={() => splashInput.current?.click()}
          >
            {splash ? "Replace animation" : "Upload animation"}
          </Button>
          {splash && (
            <>
              <Button
                size="sm"
                variant="outline"
                leadingIcon={<Play className="size-4" aria-hidden="true" />}
                onClick={() => setPreview((n) => n + 1)}
              >
                Preview
              </Button>
              <Button
                size="sm"
                variant="tertiary"
                disabled={busy !== null}
                leadingIcon={<Trash2 className="size-4" aria-hidden="true" />}
                onClick={async () => report(await setSplashAction({ path: null, mime: null }))}
              >
                Remove
              </Button>
            </>
          )}
        </div>
        <input
          ref={splashInput}
          type="file"
          accept="image/gif,video/mp4,video/webm"
          className="hidden"
          onChange={(e) => void pickSplash(e.target.files?.[0])}
        />
        {splash && preview > 0 && (
          <SplashScreen key={preview} src={splash.url} mime={splash.mime} storageKey={null} />
        )}
      </section>

      <section className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-5">
        <div>
          <p className="flex items-center gap-2 text-label text-text-primary">
            <IdCard className="size-4" aria-hidden="true" />
            ID cards
          </p>
          <p className="mt-1 max-w-[52ch] text-caption text-text-secondary">
            Upload your card design; each employee&apos;s photo, name, designation and ID are placed on it.
          </p>
        </div>
        <Link
          href="/admin/settings/id-card"
          className="inline-flex min-h-11 items-center rounded-button border-[1.5px] border-border-strong px-4 text-label text-text-primary hover:bg-surface-sunken"
        >
          Design ID card
        </Link>
      </section>
    </Card>
  );
}
