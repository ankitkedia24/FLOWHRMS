"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Printer, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { IdCardView } from "@/components/idcard/IdCardView";
import { cn } from "@/lib/cn";
import {
  FIELD_LABELS,
  ID_FIELDS,
  cardSizeMm,
  defaultLayout,
  normaliseLayout,
  type IdCardLayout,
  type IdCardPerson,
  type IdField,
} from "@/lib/idcard/layout";
import { saveIdCardDesignAction } from "@/lib/idcard/actions";
import { fitImage, uploadMedia } from "@/lib/media/upload";

type Target = "photo" | IdField;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * The ID card designer. The company's own design goes underneath; the
 * photo box and each line of text are dragged into place on top of it
 * (or nudged with the arrow keys), and styled from the panel.
 */
export function IdCardDesigner({
  tenantId,
  initialLayout,
  backgroundUrl: initialBackground,
  logoUrl,
  samples,
}: {
  tenantId: string;
  initialLayout: IdCardLayout;
  backgroundUrl: string | null;
  logoUrl: string | null;
  samples: Array<{ id: string; person: IdCardPerson; photoUrl: string | null }>;
}) {
  const router = useRouter();
  const { show } = useToast();
  const overlay = useRef<HTMLDivElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);
  const [layout, setLayout] = useState(initialLayout);
  const [backgroundUrl, setBackgroundUrl] = useState(initialBackground);
  /** undefined = unchanged, null = removed, string = newly uploaded. */
  const [backgroundPath, setBackgroundPath] = useState<string | null | undefined>(undefined);
  const [selected, setSelected] = useState<Target>("name");
  const [sampleId, setSampleId] = useState(samples[0]?.id ?? "");
  const [busy, setBusy] = useState<"upload" | "save" | null>(null);

  const sample = samples.find((s) => s.id === sampleId) ?? samples[0];
  const person: IdCardPerson = sample?.person ?? {
    name: "Ravi Kumar",
    designation: "Delivery Executive",
    employeeCode: "EMP001",
    department: "Delivery",
    bloodGroup: "O+",
    phone: "98765 43210",
  };
  const mm = cardSizeMm(layout.orientation);
  // Square in millimetres, whatever the card's orientation.
  const squareRatio = mm.w / mm.h;
  const height =
    layout.orientation === "portrait" ? "min(440px, calc((100vw - 64px) * 85.6 / 54))" : "min(300px, calc((100vw - 64px) * 54 / 85.6))";

  function drag(e: React.PointerEvent, target: Target, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    const rect = overlay.current?.getBoundingClientRect();
    if (!rect) return;
    setSelected(target);
    const start = structuredClone(layout);
    const x0 = e.clientX;
    const y0 = e.clientY;
    const onMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - x0) / rect.width) * 100;
      const dy = ((ev.clientY - y0) / rect.height) * 100;
      const next = structuredClone(start);
      if (target === "photo") {
        if (mode === "move") {
          next.photo.x = clamp(start.photo.x + dx, 0, 100 - start.photo.w);
          next.photo.y = clamp(start.photo.y + dy, 0, 100 - start.photo.h);
        } else {
          const w = clamp(start.photo.w + dx, 8, 100 - start.photo.x);
          next.photo.w = w;
          next.photo.h = clamp(w * squareRatio, 5, 100 - start.photo.y);
        }
      } else {
        const f = start.fields[target];
        if (mode === "move") {
          next.fields[target].x = clamp(f.x + dx, 0, 100 - f.w);
          next.fields[target].y = clamp(f.y + dy, 0, 97);
        } else {
          next.fields[target].w = clamp(f.w + dx, 10, 100 - f.x);
        }
      }
      setLayout(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function nudge(e: React.KeyboardEvent, target: Target) {
    const step = e.shiftKey ? 2 : 0.5;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    setLayout((l) => {
      const next = structuredClone(l);
      const box = target === "photo" ? next.photo : next.fields[target];
      box.x = clamp(box.x + d[0], 0, 100 - box.w);
      box.y = clamp(box.y + d[1], 0, 97);
      return next;
    });
  }

  const setField = (key: IdField, patch: Partial<IdCardLayout["fields"][IdField]>) =>
    setLayout((l) => ({ ...l, fields: { ...l.fields, [key]: { ...l.fields[key], ...patch } } }));

  async function pickBackground(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      show({ variant: "error", message: "Use a JPG or PNG image of your card design." });
      return;
    }
    setBusy("upload");
    try {
      const blob = await fitImage(file, 1800, "image/jpeg");
      const up = await uploadMedia(tenantId, "idcard", blob, "jpg");
      if (!up.ok) {
        show({ variant: "error", message: up.error });
        return;
      }
      setBackgroundPath(up.path);
      setBackgroundUrl(URL.createObjectURL(blob));
      // Match the card to the design's shape.
      const bitmap = await createImageBitmap(blob);
      const orientation = bitmap.height >= bitmap.width ? "portrait" : "landscape";
      if (orientation !== layout.orientation) setLayout(defaultLayout(orientation));
      show({ variant: "success", message: "Design uploaded. Place the photo and text, then save." });
    } catch {
      show({ variant: "error", message: "That image couldn't be read. Try another file." });
    } finally {
      setBusy(null);
      if (bgInput.current) bgInput.current.value = "";
    }
  }

  async function save() {
    setBusy("save");
    const r = await saveIdCardDesignAction({ backgroundPath, layout: normaliseLayout(layout) });
    setBusy(null);
    show({ variant: r.ok ? "success" : "error", message: r.ok ? r.message : r.error });
    if (r.ok) {
      setBackgroundPath(undefined);
      router.refresh();
    }
  }

  const field = selected === "photo" ? null : layout.fields[selected];

  return (
    <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
      <Card className="flex flex-col items-center gap-3">
        <div className="relative" style={{ height }}>
          <IdCardView
            layout={layout}
            person={person}
            photoUrl={sample?.photoUrl ?? null}
            backgroundUrl={backgroundUrl}
            logoUrl={logoUrl}
            height={height}
          />
          <div ref={overlay} className="absolute inset-0">
            <Handle
              label="Photo"
              active={selected === "photo"}
              style={{ left: `${layout.photo.x}%`, top: `${layout.photo.y}%`, width: `${layout.photo.w}%`, height: `${layout.photo.h}%` }}
              onPointerDown={(e) => drag(e, "photo", "move")}
              onResize={(e) => drag(e, "photo", "resize")}
              onKeyDown={(e) => nudge(e, "photo")}
            />
            {ID_FIELDS.filter((k) => layout.fields[k].show).map((k) => {
              const f = layout.fields[k];
              return (
                <Handle
                  key={k}
                  label={FIELD_LABELS[k]}
                  active={selected === k}
                  style={{
                    left: `${f.x}%`,
                    top: `${f.y}%`,
                    width: `${f.w}%`,
                    height: `calc(${height} * ${(f.size * 1.2) / 100})`,
                  }}
                  onPointerDown={(e) => drag(e, k, "move")}
                  onResize={(e) => drag(e, k, "resize")}
                  onKeyDown={(e) => nudge(e, k)}
                />
              );
            })}
          </div>
        </div>
        <p className="max-w-[320px] text-center text-caption text-text-secondary">
          Drag the photo and text into place. Pull a corner to resize. Arrow keys nudge the selected item.
        </p>
        {samples.length > 0 && (
          <Select
            label="Preview with"
            value={sampleId}
            onChange={(e) => setSampleId(e.target.value)}
            options={samples.map((s) => ({ value: s.id, label: s.person.name }))}
          />
        )}
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Card design" meta="Your full card artwork, without photo or names. JPG or PNG." />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              loading={busy === "upload"}
              leadingIcon={<ImageUp className="size-4" aria-hidden="true" />}
              onClick={() => bgInput.current?.click()}
            >
              {backgroundUrl ? "Replace design" : "Upload design"}
            </Button>
            {backgroundUrl && (
              <Button
                size="sm"
                variant="tertiary"
                leadingIcon={<Trash2 className="size-4" aria-hidden="true" />}
                onClick={() => {
                  setBackgroundUrl(null);
                  setBackgroundPath(null);
                }}
              >
                Remove design
              </Button>
            )}
          </div>
          <p className="mt-2 text-caption text-text-secondary">
            Best at 638 × 1013 px (upright) or 1013 × 638 px (sideways) — a standard 85.6 × 54 mm card at 300 dpi.
          </p>
          <input
            ref={bgInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => void pickBackground(e.target.files?.[0])}
          />
          <div className="mt-4">
            <Select
              label="Card shape"
              value={layout.orientation}
              onChange={(e) => setLayout(defaultLayout(e.target.value as "portrait" | "landscape"))}
              options={[
                { value: "portrait", label: "Upright (54 × 85.6 mm)" },
                { value: "landscape", label: "Sideways (85.6 × 54 mm)" },
              ]}
              helper="Changing the shape puts the photo and text back in their starting places."
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="What's printed" meta="Tick what to show. Click an item to style it." />
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => setSelected("photo")}
              className={cn(
                "rounded-button px-2 py-2 text-left text-body",
                selected === "photo" ? "bg-brand-primary-subtle font-semibold text-brand-primary" : "text-text-primary hover:bg-surface-sunken",
              )}
            >
              Photo
            </button>
            {ID_FIELDS.map((k) => (
              <div
                key={k}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-button px-2",
                  selected === k ? "bg-brand-primary-subtle" : "hover:bg-surface-sunken",
                )}
              >
                <Checkbox
                  label={FIELD_LABELS[k]}
                  checked={layout.fields[k].show}
                  onChange={(e) => {
                    setField(k, { show: e.target.checked });
                    setSelected(k);
                  }}
                />
                <button type="button" className="text-caption text-brand-primary underline-offset-2 hover:underline" onClick={() => setSelected(k)}>
                  Style
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title={selected === "photo" ? "Photo" : FIELD_LABELS[selected]} />
          {selected === "photo" ? (
            <div className="flex flex-col gap-3">
              <Select
                label="Shape"
                value={layout.photo.shape}
                onChange={(e) => setLayout((l) => ({ ...l, photo: { ...l.photo, shape: e.target.value as "rect" } }))}
                options={[
                  { value: "rounded", label: "Rounded square" },
                  { value: "rect", label: "Square" },
                  { value: "circle", label: "Circle" },
                ]}
              />
              <Range
                label="Size"
                min={10}
                max={70}
                value={layout.photo.w}
                onChange={(w) =>
                  setLayout((l) => ({ ...l, photo: { ...l.photo, w, h: clamp(w * squareRatio, 5, 100 - l.photo.y) } }))
                }
              />
            </div>
          ) : (
            field && (
              <div className="flex flex-col gap-3">
                <Range label="Text size" min={1.5} max={12} step={0.1} value={field.size} onChange={(size) => setField(selected as IdField, { size })} />
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5 text-label text-text-primary">
                    Colour
                    <input
                      type="color"
                      value={field.color}
                      onChange={(e) => setField(selected as IdField, { color: e.target.value })}
                      className="h-11 w-full cursor-pointer rounded-input border border-border-default bg-surface-default p-1"
                    />
                  </label>
                  <Select
                    label="Align"
                    value={field.align}
                    onChange={(e) => setField(selected as IdField, { align: e.target.value as "left" })}
                    options={[
                      { value: "left", label: "Left" },
                      { value: "center", label: "Centre" },
                      { value: "right", label: "Right" },
                    ]}
                  />
                </div>
                <Checkbox label="Bold" checked={field.bold} onChange={(e) => setField(selected as IdField, { bold: e.target.checked })} />
                <Input
                  label="Text before it"
                  optional
                  value={field.prefix}
                  maxLength={24}
                  onChange={(e) => setField(selected as IdField, { prefix: e.target.value })}
                  helper='For example "ID: " or "Blood group: ".'
                />
              </div>
            )
          )}
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button loading={busy === "save"} disabled={busy === "upload"} onClick={save}>
            Save ID card design
          </Button>
          <Button
            variant="outline"
            leadingIcon={<RotateCcw className="size-4" aria-hidden="true" />}
            onClick={() => setLayout(defaultLayout(layout.orientation))}
          >
            Reset positions
          </Button>
          <Link
            href="/print/id-cards?all=1"
            target="_blank"
            className="inline-flex h-11 items-center gap-2 rounded-button px-4 text-label text-brand-primary hover:bg-surface-sunken"
          >
            <Printer className="size-4" aria-hidden="true" />
            Print everyone&apos;s cards
          </Link>
        </div>
      </div>
    </div>
  );
}

function Handle({
  label,
  active,
  style,
  onPointerDown,
  onResize,
  onKeyDown,
}: {
  label: string;
  active: boolean;
  style: React.CSSProperties;
  onPointerDown: (e: React.PointerEvent) => void;
  onResize: (e: React.PointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${label}. Drag to move, or use the arrow keys.`}
      className={cn(
        "absolute cursor-move touch-none outline-offset-0",
        active ? "outline-2 outline-dashed outline-brand-primary" : "hover:outline hover:outline-1 hover:outline-brand-primary/60",
      )}
      style={style}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      {active && (
        <span
          aria-hidden="true"
          onPointerDown={onResize}
          className="absolute -right-1.5 -bottom-1.5 size-3 cursor-nwse-resize rounded-sm border border-white bg-brand-primary"
        />
      )}
    </div>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-label text-text-primary">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--fh-color-brand-primary,#7166F3)]"
      />
    </label>
  );
}
