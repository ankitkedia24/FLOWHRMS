"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCw, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/**
 * Crop an image before it is uploaded.
 *
 * - "square" (employee photos): a fixed square frame; drag the photo to
 *   place it, zoom with the slider, the mouse wheel or two fingers, rotate
 *   a sideways phone photo. Saved as a square JPEG.
 * - "free" (company logos): the whole image with a crop box whose corners
 *   and edges can be dragged, to trim away empty background. Saved as PNG,
 *   so a transparent logo stays transparent.
 *
 * Works with mouse and touch (pointer events). Nothing is uploaded here —
 * the caller gets the cropped image back and uploads it.
 */
export function ImageCropper({
  file,
  shape,
  title,
  onCancel,
  onDone,
  outputSize = 600,
  maxEdge = 512,
}: {
  file: Blob;
  shape: "square" | "free";
  title: string;
  onCancel: () => void;
  onDone: (cropped: Blob) => void;
  /** Square mode: output width and height in pixels. */
  outputSize?: number;
  /** Free mode: longest edge of the output. */
  maxEdge?: number;
}) {
  // The picture being cropped: the file, or a rotated copy of it.
  const [source, setSource] = useState<Blob>(file);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load (and re-load after a rotation). Each load has its own link, freed
  // when that load is replaced; a replaced load's events are ignored.
  useEffect(() => {
    let current = true;
    const url = URL.createObjectURL(source);
    const image = new Image();
    image.onload = () => current && setImg(image);
    image.onerror = () => current && setError("That image couldn't be opened. Try another one.");
    image.src = url;
    return () => {
      current = false;
      URL.revokeObjectURL(url);
    };
  }, [source]);

  async function rotate() {
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalHeight;
    canvas.height = img.naturalWidth;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, shape === "free" ? "image/png" : "image/jpeg", 0.92));
    if (!blob) return;
    setImg(null);
    setSource(blob);
  }

  return createPortal(
    <Modal open onClose={onCancel} title={title} width="review">
      {error ? (
        <p className="text-body text-status-error-text">{error}</p>
      ) : !img ? (
        <p className="py-10 text-center text-secondary text-text-secondary">Opening the image…</p>
      ) : shape === "square" ? (
        <SquareCrop
          img={img}
          busy={busy}
          onRotate={rotate}
          onCancel={onCancel}
          onDone={async (rect) => {
            setBusy(true);
            const blob = await cut(img, rect, outputSize, outputSize, "image/jpeg");
            setBusy(false);
            if (blob) onDone(blob);
            else setError("The photo couldn't be cropped. Try again.");
          }}
        />
      ) : (
        <FreeCrop
          img={img}
          busy={busy}
          onCancel={onCancel}
          onDone={async (rect) => {
            setBusy(true);
            const scale = Math.min(1, maxEdge / Math.max(rect.w, rect.h));
            const blob = await cut(img, rect, Math.max(1, Math.round(rect.w * scale)), Math.max(1, Math.round(rect.h * scale)), "image/png");
            setBusy(false);
            if (blob) onDone(blob);
            else setError("The logo couldn't be cropped. Try again.");
          }}
        />
      )}
    </Modal>,
    document.body,
  );
}

type Rect = { x: number; y: number; w: number; h: number };

/** Draw part of the image (natural pixels) into a new image of the given size. */
function cut(img: HTMLImageElement, r: Rect, width: number, height: number, type: "image/jpeg" | "image/png"): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  if (type === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.9));
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Keep receiving this pointer's moves outside the element; never let a refusal stop the drag. */
function capture(e: React.PointerEvent) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    /* not capturable (e.g. already released) — the drag still works inside */
  }
}

// ---------------------------------------------------------------- square

function SquareCrop({
  img,
  busy,
  onRotate,
  onCancel,
  onDone,
}: {
  img: HTMLImageElement;
  busy: boolean;
  onRotate: () => void;
  onCancel: () => void;
  onDone: (rect: Rect) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(() => Math.min(340, window.innerWidth - 72));
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  // Zoom 1 = the photo just covers the square.
  const [zoom, setZoom] = useState(1);
  // The photo's top-left corner, relative to the square, in screen pixels.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const measure = () => setSize(Math.min(340, (stage.current?.parentElement?.clientWidth ?? 340) - 8));
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const scale = (size / Math.min(nw, nh)) * zoom;
  const place = useCallback(
    (x: number, y: number, s: number) => ({
      x: clamp(x, size - nw * s, 0),
      y: clamp(y, size - nh * s, 0),
    }),
    [nw, nh, size],
  );
  // Centre the photo at first, and whenever the square's size changes.
  const at = pos ? place(pos.x, pos.y, scale) : place((size - nw * scale) / 2, (size - nh * scale) / 2, scale);

  function zoomTo(next: number) {
    const z = clamp(next, 1, 4);
    const s2 = (size / Math.min(nw, nh)) * z;
    // Keep the centre of the square on the same spot of the photo.
    const cx = (size / 2 - at.x) / scale;
    const cy = (size / 2 - at.y) / scale;
    setZoom(z);
    setPos(place(size / 2 - cx * s2, size / 2 - cy * s2, s2));
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={stage}
        className="relative touch-none select-none overflow-hidden rounded-surface-card bg-surface-sunken"
        style={{ width: size, height: size, cursor: "grab" }}
        onPointerDown={(e) => {
          capture(e);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
          }
        }}
        onPointerMove={(e) => {
          const last = pointers.current.get(e.pointerId);
          if (!last) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2 && pinch.current) {
            const [a, b] = [...pointers.current.values()];
            zoomTo(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist));
            return;
          }
          setPos(place(at.x + (e.clientX - last.x), at.y + (e.clientY - last.y), scale));
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          if (pointers.current.size < 2) pinch.current = null;
        }}
        onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
        onWheel={(e) => zoomTo(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
        <img
          src={img.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute left-0 top-0 max-w-none"
          style={{ width: nw * scale, height: nh * scale, transform: `translate(${at.x}px, ${at.y}px)` }}
        />
        {/* How it looks as a round profile picture; the ID card uses the square. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ boxShadow: "0 0 0 9999px rgba(23,22,62,0.35)" }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-surface-card ring-2 ring-inset ring-white/80" />
      </div>

      <label className="flex w-full max-w-[340px] items-center gap-3 text-label text-text-primary">
        <ZoomIn className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
        <span className="sr-only">Zoom</span>
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => zoomTo(Number(e.target.value))}
          className="w-full accent-[var(--fh-color-brand-primary,#7166F3)]"
        />
      </label>
      <p className="text-caption text-text-secondary">Drag to move the photo. The whole square is used on the ID card.</p>

      <div className="flex w-full flex-wrap justify-between gap-2">
        <Button type="button" variant="outline" size="sm" leadingIcon={<RotateCw className="size-4" aria-hidden="true" />} onClick={onRotate}>
          Rotate
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="tertiary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={busy}
            onClick={() => onDone({ x: -at.x / scale, y: -at.y / scale, w: size / scale, h: size / scale })}
          >
            Use photo
          </Button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ free

type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

function FreeCrop({
  img,
  busy,
  onCancel,
  onDone,
}: {
  img: HTMLImageElement;
  busy: boolean;
  onCancel: () => void;
  onDone: (rect: Rect) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState(() => {
    const avail = Math.min(520, window.innerWidth - 72);
    return { w: avail, h: Math.min(320, Math.round(avail * 0.75)) };
  });
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;

  useEffect(() => {
    const measure = () => {
      const avail = Math.min(520, (wrap.current?.clientWidth ?? 360) - 8);
      setBox({ w: avail, h: Math.min(320, Math.round(avail * 0.75)) });
    };
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // The image fitted into the box; the crop rectangle in those screen pixels.
  const fit = Math.min(box.w / nw, box.h / nh, 4);
  const dw = nw * fit;
  const dh = nh * fit;
  const [rect, setRect] = useState<Rect | null>(null);
  const r = rect ?? { x: 0, y: 0, w: dw, h: dh };
  const drag = useRef<{ handle: Handle; x: number; y: number; start: Rect } | null>(null);
  const MIN = 16;

  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    let { x, y, w, h } = d.start;
    if (d.handle === "move") {
      x = clamp(x + dx, 0, dw - w);
      y = clamp(y + dy, 0, dh - h);
    } else {
      if (d.handle.includes("w")) {
        const nx = clamp(x + dx, 0, x + w - MIN);
        w += x - nx;
        x = nx;
      }
      if (d.handle.includes("e")) w = clamp(w + dx, MIN, dw - x);
      if (d.handle.includes("n")) {
        const ny = clamp(y + dy, 0, y + h - MIN);
        h += y - ny;
        y = ny;
      }
      if (d.handle.includes("s")) h = clamp(h + dy, MIN, dh - y);
    }
    setRect({ x, y, w, h });
  }

  function begin(handle: Handle, e: React.PointerEvent) {
    e.stopPropagation();
    capture(e);
    drag.current = { handle, x: e.clientX, y: e.clientY, start: r };
  }

  const handles: Array<{ h: Handle; style: React.CSSProperties; cursor: string }> = [
    { h: "nw", style: { left: -7, top: -7 }, cursor: "nwse-resize" },
    { h: "ne", style: { right: -7, top: -7 }, cursor: "nesw-resize" },
    { h: "sw", style: { left: -7, bottom: -7 }, cursor: "nesw-resize" },
    { h: "se", style: { right: -7, bottom: -7 }, cursor: "nwse-resize" },
    { h: "n", style: { left: "calc(50% - 7px)", top: -7 }, cursor: "ns-resize" },
    { h: "s", style: { left: "calc(50% - 7px)", bottom: -7 }, cursor: "ns-resize" },
    { h: "w", style: { left: -7, top: "calc(50% - 7px)" }, cursor: "ew-resize" },
    { h: "e", style: { right: -7, top: "calc(50% - 7px)" }, cursor: "ew-resize" },
  ];

  return (
    <div ref={wrap} className="flex flex-col items-center gap-4">
      <div
        className="relative touch-none select-none bg-[repeating-conic-gradient(#ececf3_0%_25%,#ffffff_0%_50%)] bg-[length:16px_16px]"
        style={{ width: dw, height: dh }}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
        <img src={img.src} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full" />
        {/* Dim what will be cut away — four strips, kept inside the image. */}
        {[
          { left: 0, top: 0, width: dw, height: r.y },
          { left: 0, top: r.y + r.h, width: dw, height: dh - r.y - r.h },
          { left: 0, top: r.y, width: r.x, height: r.h },
          { left: r.x + r.w, top: r.y, width: dw - r.x - r.w, height: r.h },
        ].map((strip, i) => (
          <div key={i} aria-hidden="true" className="pointer-events-none absolute bg-[rgba(23,22,62,0.45)]" style={strip} />
        ))}
        <div
          className="absolute cursor-move outline outline-2 outline-brand-primary"
          style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
          onPointerDown={(e) => begin("move", e)}
          onPointerMove={onMove}
          onPointerUp={() => (drag.current = null)}
        >
          {handles.map(({ h, style, cursor }) => (
            <span
              key={h}
              aria-hidden="true"
              className="absolute size-3.5 rounded-sm border-2 border-white bg-brand-primary"
              style={{ ...style, cursor }}
              onPointerDown={(e) => begin(h, e)}
              onPointerMove={onMove}
              onPointerUp={() => (drag.current = null)}
            />
          ))}
        </div>
      </div>
      <p className="text-caption text-text-secondary">Drag the corners or edges to trim empty space around your logo.</p>
      <div className="flex w-full flex-wrap justify-between gap-2">
        <Button type="button" variant="tertiary" size="sm" onClick={() => setRect(null)}>
          Reset
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="tertiary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={busy}
            onClick={() => onDone({ x: r.x / fit, y: r.y / fit, w: r.w / fit, h: r.h / fit })}
          >
            Use logo
          </Button>
        </div>
      </div>
    </div>
  );
}
