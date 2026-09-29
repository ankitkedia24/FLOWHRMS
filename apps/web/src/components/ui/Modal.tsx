"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";

/**
 * Modal (component-specifications.md §18).
 * Built on native <dialog>: focus trap, Esc and ::backdrop come from the
 * platform. Below md it renders as a full-height bottom sheet with a
 * sticky footer. Destructive flows pass `preventEscClose` so dismissal
 * requires an explicit choice.
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** 480px default; 640px for review content. */
  width?: "default" | "review";
  /** Destructive modals require an explicit choice — Esc/backdrop disabled. */
  preventEscClose?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "default",
  preventEscClose = false,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleCancel = useCallback(
    (e: React.SyntheticEvent<HTMLDialogElement>) => {
      if (preventEscClose) {
        e.preventDefault();
        return;
      }
      onClose();
    },
    [onClose, preventEscClose],
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClose={() => open && onClose()}
      className={cn(
        "m-0 w-full bg-surface-raised p-0 text-text-primary shadow-elevation-4 backdrop:bg-[var(--fh-color-surface-overlay)]",
        // Mobile: bottom sheet.
        "fixed inset-x-0 top-auto bottom-0 max-h-[90dvh] rounded-t-sheet",
        // md+: centred dialog.
        "md:inset-0 md:m-auto md:max-h-[80vh] md:rounded-modal",
        width === "review" ? "md:max-w-[640px]" : "md:max-w-[480px]",
      )}
    >
      <div className="flex max-h-[inherit] flex-col">
        {/* Drag-handle affordance (mobile sheet only). */}
        <div className="flex justify-center pt-2 md:hidden" aria-hidden="true">
          <div className="h-1 w-9 rounded-pill bg-border-strong" />
        </div>
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-2 md:px-6">
          <h2 id={titleId} className="font-heading text-h2 text-text-primary">
            {title}
          </h2>
          {!preventEscClose && (
            <IconButton label="Close" onClick={onClose} size="md">
              <X />
            </IconButton>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 md:px-6">
          {children}
        </div>
        {footer && (
          <footer className="flex flex-col gap-3 border-t border-border-default px-5 py-4 md:flex-row md:justify-end md:px-6">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
