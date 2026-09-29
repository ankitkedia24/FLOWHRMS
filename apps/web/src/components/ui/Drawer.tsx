"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";

/**
 * Drawer (component-specifications.md §19).
 * Right detail panel on desktop (420–480px); bottom sheet at 90% height on
 * mobile. Dialog semantics; the heading names the record. A drawer never
 * contains a second drawer.
 */
export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Names the record, e.g. "Meena Joshi — 7 August exception". */
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Drawer({ open, onClose, title, children, footer }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClose={() => open && onClose()}
      className={cn(
        "m-0 w-full bg-surface-raised p-0 text-text-primary shadow-elevation-4 backdrop:bg-[var(--fh-color-surface-overlay)]",
        // Mobile: bottom sheet at 90% height.
        "fixed inset-x-0 top-auto bottom-0 h-[90dvh] max-h-[90dvh] rounded-t-sheet",
        // md+: right panel, full height.
        "md:inset-y-0 md:right-0 md:left-auto md:h-dvh md:max-h-dvh md:w-[480px] md:rounded-none",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex justify-center pt-2 md:hidden" aria-hidden="true">
          <div className="h-1 w-9 rounded-pill bg-border-strong" />
        </div>
        <header className="flex items-start justify-between gap-3 border-b border-border-default px-5 py-4">
          <h2 id={titleId} className="font-heading text-h2 text-text-primary">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
        {footer && (
          <footer className="flex flex-col gap-3 border-t border-border-default px-5 py-4 md:flex-row md:justify-end">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
