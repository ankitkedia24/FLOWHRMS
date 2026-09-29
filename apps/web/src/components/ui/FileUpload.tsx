"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { Camera, FileUp, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

/**
 * File upload (component-specifications.md §25).
 * - Mobile: two buttons — Take Photo (primary path) and Choose File.
 * - Desktop: drop zone. Real <input type="file"> behind the styled control.
 * - Constraints stated up front; per-file errors leave siblings unaffected.
 * Phase 1: selection + validation only; storage wiring arrives with the
 * first business module.
 */
export interface FileUploadProps {
  label: string;
  /** e.g. "JPG, PNG or PDF · up to 10 MB each · up to 5 files" */
  constraintsText: string;
  accept?: string;
  maxFiles?: number;
  maxBytes?: number;
  onChange?: (files: File[]) => void;
  className?: string;
}

interface PickedFile {
  file: File;
  error?: string;
}

export function FileUpload({
  label,
  constraintsText,
  accept = "image/jpeg,image/png,image/heic,application/pdf",
  maxFiles = 5,
  maxBytes = 10 * 1024 * 1024,
  onChange,
  className,
}: FileUploadProps) {
  const uid = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    setPicked((prev) => {
      const room = Math.max(0, maxFiles - prev.length);
      const accepted = incoming.slice(0, room).map((file): PickedFile => {
        if (file.size > maxBytes) {
          const mb = Math.round(file.size / (1024 * 1024));
          return {
            file,
            error: `${file.name} is too large (${mb} MB). Choose a file under ${Math.round(maxBytes / (1024 * 1024))} MB.`,
          };
        }
        return { file };
      });
      const next = [...prev, ...accepted];
      onChange?.(next.filter((p) => !p.error).map((p) => p.file));
      return next;
    });
  }

  function removeAt(index: number) {
    setPicked((prev) => {
      const next = prev.filter((_, i) => i !== index);
      onChange?.(next.filter((p) => !p.error).map((p) => p.file));
      return next;
    });
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <span id={`upload-label-${uid}`} className="text-label text-text-primary">
        {label}
      </span>

      {/* Hidden real inputs — keyboard operable via the visible buttons. */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        aria-labelledby={`upload-label-${uid}`}
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Mobile: two buttons. */}
      <div className="flex flex-col gap-2 md:hidden">
        <Button
          variant="primary"
          size="lg"
          leadingIcon={<Camera aria-hidden="true" className="size-5" />}
          onClick={() => cameraInputRef.current?.click()}
        >
          Take Photo
        </Button>
        <Button
          variant="secondary"
          size="lg"
          leadingIcon={<FileUp aria-hidden="true" className="size-5" />}
          onClick={() => fileInputRef.current?.click()}
        >
          Choose File
        </Button>
      </div>

      {/* Desktop: drop zone. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "hidden flex-col items-center gap-2 rounded-surface-card border-2 border-dashed p-8 text-center md:flex",
          dragOver
            ? "border-border-focus bg-brand-primary-subtle"
            : "border-border-strong bg-surface-default",
        )}
      >
        <FileUp aria-hidden="true" className="size-7 text-text-secondary" />
        <p className="text-body text-text-primary">
          Drag files here, or{" "}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="font-semibold text-brand-primary underline-offset-2 hover:underline"
          >
            choose files
          </button>
        </p>
      </div>

      <p className="text-caption text-text-secondary">{constraintsText}</p>

      {picked.length > 0 && (
        <ul className="mt-1 flex flex-col gap-2">
          {picked.map((item, index) => (
            <li
              key={`${item.file.name}-${index}`}
              className={cn(
                "flex items-center gap-3 rounded-md border p-2.5",
                item.error
                  ? "border-status-error-border bg-status-error-bg"
                  : "border-border-default bg-surface-default",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-secondary font-medium text-text-primary">
                  {item.file.name}
                </span>
                {item.error ? (
                  <span className="text-caption text-status-error-text">
                    {item.error}
                  </span>
                ) : (
                  <span className="font-mono text-mono text-text-tertiary">
                    {(item.file.size / 1024).toFixed(0)} KB
                  </span>
                )}
              </span>
              <button
                type="button"
                aria-label={`Remove ${item.file.name}`}
                onClick={() => removeAt(index)}
                className="rounded-xs p-2 text-text-secondary hover:bg-surface-sunken hover:text-text-primary"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
